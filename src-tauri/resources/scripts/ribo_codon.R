#!/usr/bin/env Rscript

# ==============================================================================
# RiboMeta Project - Codon Usage & Occupancy Script (V1.3.5 - Optimized)
# Principles: High-performance data.table operations, removed redundant PDF output.
# ==============================================================================

options(bitmapType = 'cairo')
pdf(NULL)

suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
  library(cowplot)
  library(seqinr)
  library(zoo)
  library(parallel)
  library(Biostrings)
  library(Rsamtools)
  library(GenomicAlignments)
})

# --- 参数解析 ---
parse_args <- function(args) {
  params <- list()
  for (i in seq(1, length(args), by = 2)) {
    key <- gsub("--", "", args[i])
    params[[key]] <- args[i + 1]
  }
  return(params)
}

args <- commandArgs(trailingOnly = TRUE)
params <- parse_args(args)

required_params <- c("coverage", "txlens", "fasta", "species", "outdir")
missing <- setdiff(required_params, names(params))

if (length(missing) > 0) {
  stop(paste("[ERROR] Missing required arguments:", paste(missing, collapse = ", ")))
}

COVERAGE_FILE <- params$coverage
TXLENS_FILE   <- params$txlens
FASTA_FILE    <- params$fasta
SPECIES_NAME  <- params$species
RESULT_DIR    <- params$outdir

if (!dir.exists(RESULT_DIR)) dir.create(RESULT_DIR, recursive = TRUE)

setDTthreads(0)

# --- 辅助函数 ---
load_to_var <- function(file_path = NULL) {
  temp_env <- new.env()
  vars <- load(file_path, envir = temp_env)
  return(temp_env[[vars[1]]])
}

set_offset_optimized <- function(reads, offset_list, species) {
  dt_offsets <- data.table(len = as.integer(names(offset_list)), p_off = as.integer(offset_list))
  reads[dt_offsets, on = .(match_len = len), offset_val := i.p_off]
  valid_idx <- !is.na(reads$offset_val)
  if(species %in% c("ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")) {
    reads[valid_idx & strand == '+', transcript_coordinate := as.integer(end - (match_len - offset_val - 1))]
    reads[valid_idx & strand == '-', transcript_coordinate := as.integer(start + (match_len - offset_val - 1))]
  } else {
    reads[valid_idx & strand == '+', transcript_coordinate := as.integer(start + offset_val)]
    reads[valid_idx & strand == '-', transcript_coordinate := as.integer(end - offset_val)]
  }
  return(reads[!is.na(transcript_coordinate) & transcript_coordinate != 0])
}

# ==========================================
# 核心执行流程
# ==========================================

cat(paste("[INFO] Starting Analysis for:", SPECIES_NAME, "\n"))

cat("[PROGRESS] 10% | Loading txlens...\n")
txlens <- as.data.table(load_to_var(TXLENS_FILE))
txlens <- txlens[cds_len > 0]
txlens[, max_len := max(cds_len), by = gene_id]
txlens_max <- txlens[cds_len == max_len]
txlens_max <- txlens_max[!duplicated(gene_id)]

# 设置 TSS extension 逻辑
if (SPECIES_NAME %in% c("sce_R64", "ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")) {
  tss_extension <- 25
} else {
  tss_extension <- 0
}

cat("[PROGRESS] 20% | Loading transcript fasta...\n")
transcript_seqs <- read.fasta(FASTA_FILE, seqtype = 'DNA', as.string = TRUE)
transcript_seqs <- data.table(transcript_id = names(transcript_seqs), seq = as.character(transcript_seqs))

if (SPECIES_NAME %in% c("bta.ARS-UCD1.2", "clu.ROS_Cfam_1.0", "gga.GRCg7b", "ggo.gorGor4", "mml.Mmul_10", "ptr.Pan_tro_3.0", "Sars_cov_2", "ssc.Sscrofa11.1", "xtr.UCB_Xtro_10.0")) {
  transcript_seqs[, transcript_id := gsub("\\.\\d+$", "", transcript_id, perl = TRUE)]
}

if (!file.exists(COVERAGE_FILE)) {
  cat("[PROGRESS] COVERAGE_MRNA_MISSING: entering generation branch.\n")
  BAM_FILE <- params$bam
  OFFSETS_FILE <- params$offsets
  if (is.null(BAM_FILE) || is.null(OFFSETS_FILE)) {
    stop("[ERROR] coverage_mRNA.csv not found. Provide --bam and --offsets to generate it.")
  }
  if (!file.exists(OFFSETS_FILE)) {
    stop(paste("[ERROR] Offsets file not found:", OFFSETS_FILE))
  }
  cat("[PROGRESS] 30% | Coverage file missing. Generating from BAM...\n")

  param <- ScanBamParam(flag = scanBamFlag(), simpleCigar = FALSE, reverseComplement = FALSE, what = c("qname"))
  reads <- as.data.table(readGAlignments(BAM_FILE, index = paste0(BAM_FILE, ".bai"), param = param))
  reads[, match_len := cigarWidthAlongQuerySpace(cigar, after.soft.clipping = TRUE)]
  reads[, freq := as.numeric(sub("^.*_x", "", qname))]

  if (SPECIES_NAME %in% c("bta.ARS-UCD1.2", "clu.ROS_Cfam_1.0", "gga.GRCg7b", "ggo.gorGor4", "mml.Mmul_10", "ptr.Pan_tro_3.0", "Sars_cov_2", "ssc.Sscrofa11.1", "xtr.UCB_Xtro_10.0")) {
    reads[, seqnames := gsub("\\.\\d+$", "", seqnames, perl = TRUE)]
  }

  offsets_table <- read.table(OFFSETS_FILE, header = TRUE)
  offset_list <- offsets_table$p_offset + 3
  names(offset_list) <- offsets_table$length

  tx_info_slim <- txlens[, .(transcript_id = tx_name, tx_len, utr5_len, cds_len, utr3_len)]
  setnames(reads, "seqnames", "transcript_id")
  reads <- merge(reads[strand == '+'], tx_info_slim, by = 'transcript_id')
  reads <- set_offset_optimized(reads, offset_list, SPECIES_NAME)

  coverage_table <- reads[, .(coverage = sum(freq)), by = .(transcript_id, transcript_coordinate, strand)]
  coverage_table <- merge(coverage_table, tx_info_slim, by = "transcript_id")
  coverage_table[, `:=`(
    start_pos = utr5_len + 1L + tss_extension,
    stop_pos  = utr5_len + cds_len + tss_extension
  )]
  coverage_table[, `:=`(
    site_from_start = transcript_coordinate - start_pos - 3,
    site_from_stop  = transcript_coordinate - stop_pos - 3
  )]
  coverage_table[, gene_cov := sum(coverage), by = transcript_id]
  coverage_table[, CDS_coordinate := transcript_coordinate - utr5_len - tss_extension]
  coverage_table[, codon := ceiling(CDS_coordinate/3)]
  coverage_table[codon <= 0, codon := NA]
  coverage_table[, codon_val := coverage / gene_cov]

  coverage_export <- data.table::copy(coverage_table)
  coverage_export[, strand := "+"]
  coverage_export[, totalcov := sum(coverage), by = transcript_id]
  coverage_export[CDS_coordinate > 0 & CDS_coordinate <= cds_len, cds_cov := sum(coverage), by = transcript_id]
  coverage_export[, length_codon := ceiling(cds_len/3)]
  coverage_export[, codon := ceiling((CDS_coordinate)/3)]
  coverage_export[codon <= 0, codon := NA]

  cov_codon <- coverage_export[, sum(coverage), by = .(transcript_id, codon)]
  coverage_export[cov_codon, coverage_codon := i.V1, on = .(transcript_id, codon)]
  coverage_export[is.na(coverage_export$coverage_codon), coverage_codon := 0]

  fwrite(coverage_export, file = COVERAGE_FILE)
  cov_list <- coverage_export[transcript_id %in% txlens_max$tx_name]
  rm(reads, coverage_table, coverage_export)
  invisible(gc())
} else {
  cat("[PROGRESS] 30% | Loading coverage...\n")
  cov_list <- fread(COVERAGE_FILE, header = TRUE)
  cov_list <- cov_list[transcript_id %in% txlens_max$tx_name]
  invisible(gc())
}

# ==========================================
# Codon Usage
# ==========================================
cat("[PROGRESS] 40% | Calculating codon usage...\n")
codon_usage_count <- function(coverage_cds = NULL, d = NULL, normalization = NULL, tss_extension = NULL) {
  coverage_cds <- coverage_cds[(CDS_coordinate - 1)%%3 == 0]
  coverage_cds <- coverage_cds[codon > 15]

  coverage_cds[transcript_seqs, cds_seq := i.seq, on = .(transcript_id)]
  siteNames <- c("E", "P", "A", "+1", "+2", "+3")
  names(siteNames) <- -2:3
  mutialinfor <- function(i) {
    coverage_cds[strand == '+', V1 := mapply(function(seqs, codon) toupper(substr(seqs, codon, codon + 2)), cds_seq, utr5_len + tss_extension + CDS_coordinate + (i * 3))]
    aatem <- coverage_cds[, list(V1, coverage)]
    setnames(aatem, "V1", paste0('position_', siteNames[as.character(i)]))
  }
  aa <- lapply(-2:3, mutialinfor)
  coverage_cds[, cds_seq := NULL]

  coverage_cds[, freq := 1]
  summary <- list()
  for (i in 1:length(aa)) {
    tem <- aa[[i]]
    pos <- names(tem)[which(names(tem) %like% 'position')]
    if (pos == "position_A") {
      codon_A_sites = tem[, position_A]
    }
    summary[[i]] <- setnames(tem[, sum(coverage), by = eval(as.character(pos))], c('codon', pos))
  }

  codon_usage <- Reduce(function(x, y) merge(x, y, all = TRUE), summary)
  codon_usage[is.na(codon_usage)] = 0
  codon_usage <- codon_usage[grepl('[ATGC]{3}', codon_usage$codon)]

  codon_usage[, baseline := rowMeans(codon_usage[, names(codon_usage) %like% 'position', with = FALSE][, paste0('position_', '+', c(1:3)), with = FALSE])]
  norm_codon_usage <- sapply(codon_usage[, names(codon_usage) %like% 'position', with = FALSE], function(x) x/codon_usage$baseline)
  codon_usage <- cbind(codon_usage[, 1], norm_codon_usage)
  codon_usage <- as.data.table(append(codon_usage, list(aminoacid = as.character(Biostrings::translate(DNAStringSet(codon_usage$codon)))), after = 1))

  coverage_cds$position_A <- codon_A_sites
  if (normalization == 'gene_avg_density') {
    stats <- coverage_cds[, sum(coverage), by = 'transcript_id']
    times <- coverage_cds[, sum(freq), by = 'transcript_id']
    coverage_cds[stats, total_rpf := i.V1, on = 'transcript_id']
    coverage_cds[times, times := i.V1, on = 'transcript_id']
    coverage_cds[, coverage := coverage/(total_rpf/times)]
  }

  codon_occuracy_matrix = coverage_cds[, .(list(coverage)), by = 'position_A']
  setnames(codon_occuracy_matrix, c("position_A", "V1"), c("codon", "occupacy_metric"))
  codon_usage[codon_occuracy_matrix, occupacy_metric := i.occupacy_metric, on = "codon" ]
  return(codon_usage)
}

usage <- codon_usage_count(coverage_cds = cov_list, d = 30, normalization = 'gene_avg_density', tss_extension = tss_extension)
usage <- usage[!is.nan(position_A)]

cat("[PROGRESS] 60% | Writing usage outputs...\n")
usage[, codon := gsub('T', 'U', codon)]
usage <- usage[aminoacid != '*']

# 移除 PDF 绘图循环，仅保留数据清理
usage[, occupacy_metric := NULL]
fwrite(usage, file = paste0(RESULT_DIR, "\\usage.txt"), sep = "\t")
invisible(gc())

# ==========================================
# Metacodon
# ==========================================
cat("[PROGRESS] 70% | Calculating codon occupancy...\n")
if (nrow(cov_list[totalcov > 20]) > 0) {
  cov_list <- cov_list[totalcov > 20]
}

codon_occupancy_profiles <- function(cov_list = NULL, transcript_seqs = NULL, tss_extension = NULL){
  coverage_cds <- cov_list
  coverage_cds <- coverage_cds[CDS_coordinate <= cds_len & cds_len > 61, ]

  txlens2 <- data.table::copy(txlens)
  setnames(txlens2, "tx_name", "transcript_id")
  tx_info <- merge(txlens2[, c("transcript_id", "cds_len", "utr5_len", "tx_len")],
                   transcript_seqs,
                   by = "transcript_id",
                   all.x = TRUE)
  tx_info[, start_codon := substr(seq, utr5_len + tss_extension + 1, utr5_len + tss_extension + 3)]
  tx_info <- tx_info[!is.na(start_codon) & startsWith(start_codon, "atg") & cds_len > 61]
  tx_info[, start_codon := NULL]

  if (nrow(tx_info) == 0) {
    return(data.table(codons_seq = character(), normalized_value = list()))
  }

  coverage_cds <- coverage_cds[transcript_id %in% tx_info$transcript_id]

  tmp <- coverage_cds[!is.na(codon),
                      .(list(CDS_coordinate), list(coverage), list(integer(ceiling(cds_len[[1]])))),
                      by = transcript_id]
  setnames(tmp, c('transcript_id', 'cdscor', 'coverage', 'occupancy'))
  profiles <- tmp[, {.(list(mapply(function(x, y, z) {tmp = unlist(x); tmp[y] = z; return(tmp)},
                                   x = occupancy, y = cdscor, z = coverage)))}, by = transcript_id]
  setnames(profiles, c('transcript_id', 'profile'))
  profiles[, profile := sapply(profile, as.integer)]

  profiles <- merge(x = profiles,
                    y = tx_info[, c("transcript_id", "cds_len", "utr5_len", "tx_len", "seq")],
                    by = "transcript_id",
                    all.x = TRUE)
  profiles[, "codon_seqs" := mapply(function(seq, i, j) {
    strsplit(gsub("([[:alnum:]]{3})", "\\1 ", substr(seq, i + 1, i + j)), " ")[[1]]
  }, seq, utr5_len + tss_extension, cds_len)]
  profiles[, seq := NULL]

  acc_sum <- new.env(parent = emptyenv())
  acc_n <- new.env(parent = emptyenv())
  codon_order <- character(0)

  add_window <- function(codon, window_vec, window_sum) {
    if (!is.finite(window_sum) || window_sum <= 20) return(invisible(FALSE))
    norm_vec <- window_vec * length(window_vec) / window_sum
    if (!exists(codon, envir = acc_sum, inherits = FALSE)) {
      assign(codon, norm_vec, envir = acc_sum)
      assign(codon, 1L, envir = acc_n)
      codon_order <<- c(codon_order, codon)
    } else {
      assign(codon, get(codon, envir = acc_sum, inherits = FALSE) + norm_vec, envir = acc_sum)
      assign(codon, get(codon, envir = acc_n, inherits = FALSE) + 1L, envir = acc_n)
    }
    invisible(TRUE)
  }

  if (nrow(profiles) == 0) {
    return(data.table(codons_seq = character(), normalized_value = list()))
  }

  for (i in seq_len(nrow(profiles))) {
    cs <- profiles$codon_seqs[[i]]
    x <- profiles$profile[[i]]
    if (length(x) < 61) next
    n_windows <- floor((length(x) - 61) / 3) + 1
    starts <- seq.int(1, by = 3, length.out = n_windows)
    idx_mat <- outer(0:60, starts, `+`)
    m <- matrix(x[idx_mat], nrow = n_windows, byrow = TRUE)
    csl <- length(cs) - 10
    if (length(11:csl) != nrow(m)) next
    codons_for_windows <- cs[11:csl]
    row_sums <- rowSums(m)
    idx <- which(row_sums > 20)
    if (length(idx) == 0) next
    for (j in idx) {
      add_window(codons_for_windows[j], m[j, ], row_sums[j])
    }
  }

  if (length(codon_order) == 0) {
    return(data.table(codons_seq = character(), normalized_value = list()))
  }

  normalized_value <- lapply(codon_order, function(codon) {
    get(codon, envir = acc_sum, inherits = FALSE) / get(codon, envir = acc_n, inherits = FALSE)
  })
  data.table(codons_seq = codon_order, normalized_value = normalized_value)
}

codon_occupancy <- codon_occupancy_profiles(cov_list = cov_list, transcript_seqs = transcript_seqs, tss_extension = tss_extension)

cat("[PROGRESS] 90% | Finalizing results...\n")

# 移除批量绘制 PDF 的 plot_metacodon 函数及 lapply 调用
fwrite(codon_occupancy, file = paste0(RESULT_DIR, "\\codon_occupancy.txt"), sep = "\t")

invisible(gc())
cat("[PROGRESS] 100% | Analysis complete.\n")
