#!/usr/bin/env Rscript

options(bitmapType = "cairo")
pdf(NULL)

suppressPackageStartupMessages({
  library(data.table)
})

parse_args <- function(args) {
  params <- list()
  if (length(args) %% 2 != 0) {
    stop("[ERROR] Arguments must be provided as --key value pairs.")
  }
  for (i in seq(1, length(args), by = 2)) {
    key <- gsub("^--", "", args[i])
    params[[key]] <- args[i + 1]
  }
  params
}

analysis_mul <- function(orf_file, cov_list, outdir, orf_read_cutoff = 10, orf_length_cutoff = 18) {
  an <- fread(orf_file, sep = "\t", header = FALSE, fill = TRUE)
  if (!("V1" %in% names(an)) || !("V3" %in% names(an))) {
    stop("[ERROR] ORF candidate file format invalid: required columns V1 and V3 are missing.")
  }

  an[, transcript_id := gsub(":.*", "", V1)]
  if ("totalcov" %in% names(cov_list)) {
    valid_transcripts <- unique(cov_list[totalcov > 10, transcript_id])
    an <- an[transcript_id %in% valid_transcripts]
    rm(valid_transcripts)
  } else {
    an <- an[transcript_id %in% unique(cov_list$transcript_id)]
  }

  if (nrow(an) == 0) {
    empty <- data.table(
      orfID = character(),
      transcript_id = character(),
      mrna = character(),
      start = numeric(),
      end = numeric(),
      orf_type = character(),
      start_codon = character(),
      orf_length = numeric(),
      f1 = numeric(),
      f2 = numeric(),
      f3 = numeric(),
      total = numeric(),
      orfscore = numeric(),
      pvalue = numeric()
    )
    fwrite(empty, file = file.path(outdir, "all.input.parameters.txt"), sep = "\t")
    fwrite(empty, file = file.path(outdir, "orfcall.parameters.txt"), sep = "\t")
    return(invisible(empty))
  }

  an2 <- an[, tstrsplit(V1, "|", fixed = TRUE)]
  if (!("V4" %in% names(an2))) an2[, V4 := NA_character_]
  if (!("V5" %in% names(an2))) an2[, V5 := NA_character_]
  setnames(an2, c("V4", "V5"), c("orf_type", "start_codon"))

  an3 <- an2[, tstrsplit(V3, ":", fixed = TRUE)]
  if (!("V2" %in% names(an3)) || !("V3" %in% names(an3))) {
    stop("[ERROR] ORF candidate V3 column cannot be parsed to transcript-length:start:end format.")
  }
  setnames(an3, c("V2", "V3"), c("start", "end"))

  an5 <- an2[, tstrsplit(V1, ":", fixed = TRUE)]
  if (!("V1" %in% names(an5))) {
    stop("[ERROR] ORF candidate V1 column cannot be parsed to extract transcript name.")
  }
  if (!("V2" %in% names(an5))) an5[, V2 := NA_character_]
  if (!("V3" %in% names(an5))) an5[, V3 := NA_character_]
  setnames(an5, c("V1", "V2", "V3"), c("mrna", "chr", "strand"))

  an <- cbind(an, an5[, .(mrna)], an3[, .(start, end)], an2[, .(orf_type, start_codon)])
  an[, start := as.numeric(start)]
  an[, end := as.numeric(end)]
  an <- an[!is.na(start) & !is.na(end)]
  an[, orf_length := end - start + 1]
  an <- an[, .(V1, transcript_id, mrna, start, end, orf_type, start_codon, orf_length)]
  an[, `:=`(orf_row_id = .I, orfID = V1)]
  rm(an2, an3, an5)
  invisible(gc())

  cat("[PROGRESS] 50% | ORF calling: preparing range-join tables...\n")
  cov_pos <- unique(cov_list[, .(
    mrna = transcript_id,
    pos = as.integer(transcript_coordinate),
    coverage = as.numeric(coverage)
  )])
  cov_pos <- cov_pos[!is.na(mrna) & !is.na(pos) & !is.na(coverage)]
  cov_pos <- cov_pos[coverage > 0]
  cov_pos[, `:=`(pos_start = pos, pos_end = pos)]

  cat("[PROGRESS] 55% | ORF calling: range join coverage to ORF windows (chunked by transcript)...\n")
  an_range <- an[, .(orf_row_id, mrna, start, end)]
  mrna_bounds <- an_range[, .(min_start = min(start), max_end = max(end)), by = mrna]
  cov_pos <- cov_pos[mrna_bounds, on = .(mrna), nomatch = 0L]
  cov_pos <- cov_pos[pos >= min_start & pos <= max_end]
  cov_pos[, c("min_start", "max_end") := NULL]

  valid_mrna <- intersect(unique(an_range$mrna), unique(cov_pos$mrna))
  chunk_size <- 200L
  mrna_chunks <- split(valid_mrna, ceiling(seq_along(valid_mrna) / chunk_size))
  n_chunks <- length(mrna_chunks)
  frame_sum_list <- vector("list", n_chunks)
  total_sum_list <- vector("list", n_chunks)

  for (idx in seq_len(n_chunks)) {
    tr <- mrna_chunks[[idx]]
    cov_chunk <- cov_pos[mrna %chin% tr]
    an_chunk <- an_range[mrna %chin% tr]
    if (nrow(cov_chunk) == 0L || nrow(an_chunk) == 0L) next

    setkey(an_chunk, mrna, start, end)
    setkey(cov_chunk, mrna, pos_start, pos_end)

    hits_chunk <- foverlaps(
      cov_chunk,
      an_chunk,
      by.x = c("mrna", "pos_start", "pos_end"),
      by.y = c("mrna", "start", "end"),
      nomatch = 0L
    )

    if (nrow(hits_chunk) > 0L) {
      hits_chunk <- hits_chunk[, .(orf_row_id, start, pos, coverage)]
      hits_chunk[, frame := (pos - start) %% 3L]
      frame_sum_list[[idx]] <- hits_chunk[, .(per = sum(coverage)), by = .(orf_row_id, frame)]
      total_sum_list[[idx]] <- hits_chunk[, .(total = sum(coverage)), by = .(orf_row_id)]
    }

    if (idx %% 20L == 0L || idx == n_chunks) {
      pct <- sprintf("%.1f", (idx / n_chunks) * 100)
      cat(sprintf("[PROGRESS] ORF overlap chunks: %s%% (%d/%d)\n", pct, idx, n_chunks))
      invisible(gc())
    }

    rm(cov_chunk, an_chunk, hits_chunk)
  }

  rm(cov_pos, an_range, valid_mrna, mrna_chunks, mrna_bounds)
  invisible(gc())

  frame_sum <- rbindlist(frame_sum_list, use.names = TRUE, fill = TRUE)
  total_sum <- rbindlist(total_sum_list, use.names = TRUE, fill = TRUE)
  rm(frame_sum_list, total_sum_list)
  invisible(gc())

  if (nrow(frame_sum) == 0L || nrow(total_sum) == 0L) {
    res <- data.table()
  } else {
    cat("[PROGRESS] ORF calling: aggregating frame statistics...\n")
    frame_sum <- frame_sum[, .(per = sum(per)), by = .(orf_row_id, frame)]
    total_sum <- total_sum[, .(total = sum(total)), by = .(orf_row_id)]

    frame_stat <- dcast(frame_sum, orf_row_id ~ frame, value.var = "per", fill = 0)
    for (frame_col in c("0", "1", "2")) {
      if (!(frame_col %in% names(frame_stat))) frame_stat[, (frame_col) := 0]
    }

    frame_stat <- merge(frame_stat, total_sum, by = "orf_row_id", all.x = TRUE)
    frame_stat <- frame_stat[total > 0]
    frame_stat[, `:=`(
      f1 = round(`0` / total, 5),
      f2 = round(`1` / total, 5),
      f3 = round(`2` / total, 5)
    )]

    res <- merge(
      an[, .(orf_row_id, orfID, transcript_id, mrna, start, end, orf_type, start_codon, orf_length)],
      frame_stat[, .(orf_row_id, f1, f2, f3, total)],
      by = "orf_row_id",
      all = FALSE
    )
    res <- res[total >= orf_read_cutoff & orf_length >= orf_length_cutoff]
    res[, orf_row_id := NULL]
    rm(frame_sum, total_sum, frame_stat)
    invisible(gc())
  }

  if (nrow(res) == 0) {
    empty <- data.table(
      orfID = character(),
      transcript_id = character(),
      mrna = character(),
      start = numeric(),
      end = numeric(),
      orf_type = character(),
      start_codon = character(),
      orf_length = numeric(),
      f1 = numeric(),
      f2 = numeric(),
      f3 = numeric(),
      total = numeric(),
      orfscore = numeric(),
      pvalue = numeric()
    )
    fwrite(empty, file = file.path(outdir, "all.input.parameters.txt"), sep = "\t")
    fwrite(empty, file = file.path(outdir, "orfcall.parameters.txt"), sep = "\t")
    return(invisible(empty))
  }

  fwrite(res, file = file.path(outdir, "all.input.parameters.txt"), sep = "\t")

  cat("[PROGRESS] ORF calling: computing chi-square statistics (vectorized)...\n")
  res[, chi_stat := 3 * total * ((f1 - (1 / 3))^2 + (f2 - (1 / 3))^2 + (f3 - (1 / 3))^2)]
  res[is.na(chi_stat) | chi_stat < 0, chi_stat := 0]
  res[, orfscore := round(log2(chi_stat), 4)]
  res[f1 < f2 | f1 < f3, orfscore := orfscore * -1]
  res[, pvalue := pchisq(chi_stat, df = 2, lower.tail = FALSE)]
  res[, chi_stat := NULL]

  res <- res[pvalue < 0.05]
  res <- res[f1 > f2 & f1 > f3]
  res <- res[total > 10]

  fwrite(res, file = file.path(outdir, "orfcall.parameters.txt"), sep = "\t")
  invisible(res)
}

pause_window_optimized <- function(dt, half_window, pause_out_path) {
  dt <- dt[, .(transcript_id, transcript_coordinate, coverage)]
  setorder(dt, transcript_id, transcript_coordinate)
  dt[, `:=`(
    left_bound = transcript_coordinate - half_window,
    right_bound = transcript_coordinate + half_window
  )]

  result <- dt[dt,
    .(coverage = i.coverage, window_mean = mean(x.coverage)),
    on = .(
      transcript_id,
      transcript_coordinate >= left_bound,
      transcript_coordinate <= right_bound
    ),
    by = .EACHI
  ]

  result[, ratio := coverage / (window_mean + 1e-10)]
  result <- result[ratio > 10]
  fwrite(result, file = pause_out_path, sep = "\t")
}

args <- commandArgs(trailingOnly = TRUE)
params <- parse_args(args)

required_params <- c("outdir", "species", "coverage", "orf", "half-window")
missing <- setdiff(required_params, names(params))
if (length(missing) > 0) {
  stop(paste("[ERROR] Missing required arguments:", paste(missing, collapse = ", ")))
}

OUT_DIR <- params$outdir
SPECIES <- params$species
COVERAGE_FILE <- params$coverage
ORF_FILE <- params$orf
HALF_WINDOW <- suppressWarnings(as.integer(params[["half-window"]]))

if (is.na(HALF_WINDOW) || HALF_WINDOW < 1) {
  stop("[ERROR] Invalid --half-window value. It must be a positive integer.")
}

if (!dir.exists(OUT_DIR)) {
  dir.create(OUT_DIR, recursive = TRUE)
}

if (!file.exists(COVERAGE_FILE)) {
  stop(paste("[ERROR] coverage_mRNA.csv not found:", COVERAGE_FILE))
}
if (!file.exists(ORF_FILE)) {
  stop(paste("[ERROR] Candidate ORF file not found:", ORF_FILE))
}

cat(paste0("[INFO] Starting ORF Pause analysis for: ", SPECIES, "\n"))
cat("[PROGRESS] 15% | Reading coverage_mRNA.csv...\n")
cov_list <- fread(COVERAGE_FILE, header = TRUE)
if (nrow(cov_list) == 0) {
  stop("[ERROR] coverage_mRNA.csv is empty.")
}

if ("transcriptID" %in% names(cov_list) && !("transcript_id" %in% names(cov_list))) {
  setnames(cov_list, "transcriptID", "transcript_id")
}

required_cov_cols <- c("transcript_id", "transcript_coordinate", "coverage")
missing_cov_cols <- setdiff(required_cov_cols, names(cov_list))
if (length(missing_cov_cols) > 0) {
  stop(paste("[ERROR] coverage_mRNA.csv missing required columns:", paste(missing_cov_cols, collapse = ", ")))
}

if (!("totalcov" %in% names(cov_list))) {
  cov_list[, totalcov := sum(coverage), by = transcript_id]
}
cov_list[, loci := paste0(transcript_id, ":", transcript_coordinate)]

cat("[PROGRESS] 45% | Running ORF calling...\n")
analysis_mul(ORF_FILE, cov_list, OUT_DIR)

cat("[PROGRESS] 75% | Computing pause windows...\n")
pause_window_optimized(
  cov_list,
  half_window = HALF_WINDOW,
  pause_out_path = file.path(OUT_DIR, "pause.txt")
)

cat("[PROGRESS] 100% | ORF Pause analysis complete.\n")
cat("[INFO] Outputs: all.input.parameters.txt, orfcall.parameters.txt, pause.txt\n")

