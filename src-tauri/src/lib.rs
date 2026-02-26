// src-tauri/src/lib.rs

use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

mod secure_scripts {
    include!(concat!(env!("OUT_DIR"), "/secure_scripts.rs"));
}

fn deobfuscate(input: &[u8]) -> Vec<u8> {
    input
        .iter()
        .enumerate()
        .map(|(idx, byte)| {
            let salt = ((idx as u64).wrapping_mul(31).wrapping_add(17) & 0xff) as u8;
            byte ^ secure_scripts::SCRIPT_KEY[idx % secure_scripts::SCRIPT_KEY.len()] ^ salt
        })
        .collect()
}

#[tauri::command]
fn prepare_secure_script(app: tauri::AppHandle, script_id: String) -> Result<String, String> {
    let blob = secure_scripts::get_script_blob(&script_id)
        .ok_or_else(|| format!("Unknown script id: {script_id}"))?;
    let script_bytes = deobfuscate(blob);

    let base_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let scripts_dir = base_dir.join("secure-scripts");
    fs::create_dir_all(&scripts_dir).map_err(|e| e.to_string())?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let pid = std::process::id();
    let script_path = scripts_dir.join(format!("{script_id}_{pid}_{now}.R"));

    fs::write(&script_path, script_bytes).map_err(|e| e.to_string())?;
    Ok(script_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn cleanup_secure_script(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }

    let script_path = PathBuf::from(path);
    if script_path.exists() {
        fs::remove_file(script_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct CoveragePoint {
    transcript_coordinate: i64,
    coverage: f64,
}

#[derive(serde::Serialize)]
struct CoverageProfile {
    transcript_id: String,
    tx_len: i64,
    utr5_len: i64,
    cds_len: i64,
    utr3_len: i64,
    start_pos: i64,
    stop_pos: i64,
    points: Vec<CoveragePoint>,
}

#[derive(serde::Serialize)]
struct CoverageTranscriptItem {
    transcript_id: String,
    row_count: usize,
    tx_len: Option<i64>,
    start_pos: Option<i64>,
    stop_pos: Option<i64>,
}

#[derive(serde::Serialize)]
struct CoverageTablePage {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    page: usize,
    page_size: usize,
    total_rows: usize,
    total_pages: usize,
}

#[derive(Debug)]
struct CoverageCsvIndex {
    modified_unix_secs: u64,
    headers: Vec<String>,
    line_offsets: Vec<u64>,
    transcript_offsets: BTreeMap<String, Vec<u64>>,
}

static COVERAGE_CSV_INDEX_CACHE: OnceLock<Mutex<BTreeMap<String, Arc<CoverageCsvIndex>>>> =
    OnceLock::new();

fn csv_index_cache() -> &'static Mutex<BTreeMap<String, Arc<CoverageCsvIndex>>> {
    COVERAGE_CSV_INDEX_CACHE.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn file_modified_unix_secs(path: &str) -> Result<u64, String> {
    let modified = fs::metadata(path)
        .and_then(|m| m.modified())
        .map_err(|e| format!("Failed to read modified time for '{path}': {e}"))?;
    modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Invalid modified timestamp for '{path}': {e}"))
        .map(|d| d.as_secs())
}

fn split_csv_trim_pad(line: &str, headers_len: usize) -> Vec<String> {
    let mut fields: Vec<String> = line.split(',').map(|s| s.trim().to_string()).collect();
    if fields.len() < headers_len {
        fields.resize(headers_len, String::new());
    } else if fields.len() > headers_len {
        fields.truncate(headers_len);
    }
    fields
}

fn build_coverage_csv_index(csv_path: &str, modified_unix_secs: u64) -> Result<CoverageCsvIndex, String> {
    let file = File::open(csv_path)
        .map_err(|e| format!("Failed to open coverage file: {csv_path} ({e})"))?;
    let mut reader = BufReader::new(file);

    let mut header_line = String::new();
    let header_bytes = reader
        .read_line(&mut header_line)
        .map_err(|e| format!("Failed to read header: {e}"))?;
    if header_bytes == 0 || header_line.trim().is_empty() {
        return Err("coverage_mRNA.csv is empty.".to_string());
    }

    let headers: Vec<String> = header_line
        .trim_end()
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
    let idx_tid = headers.iter().position(|h| h == "transcript_id");

    let mut line_offsets: Vec<u64> = Vec::new();
    let mut transcript_offsets: BTreeMap<String, Vec<u64>> = BTreeMap::new();
    let mut offset = header_bytes as u64;

    loop {
        let mut line = String::new();
        let bytes = reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read line while indexing: {e}"))?;
        if bytes == 0 {
            break;
        }

        let current_offset = offset;
        offset += bytes as u64;

        if line.trim().is_empty() {
            continue;
        }

        line_offsets.push(current_offset);

        if let Some(col_tid) = idx_tid {
            let fields: Vec<&str> = line.split(',').collect();
            if fields.len() > col_tid {
                let tid = fields[col_tid].trim();
                if !tid.is_empty() {
                    transcript_offsets
                        .entry(tid.to_string())
                        .or_default()
                        .push(current_offset);
                }
            }
        }
    }

    Ok(CoverageCsvIndex {
        modified_unix_secs,
        headers,
        line_offsets,
        transcript_offsets,
    })
}

fn get_or_build_coverage_csv_index(csv_path: &str) -> Result<Arc<CoverageCsvIndex>, String> {
    let modified = file_modified_unix_secs(csv_path)?;

    {
        let cache_guard = csv_index_cache()
            .lock()
            .map_err(|_| "Failed to lock CSV index cache.".to_string())?;
        if let Some(index) = cache_guard.get(csv_path) {
            if index.modified_unix_secs == modified {
                return Ok(Arc::clone(index));
            }
        }
    }

    let built = Arc::new(build_coverage_csv_index(csv_path, modified)?);

    let mut cache_guard = csv_index_cache()
        .lock()
        .map_err(|_| "Failed to lock CSV index cache.".to_string())?;
    if let Some(index) = cache_guard.get(csv_path) {
        if index.modified_unix_secs == modified {
            return Ok(Arc::clone(index));
        }
    }
    cache_guard.insert(csv_path.to_string(), Arc::clone(&built));
    Ok(built)
}

fn read_lines_by_offsets(csv_path: &str, offsets: &[u64]) -> Result<Vec<String>, String> {
    let file = File::open(csv_path)
        .map_err(|e| format!("Failed to open coverage file: {csv_path} ({e})"))?;
    let mut reader = BufReader::new(file);
    let mut lines = Vec::with_capacity(offsets.len());

    for offset in offsets {
        reader
            .seek(SeekFrom::Start(*offset))
            .map_err(|e| format!("Failed to seek coverage file: {e}"))?;
        let mut line = String::new();
        let bytes = reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read coverage line by offset: {e}"))?;
        if bytes == 0 || line.trim().is_empty() {
            continue;
        }
        lines.push(line.trim_end().to_string());
    }

    Ok(lines)
}

#[tauri::command]
async fn load_coverage_table_page(
    csv_path: String,
    page: usize,
    page_size: usize,
    search_query: Option<String>,
) -> Result<CoverageTablePage, String> {
    tauri::async_runtime::spawn_blocking(move || {
        load_coverage_table_page_impl(csv_path, page, page_size, search_query)
    })
    .await
    .map_err(|e| format!("Failed to join table loading task: {e}"))?
}

fn load_coverage_table_page_impl(
    csv_path: String,
    page: usize,
    page_size: usize,
    search_query: Option<String>,
) -> Result<CoverageTablePage, String> {
    let index = get_or_build_coverage_csv_index(&csv_path)?;
    let headers = index.headers.clone();
    if headers.is_empty() {
        return Err("coverage_mRNA.csv header is empty.".to_string());
    }

    let page = if page == 0 { 1 } else { page };
    let page_size = page_size.clamp(1, 2000);
    let search_query = search_query.unwrap_or_default().trim().to_lowercase();
    let has_search = !search_query.is_empty();
    let start_idx = (page - 1) * page_size;
    let end_idx = start_idx.saturating_add(page_size);

    let (rows, total_rows) = if !has_search {
        let total_rows = index.line_offsets.len();
        let rows = if start_idx >= total_rows {
            Vec::new()
        } else {
            let slice_end = usize::min(end_idx, total_rows);
            let page_offsets = &index.line_offsets[start_idx..slice_end];
            let page_lines = read_lines_by_offsets(&csv_path, page_offsets)?;
            page_lines
                .into_iter()
                .map(|line| split_csv_trim_pad(&line, headers.len()))
                .collect()
        };
        (rows, total_rows)
    } else {
        let file = File::open(&csv_path)
            .map_err(|e| format!("Failed to open coverage file: {csv_path} ({e})"))?;
        let mut reader = BufReader::new(file);
        let mut header_line = String::new();
        reader
            .read_line(&mut header_line)
            .map_err(|e| format!("Failed to read header: {e}"))?;

        let mut rows: Vec<Vec<String>> = Vec::with_capacity(page_size);
        let mut total_rows = 0usize;
        for line in reader.lines() {
            let line = line.map_err(|e| format!("Failed to read line: {e}"))?;
            if line.trim().is_empty() {
                continue;
            }
            if !line.to_lowercase().contains(&search_query) {
                continue;
            }
            if total_rows >= start_idx && total_rows < end_idx {
                rows.push(split_csv_trim_pad(&line, headers.len()));
            }
            total_rows += 1;
        }
        (rows, total_rows)
    };

    let total_pages = if total_rows == 0 {
        1
    } else {
        (total_rows + page_size - 1) / page_size
    };

    Ok(CoverageTablePage {
        headers,
        rows,
        page,
        page_size,
        total_rows,
        total_pages,
    })
}

#[tauri::command]
fn list_coverage_transcripts(csv_path: String) -> Result<Vec<CoverageTranscriptItem>, String> {
    let file = File::open(&csv_path)
        .map_err(|e| format!("Failed to open coverage file: {csv_path} ({e})"))?;
    let mut reader = BufReader::new(file);

    let mut header = String::new();
    reader
        .read_line(&mut header)
        .map_err(|e| format!("Failed to read header: {e}"))?;
    if header.trim().is_empty() {
        return Err("coverage_mRNA.csv is empty.".to_string());
    }

    let headers: Vec<&str> = header.trim_end().split(',').collect();
    let idx_tid = headers
        .iter()
        .position(|h| *h == "transcript_id")
        .ok_or_else(|| "Missing required column: transcript_id".to_string())?;
    let idx_tx_len = headers.iter().position(|h| *h == "tx_len");
    let idx_start = headers.iter().position(|h| *h == "start_pos");
    let idx_stop = headers.iter().position(|h| *h == "stop_pos");

    let mut map: BTreeMap<String, CoverageTranscriptItem> = BTreeMap::new();
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {e}"))?;
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(',').collect();
        if fields.len() <= idx_tid {
            continue;
        }

        let tid = fields[idx_tid].trim();
        if tid.is_empty() {
            continue;
        }

        let entry = map.entry(tid.to_string()).or_insert(CoverageTranscriptItem {
            transcript_id: tid.to_string(),
            row_count: 0,
            tx_len: None,
            start_pos: None,
            stop_pos: None,
        });
        entry.row_count += 1;

        if entry.tx_len.is_none() {
            if let Some(idx) = idx_tx_len {
                if fields.len() > idx {
                    entry.tx_len = fields[idx].trim().parse::<i64>().ok();
                }
            }
        }
        if entry.start_pos.is_none() {
            if let Some(idx) = idx_start {
                if fields.len() > idx {
                    entry.start_pos = fields[idx].trim().parse::<i64>().ok();
                }
            }
        }
        if entry.stop_pos.is_none() {
            if let Some(idx) = idx_stop {
                if fields.len() > idx {
                    entry.stop_pos = fields[idx].trim().parse::<i64>().ok();
                }
            }
        }
    }

    Ok(map.into_values().collect())
}

#[tauri::command]
async fn load_coverage_profile(csv_path: String, transcript_id: String) -> Result<CoverageProfile, String> {
    tauri::async_runtime::spawn_blocking(move || load_coverage_profile_impl(csv_path, transcript_id))
        .await
        .map_err(|e| format!("Failed to join profile loading task: {e}"))?
}

fn load_coverage_profile_impl(csv_path: String, transcript_id: String) -> Result<CoverageProfile, String> {
    let index = get_or_build_coverage_csv_index(&csv_path)?;
    if index.headers.is_empty() {
        return Err("coverage_mRNA.csv header is empty.".to_string());
    }
    let headers: Vec<&str> = index.headers.iter().map(|s| s.as_str()).collect();
    let index_of = |name: &str| -> Result<usize, String> {
        headers
            .iter()
            .position(|h| *h == name)
            .ok_or_else(|| format!("Missing required column: {name}"))
    };

    let idx_tid = index_of("transcript_id")?;
    let idx_coord = index_of("transcript_coordinate")?;
    let idx_cov = index_of("coverage")?;
    let idx_tx_len = index_of("tx_len")?;
    let idx_utr5 = index_of("utr5_len")?;
    let idx_cds = index_of("cds_len")?;
    let idx_utr3 = index_of("utr3_len")?;
    let idx_start = index_of("start_pos")?;
    let idx_stop = index_of("stop_pos")?;

    let max_idx = [
        idx_tid, idx_coord, idx_cov, idx_tx_len, idx_utr5, idx_cds, idx_utr3, idx_start, idx_stop,
    ]
    .into_iter()
    .max()
    .unwrap_or(0);

    let offsets = index
        .transcript_offsets
        .get(&transcript_id)
        .ok_or_else(|| format!("No rows found for transcript_id '{transcript_id}' in {csv_path}"))?;
    let lines = read_lines_by_offsets(&csv_path, offsets)?;

    let mut coverage_map: BTreeMap<i64, f64> = BTreeMap::new();
    let mut meta: Option<(i64, i64, i64, i64, i64, i64)> = None;

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }

        let fields: Vec<&str> = line.split(',').collect();
        if fields.len() <= max_idx {
            continue;
        }

        let transcript_coordinate = match fields[idx_coord].trim().parse::<i64>() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let coverage = match fields[idx_cov].trim().parse::<f64>() {
            Ok(v) => v,
            Err(_) => continue,
        };

        coverage_map
            .entry(transcript_coordinate)
            .and_modify(|v| *v += coverage)
            .or_insert(coverage);

        if meta.is_none() {
            let tx_len = fields[idx_tx_len]
                .trim()
                .parse::<i64>()
                .map_err(|e| format!("Invalid tx_len: {e}"))?;
            let utr5_len = fields[idx_utr5]
                .trim()
                .parse::<i64>()
                .map_err(|e| format!("Invalid utr5_len: {e}"))?;
            let cds_len = fields[idx_cds]
                .trim()
                .parse::<i64>()
                .map_err(|e| format!("Invalid cds_len: {e}"))?;
            let utr3_len = fields[idx_utr3]
                .trim()
                .parse::<i64>()
                .map_err(|e| format!("Invalid utr3_len: {e}"))?;
            let start_pos = fields[idx_start]
                .trim()
                .parse::<i64>()
                .map_err(|e| format!("Invalid start_pos: {e}"))?;
            let stop_pos = fields[idx_stop]
                .trim()
                .parse::<i64>()
                .map_err(|e| format!("Invalid stop_pos: {e}"))?;

            meta = Some((tx_len, utr5_len, cds_len, utr3_len, start_pos, stop_pos));
        }
    }

    if coverage_map.is_empty() || meta.is_none() {
        return Err(format!(
            "No rows found for transcript_id '{transcript_id}' in {csv_path}"
        ));
    }

    let (tx_len, utr5_len, cds_len, utr3_len, start_pos, stop_pos) = meta.expect("meta checked");
    let points = coverage_map
        .into_iter()
        .map(|(transcript_coordinate, coverage)| CoveragePoint {
            transcript_coordinate,
            coverage,
        })
        .collect();

    Ok(CoverageProfile {
        transcript_id,
        tx_len,
        utr5_len,
        cds_len,
        utr3_len,
        start_pos,
        stop_pos,
        points,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            prepare_secure_script,
            cleanup_secure_script,
            load_coverage_table_page,
            list_coverage_transcripts,
            load_coverage_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
