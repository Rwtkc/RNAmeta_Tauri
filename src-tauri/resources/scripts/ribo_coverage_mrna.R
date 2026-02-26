#!/usr/bin/env Rscript

options(bitmapType = "cairo")
pdf(NULL)

suppressPackageStartupMessages({
  library(data.table)
  library(Rsamtools)
  library(GenomicAlignments)
})

parse_args <- function(args) {
  params <- list()
  for (i in seq(1, length(args), by = 2)) {
    key <- gsub("--", "", args[i])
    params[[key]] <- args[i + 1]
  }
  return(params)
}

load_to_var <- function(file_path) {
  temp_env <- new.env()
  vars <- load(file_path, envir = temp_env)
  return(temp_env[[vars[1]]])
}

set_offset_optimized <- function(reads, offset_list, species) {
  dt_offsets <- data.table(len = as.integer(names(offset_list)), p_off = as.integer(offset_list))
  reads[dt_offsets, on = .(match_len = len), offset_val := i.p_off]
  valid_idx <- !is.na(reads$offset_val)

  if (species %in% c("ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")) {
    reads[valid_idx & strand == "+", transcript_coordinate := as.integer(end - (match_len - offset_val - 1))]
    reads[valid_idx & strand == "-", transcript_coordinate := as.integer(start + (match_len - offset_val - 1))]
  } else {
    reads[valid_idx & strand == "+", transcript_coordinate := as.integer(start + offset_val)]
    reads[valid_idx & strand == "-", transcript_coordinate := as.integer(end - offset_val)]
  }

  return(reads[!is.na(transcript_coordinate) & transcript_coordinate != 0])
}

args <- commandArgs(trailingOnly = TRUE)
params <- parse_args(args)

required_params <- c("coverage", "txlens", "species", "bam", "offsets")
missing <- setdiff(required_params, names(params))
if (length(missing) > 0) {
  stop(paste("[ERROR] Missing required arguments:", paste(missing, collapse = ", ")))
}

COVERAGE_FILE <- params$coverage
TXLENS_FILE <- params$txlens
SPECIES_NAME <- params$species
BAM_FILE <- params$bam
OFFSETS_FILE <- params$offsets

coverage_dir <- dirname(COVERAGE_FILE)
if (!dir.exists(coverage_dir)) {
  dir.create(coverage_dir, recursive = TRUE)
}

if (!file.exists(OFFSETS_FILE)) {
  stop(paste("[ERROR] Offsets file not found:", OFFSETS_FILE))
}

setDTthreads(0)
cat(paste("[INFO] Generating coverage_mRNA.csv for:", SPECIES_NAME, "\n"))
cat("[PROGRESS] 10% | Loading txlens reference...\n")

txlens <- as.data.table(load_to_var(TXLENS_FILE))
txlens <- txlens[cds_len > 0]

tss_extension <- if (SPECIES_NAME %in% c("sce_R64", "ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")) 25 else 0

cat("[PROGRESS] 25% | Reading BAM alignments...\n")
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

cat("[PROGRESS] 45% | Mapping P-site coordinates...\n")
tx_info_slim <- txlens[, .(transcript_id = tx_name, tx_len, utr5_len, cds_len, utr3_len)]
setnames(reads, "seqnames", "transcript_id")
reads <- merge(reads[strand == "+"], tx_info_slim, by = "transcript_id")
reads <- set_offset_optimized(reads, offset_list, SPECIES_NAME)

cat("[PROGRESS] 65% | Aggregating coverage metrics...\n")
coverage_table <- reads[, .(coverage = sum(freq)), by = .(transcript_id, transcript_coordinate, strand)]
coverage_table <- merge(coverage_table, tx_info_slim, by = "transcript_id")
coverage_table[, `:=`(
  start_pos = utr5_len + 1L + tss_extension,
  stop_pos = utr5_len + cds_len + tss_extension
)]
coverage_table[, `:=`(
  site_from_start = transcript_coordinate - start_pos - 3,
  site_from_stop = transcript_coordinate - stop_pos - 3
)]
coverage_table[, gene_cov := sum(coverage), by = transcript_id]
coverage_table[, CDS_coordinate := transcript_coordinate - utr5_len - tss_extension]
coverage_table[, codon := ceiling(CDS_coordinate / 3)]
coverage_table[codon <= 0, codon := NA]
coverage_table[, codon_val := coverage / gene_cov]

coverage_export <- copy(coverage_table)
coverage_export[, strand := "+"]
coverage_export[, totalcov := sum(coverage), by = transcript_id]
coverage_export[CDS_coordinate > 0 & CDS_coordinate <= cds_len, cds_cov := sum(coverage), by = transcript_id]
coverage_export[, length_codon := ceiling(cds_len / 3)]
coverage_export[, codon := ceiling((CDS_coordinate) / 3)]
coverage_export[codon <= 0, codon := NA]

cov_codon <- coverage_export[, sum(coverage), by = .(transcript_id, codon)]
coverage_export[cov_codon, coverage_codon := i.V1, on = .(transcript_id, codon)]
coverage_export[is.na(coverage_export$coverage_codon), coverage_codon := 0]

cat("[PROGRESS] 90% | Writing coverage_mRNA.csv...\n")
fwrite(coverage_export, file = COVERAGE_FILE)
cat("[PROGRESS] 100% | coverage_mRNA.csv generation complete.\n")
cat("[INFO] coverage_mRNA.csv generated.\n")
