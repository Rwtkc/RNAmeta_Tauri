use serde::Serialize;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTable {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    source_path: String,
    row_count: usize,
}

fn detect_delimiter(line: &str) -> char {
    if line.contains('\t') {
        '\t'
    } else if line.contains(',') {
        ','
    } else if line.contains(';') {
        ';'
    } else {
        '\t'
    }
}

fn split_line(line: &str, delimiter: char) -> Vec<String> {
    line.trim_end()
        .split(delimiter)
        .map(|value| value.trim().to_string())
        .collect()
}

fn bed_column_names(count: usize) -> Vec<String> {
    let base = vec![
        "chrom",
        "chromStart",
        "chromEnd",
        "name",
        "score",
        "strand",
        "thickStart",
        "thickEnd",
        "itemRgb",
        "blockCount",
        "blockSizes",
        "blockStarts",
    ];

    if count <= base.len() {
        return base.into_iter().take(count).map(String::from).collect();
    }

    let mut headers: Vec<String> = base.into_iter().map(String::from).collect();
    for index in 0..(count - headers.len()) {
        headers.push(format!("extra_{}", index + 1));
    }
    headers
}

fn normalize_cell(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn is_numeric_like(value: &str) -> bool {
    value.trim().parse::<f64>().is_ok()
}

fn looks_like_chromosome(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    ["chr", "x", "y", "z", "m", "mt", "chloroplast", "pt", "c", "scaffold", "contig"]
        .iter()
        .any(|prefix| normalized.starts_with(prefix))
        || normalized
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_digit())
}

fn has_explicit_bed_header(row: &[String]) -> bool {
    if row.len() < 3 {
        return false;
    }

    let first = normalize_cell(&row[0]);
    let second = normalize_cell(&row[1]);
    let third = normalize_cell(&row[2]);

    matches!(first.as_str(), "chrom" | "chr" | "chromosome" | "seqname" | "seqnames")
        && matches!(second.as_str(), "chromstart" | "start" | "txstart")
        && matches!(third.as_str(), "chromend" | "end" | "txend")
}

fn has_bed_header_shape(rows: &[Vec<String>]) -> bool {
    if rows.len() < 2 || rows[0].len() < 3 {
        return false;
    }

    let first_row = &rows[0];
    let next_rows = rows.iter().skip(1).take(4);
    let first_row_non_numeric =
        !is_numeric_like(&first_row[1]) && !is_numeric_like(&first_row[2]);

    let mut saw_row = false;
    let mut all_numeric = true;
    let mut chromosome_like_count = 0;

    for row in next_rows {
        if row.len() < 3 {
            continue;
        }

        saw_row = true;
        if !is_numeric_like(&row[1]) || !is_numeric_like(&row[2]) {
            all_numeric = false;
        }
        if looks_like_chromosome(&row[0]) {
            chromosome_like_count += 1;
        }
    }

    saw_row && first_row_non_numeric && all_numeric && chromosome_like_count >= 1
}

fn should_drop_first_row(rows: &[Vec<String>]) -> bool {
    rows.first().is_some_and(|row| has_explicit_bed_header(row)) || has_bed_header_shape(rows)
}

fn pad_rows(rows: &mut [Vec<String>]) -> usize {
    let max_columns = rows.iter().map(|row| row.len()).max().unwrap_or(0);
    for row in rows {
        while row.len() < max_columns {
            row.push(String::new());
        }
    }
    max_columns
}

fn read_non_empty_lines(path: &str, max_lines: Option<usize>) -> Result<Vec<String>, String> {
    let file = File::open(path).map_err(|error| format!("Failed to open preview file: {error}"))?;
    let reader = BufReader::new(file);
    let mut lines = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|error| format!("Failed to read preview row: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }

        lines.push(line);
        if max_lines.is_some_and(|limit| lines.len() >= limit) {
            break;
        }
    }

    Ok(lines)
}

fn build_rows_from_lines(lines: &[String], delimiter: char) -> Vec<Vec<String>> {
    lines
        .iter()
        .map(|line| split_line(line, delimiter))
        .collect()
}

fn sanitize_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("upload")
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn normalize_bed_file(app: &tauri::AppHandle, path: &str) -> Result<String, String> {
    let lines = read_non_empty_lines(path, Some(5))?;
    if lines.is_empty() {
        return Err("Uploaded BED file is empty.".to_string());
    }

    let delimiter = detect_delimiter(&lines[0]);
    let rows = build_rows_from_lines(&lines, delimiter);
    let should_drop_header = should_drop_first_row(&rows);
    let session_root = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("session-cache")
        .join("upload-run");
    fs::create_dir_all(&session_root).map_err(|error| {
        format!(
            "Failed to create normalized upload directory '{}': {error}",
            session_root.display()
        )
    })?;

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let output_path = session_root.join(format!("{}_{}.bed", sanitize_stem(path), unique));
    let source = File::open(path).map_err(|error| format!("Failed to open uploaded BED file: {error}"))?;
    let reader = BufReader::new(source);
    let mut output = String::new();
    let mut skipped = false;

    for line in reader.lines() {
        let line = line.map_err(|error| format!("Failed to normalize uploaded BED file: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }

        if should_drop_header && !skipped {
            skipped = true;
            continue;
        }

        output.push_str(line.trim_end());
        output.push('\n');
    }

    fs::write(&output_path, output).map_err(|error| {
        format!(
            "Failed to write normalized BED file '{}': {error}",
            output_path.display()
        )
    })?;

    Ok(output_path.display().to_string())
}

#[tauri::command]
pub fn read_delimited_preview(path: String, max_lines: usize) -> Result<PreviewTable, String> {
    let lines = read_non_empty_lines(&path, Some(max_lines.saturating_add(1)))?;
    if lines.is_empty() {
        return Ok(PreviewTable {
            headers: Vec::new(),
            rows: Vec::new(),
            source_path: path,
            row_count: 0,
        });
    }

    let delimiter = detect_delimiter(&lines[0]);
    let mut rows = build_rows_from_lines(&lines, delimiter);

    if should_drop_first_row(&rows) {
        rows.remove(0);
    }
    if rows.len() > max_lines {
        rows.truncate(max_lines);
    }

    let max_columns = pad_rows(&mut rows);

    Ok(PreviewTable {
        headers: bed_column_names(max_columns),
        row_count: rows.len(),
        rows,
        source_path: path,
    })
}

#[tauri::command]
pub fn normalize_uploaded_bed_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    let mut normalized_paths = Vec::with_capacity(paths.len());
    for path in paths {
        normalized_paths.push(normalize_bed_file(&app, &path)?);
    }

    Ok(normalized_paths)
}

#[cfg(test)]
mod tests {
    use super::{detect_delimiter, read_delimited_preview, read_non_empty_lines, should_drop_first_row};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_bed(contents: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("rnameta_preview_{unique}.bed"));
        fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn preview_drops_standard_bed_header_row() {
        let path = write_temp_bed("chrom\tchromStart\tchromEnd\nchr10\t1411\t1412\nchr4\t1016\t1017\n");

        let preview = read_delimited_preview(path.display().to_string(), 10).unwrap();

        assert_eq!(preview.rows.len(), 2);
        assert_eq!(preview.rows[0], vec!["chr10", "1411", "1412"]);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn preview_drops_nonstandard_header_row_by_shape() {
        let path = write_temp_bed("seqid\tstart_pos\tend_pos\nchr3\t100\t200\nchr5\t300\t400\n");

        let preview = read_delimited_preview(path.display().to_string(), 10).unwrap();

        assert_eq!(preview.rows.len(), 2);
        assert_eq!(preview.rows[0], vec!["chr3", "100", "200"]);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn preview_keeps_plain_bed_first_row() {
        let path = write_temp_bed("chr1\t10\t20\nchr2\t30\t40\n");

        let preview = read_delimited_preview(path.display().to_string(), 10).unwrap();

        assert_eq!(preview.rows.len(), 2);
        assert_eq!(preview.rows[0], vec!["chr1", "10", "20"]);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn header_detection_matches_uploaded_bed_with_header() {
        let path = write_temp_bed("chr\tchromStart\tchromEnd\nchr10\t1411\t1412\nchr4\t1016\t1017\n");
        let lines = read_non_empty_lines(&path.display().to_string(), Some(5)).unwrap();
        let delimiter = detect_delimiter(&lines[0]);
        let rows = lines
            .iter()
            .map(|line| super::split_line(line, delimiter))
            .collect::<Vec<_>>();

        assert!(should_drop_first_row(&rows));
        let _ = fs::remove_file(path);
    }
}
