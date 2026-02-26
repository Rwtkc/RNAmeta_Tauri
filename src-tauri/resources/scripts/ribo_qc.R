#!/usr/bin/env Rscript

# ==============================================================================
# RiboMeta Project - QC & Occupancy Analysis Script (V1.3.9)
# Principles: High-performance data.table operations with SE calculation.
# ==============================================================================

# --- Environment Configuration ---
options(bitmapType = 'cairo')
pdf(NULL) 

suppressPackageStartupMessages({
  library(GenomicAlignments)
  library(GenomicFeatures)
  library(data.table)
  library(ggplot2)
  library(cowplot)
  library(zoo)
  library(Rsamtools)
  library(ggpubr)
})

# --- Argument Parsing ---
parse_args <- function(args) {
  params <- list()
  for (i in seq(1, length(args), by = 2)) {
    key <- gsub("--", "", args[i])
    params[[key]] <- args[i + 1]
  }
  return(params)
}

# --- Helper Functions ---
load_to_var <- function(file_path) {
  temp_env <- new.env()
  vars <- load(file_path, envir = temp_env)
  return(temp_env[[vars[1]]])
}

set_offset_variable_optimized <- function(reads, offset_list, species) {
  dt_offsets <- data.table(
    len = as.integer(names(offset_list)), 
    p_off = as.integer(offset_list)
  )
  
  reads[dt_offsets, on = .(match_len = len), offset_val := i.p_off]
  valid_idx <- !is.na(reads$offset_val)
  
  # Coordinate correction for specific species/prokaryotes
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
# Core Execution Pipeline
# ==========================================

args <- commandArgs(trailingOnly = TRUE)
params <- parse_args(args)
required_params <- c("bam", "txlens", "offsets", "species", "outdir")
missing <- setdiff(required_params, names(params))

if (length(missing) > 0) {
  stop(paste("[ERROR] Missing required arguments:", paste(missing, collapse = ", ")))
}

BAM_FILE     <- params$bam
TXLENS_FILE  <- params$txlens
OFFSETS_FILE <- params$offsets
SPECIES_NAME <- params$species
RESULT_DIR   <- params$outdir

if (!dir.exists(RESULT_DIR)) dir.create(RESULT_DIR, recursive = TRUE)
setDTthreads(0) # Use all available cores

cat(paste("[INFO] Starting Analysis for species:", SPECIES_NAME, "\n"))

# 1. Load Reference Databases
cat("[PROGRESS] 10% | Loading reference genomic databases...\n")
txlens <- as.data.table(load_to_var(TXLENS_FILE))
txlens <- txlens[cds_len > 0]
txlens[, max_len := max(cds_len), by = gene_id]
txlens_max <- txlens[cds_len == max_len, .SD[1], by = gene_id]

offsets_table <- read.table(OFFSETS_FILE, header = TRUE)
offset_list <- offsets_table$p_offset + 3
names(offset_list) <- offsets_table$length

# TSS extension compensation for specific species
tss_extension <- if(SPECIES_NAME %in% c("sce_R64", "ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")) 25 else 0

# 2. Read BAM File
cat("[PROGRESS] 20% | Streaming BAM file (Optimized)...\n")
param <- ScanBamParam(
  flag = scanBamFlag(), 
  simpleCigar = FALSE, 
  reverseComplement = FALSE, 
  what = c("qname")
)
reads <- as.data.table(readGAlignments(BAM_FILE, index = paste0(BAM_FILE, ".bai"), param = param))
reads[, match_len := cigarWidthAlongQuerySpace(cigar, after.soft.clipping = TRUE)]
reads[, freq := as.numeric(sub(".*_x", "", qname))] # Extract unique read counts
invisible(gc())

# 3. Data Integration & P-site Mapping
cat("[PROGRESS] 30% | Merging reference and read datasets...\n")
tx_info_slim <- txlens[, .(transcript_id = tx_name, tx_len, utr5_len, cds_len, utr3_len)]
setnames(reads, "seqnames", "transcript_id")
reads <- merge(reads[strand == '+'], tx_info_slim, by = 'transcript_id')

cat("[PROGRESS] 40% | Executing Vectorized P-site Mapping...\n")
reads <- set_offset_variable_optimized(reads, offset_list, SPECIES_NAME)

reads[, `:=`(
  start_pos = utr5_len + 1L + tss_extension, 
  stop_pos  = utr5_len + cds_len + tss_extension
)]
reads[, `:=`(
  site_from_start = transcript_coordinate - start_pos, 
  site_from_stop  = transcript_coordinate - stop_pos
)]
reads[, psite_region := ifelse(site_from_start >= 0 & site_from_stop <= 0, "cds", 
                               ifelse(site_from_start < 0, "5utr", "3utr"))]

# 4. Periodicity (Frame) Statistics
cat("[PROGRESS] 50% | Generating Frame statistics...\n")
df_frame <- reads[start_pos != 0 & stop_pos != 0]
df_frame[, frame := site_from_start %% 3]
frame_df <- df_frame[, .(count = sum(freq)), by = .(frame, psite_region)]
frame_df[, region := factor(psite_region, levels = c("5utr", "cds", "3utr"), labels = c("5' UTR", "CDS", "3' UTR"))]
frame_df[, perc := count/sum(count), by = "region"]

fwrite(frame_df[, .(frame, region, count, perc)], file = file.path(RESULT_DIR, "frameStat.txt"), sep = "\t")

cat("[PROGRESS] 60% | Calculating Frame-by-Length distribution...\n")
frame_by_length_dt <- df_frame[psite_region == "cds", .(Frequency = sum(freq)), by = .(Length = match_len, Frame = frame)]
fwrite(frame_by_length_dt, file = file.path(RESULT_DIR, "frameStatByLength.txt"), sep = "\t")

# 5. Metagene Profiles
cat("[PROGRESS] 70% | Calculating Metagene Profiles (Start/Stop)...\n")
coverage_table <- reads[, .(coverage = sum(freq)), by = .(transcript_id, transcript_coordinate)]
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

df_meta <- coverage_table[cds_len >= 242 & gene_cov > 20]
if(nrow(df_meta) > 0) {
  start_tab <- df_meta[site_from_start >= -25 & site_from_start <= 120, 
                       .(reads = sum(coverage / gene_cov)), by = .(distance = site_from_start)][, reg := "start"]
  stop_tab  <- df_meta[site_from_stop >= -120 & site_from_stop <= 25, 
                       .(reads = sum(coverage / gene_cov)), by = .(distance = site_from_stop)][, reg := "stop"]
  fwrite(rbind(start_tab, stop_tab), file = file.path(RESULT_DIR, "psite_metaprofile.txt"), sep = "\t")
}

# 6. Ribosomal Occupancy Metrics (with Standard Error)
cat("[PROGRESS] 80% | Processing Ribosomal Occupancy metrics...\n")
coverage_table[, `:=`(CDS_coordinate = transcript_coordinate - utr5_len - tss_extension)]
coverage_table[, codon := ceiling(CDS_coordinate/3)]
coverage_table[, codon_val := coverage / gene_cov]

# --- 生成 coverage_mRNA.csv 以供 Codon 模块使用 ---
cat("[PROGRESS] 85% | Exporting coverage metadata...\n")
coverage_cds <- data.table::copy(coverage_table)
if (!"strand" %in% names(coverage_cds)) coverage_cds[, strand := "+"]

coverage_cds[, totalcov := sum(coverage), by = transcript_id]
coverage_cds[CDS_coordinate > 0 & CDS_coordinate <= cds_len, cds_cov := sum(coverage), by = transcript_id]

coverage_cds[, length_codon := ceiling(cds_len/3)]
coverage_cds[, codon := ceiling((CDS_coordinate)/3)]
coverage_cds[codon <= 0, codon := NA]

cov_codon <- coverage_cds[, sum(coverage), by = .(transcript_id, codon)]
coverage_cds[cov_codon, coverage_codon := i.V1, on = .(transcript_id, codon)]
coverage_cds[is.na(coverage_cds$coverage_codon), coverage_codon := 0]

fwrite(coverage_cds, file = file.path(RESULT_DIR, "coverage_mRNA.csv"))
rm(coverage_cds)
cov_list <- coverage_table[gene_cov > 20]

if(nrow(cov_list) > 0) {
  cat("[PROGRESS] 90% | Calculating Occupancy SE/Scientific metrics...\n")
  
  # 6.1 Bin Mode: Normalized position (0 to 1)
  peak_bin_raw <- cov_list[CDS_coordinate > 0 & CDS_coordinate <= cds_len, 
                           .(transcript_id, codon_val, rel_pos = (transcript_coordinate - utr5_len)/cds_len)]
  peak_bin <- peak_bin_raw[rel_pos >= 0 & rel_pos <= 1, 
                           .(Normalized_coverage = mean(codon_val), se = sd(codon_val)/sqrt(.N)), 
                           by = .(bin_pos = ceiling(rel_pos*100)*0.01)]
  fwrite(peak_bin, file = file.path(RESULT_DIR, "occupancy_metagene_bin.txt"), sep = "\t")
  
  # 6.2 Start Mode: First 100 codons
  peak_start <- cov_list[codon >= 1 & codon <= 100, 
                         .(Normalized_coverage = mean(codon_val), se = sd(codon_val)/sqrt(.N)), 
                         by = .(codon_coordinate = codon)]
  fwrite(peak_start, file = file.path(RESULT_DIR, "occupancy_metagene_start.txt"), sep = "\t")
  
  # 6.3 End Mode: Last 100 codons
  peak_end_raw <- cov_list[, length_codon := ceiling(cds_len/3)]
  peak_end <- peak_end_raw[codon >= (length_codon - 100) & codon <= length_codon, 
                           .(Normalized_coverage = mean(codon_val), se = sd(codon_val)/sqrt(.N)), 
                           by = .(codon_coordinate = codon - length_codon)]
  fwrite(peak_end, file = file.path(RESULT_DIR, "occupancy_metagene_end.txt"), sep = "\t")
}

cat("[PROGRESS] 100% | Analysis pipeline complete.\n")
invisible(gc())
