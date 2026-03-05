#!/usr/bin/env Rscript

# ==============================================================================
# RiboMeta Project - P-site Calibration & QC Script (V1.3.4 - Scientific Fix)
# Principles: Maximize performance while maintaining strict scientific accuracy.
# ==============================================================================

options(bitmapType = 'cairo')
pdf(NULL) 

suppressPackageStartupMessages({
  library(GenomicAlignments)
  library(GenomicFeatures)
  library(data.table)
  library(Rsamtools)
})

args <- commandArgs(trailingOnly = TRUE)
parse_args <- function(args) {
  params <- list()
  for (i in seq(1, length(args), by = 2)) {
    key <- gsub("--", "", args[i])
    params[[key]] <- args[i + 1]
  }
  return(params)
}

params <- parse_args(args)
required_params <- c("bam", "txlens", "outdir", "species", "seqType")
missing <- setdiff(required_params, names(params))
if (length(missing) > 0) {
  stop(paste("[ERROR] Missing required arguments:", paste(missing, collapse = ", ")))
}

BAM_FILE <- params$bam
TXLENS_FILE  <- params$txlens
RESULT_DIR <- params$outdir
SPECIES_NAME <- params$species
SEQ_TYPE <- tolower(params$seqType)

if (!(SEQ_TYPE %in% c("monosome", "disome"))) {
  stop("[ERROR] Invalid --seqType. Use 'monosome' or 'disome'.")
}

if (!dir.exists(RESULT_DIR)) dir.create(RESULT_DIR, recursive = TRUE)

load_to_var <- function(file_path) {
  temp_env <- new.env()
  vars <- load(file_path, envir = temp_env)
  return(temp_env[[vars[1]]])
}

psite_plot_data <- function(dt, species, seq_type, result_dir) {
  cat("[PROGRESS] 30% | Calculating distribution (Vectorized)...\n")
  is_prokaryote <- species %in% c("ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")
  start_window <- if (seq_type == "monosome") c(-25, 50) else c(-60, 50)
  stop_window <- if (seq_type == "monosome") c(-50, 25) else c(-60, 25)
  
  if(is_prokaryote) {
    dt[, `:=`(site_dist_end5 = end - start_pos, site_dist_end3 = end - stop_pos)]
  } else {
    dt[, `:=`(site_dist_end5 = start - start_pos, site_dist_end3 = start - stop_pos)]
  }
  
  res5 <- dt[site_dist_end5 %between% start_window, .N, by = .(qwidth, site_dist_end5)]
  setnames(res5, c("length", "distance", "reads"))
  all_coords5 <- CJ(length = unique(dt$qwidth), distance = start_window[1]:start_window[2])
  res5 <- res5[all_coords5, on = .(length, distance)][is.na(reads), reads := 0]
  
  res5 <- res5[order(length, distance)]
  setkey(res5, NULL)
  fwrite(res5[, .(distance, reads, length)], file = file.path(result_dir, "psite.txt"), sep="\t")
  
  cat("[PROGRESS] 50% | Aggregating Stop-codon regions...\n")
  res3 <- dt[site_dist_end3 %between% stop_window, .N, by = .(qwidth, site_dist_end3)]
  setnames(res3, c("length", "distance", "reads"))
  all_coords3 <- CJ(length = unique(dt$qwidth), distance = stop_window[1]:stop_window[2])
  res3 <- res3[all_coords3, on = .(length, distance)][is.na(reads), reads := 0]
  
  res3 <- res3[order(length, distance)]
  setkey(res3, NULL)
  fwrite(res3[, .(distance, reads, length)], file = file.path(result_dir, "psite_stopcodon.txt"), sep = "\t")
}

calibrate_offsets_with_local_peaks <- function(psite_data, seq_type) {
  target_sites <- if (seq_type == "monosome") -15:-9 else -55:-30
  default_offset <- if (seq_type == "monosome") 12L else 42L

  offsets <- lapply(sort(unique(psite_data$length)), function(len) {
    dt_len <- psite_data[length == len & distance <= 0, .(distance, reads)][order(distance)]
    if (nrow(dt_len) < 3) {
      return(data.table(length = len, p_offset = default_offset))
    }

    dt_len[, prev_reads := shift(reads, 1L, type = "lag")]
    dt_len[, next_reads := shift(reads, 1L, type = "lead")]

    local_peaks <- dt_len[
      !is.na(prev_reads) & !is.na(next_reads) & reads > prev_reads & reads > next_reads
    ]
    local_targets <- local_peaks[distance %in% target_sites]

    if (nrow(local_targets) == 0) {
      return(data.table(length = len, p_offset = default_offset))
    }

    best_distance <- local_targets$distance[which.max(local_targets$reads)]
    best_offset <- abs(best_distance)
    if (seq_type == "disome") {
      best_offset <- best_offset + 1L
    }

    data.table(length = len, p_offset = as.integer(best_offset))
  })

  rbindlist(offsets, use.names = TRUE)
}

rpf_saturation_data <- function(reads, result_dir) {
  cat("[PROGRESS] 70% | Sampling (Vectorized Discovery Algorithm)...\n")
  
  mapped_reads <- nrow(reads)
  total_gene_num <- uniqueN(reads$gene_id)
  
  gene_seq <- reads$gene_id[sample(mapped_reads)]
  first_discovery_ranks <- which(!duplicated(gene_seq))
  
  steps <- seq(0.1, 1.0, 0.1)
  nums <- as.integer(steps * mapped_reads)
  
  counts <- vapply(nums, function(n) sum(first_discovery_ranks <= n), integer(1))
  
  saturation <- data.table(
    site = seq_along(steps),
    num = nums,
    gene_num = counts,
    perc = steps,
    perc_gene = counts / total_gene_num
  )
  
  fwrite(saturation, file = file.path(result_dir, "saturation.gene.txt"), sep = "\t")
}


cat(paste("[INFO] Processing:", SPECIES_NAME, "\n"))
cat("[PROGRESS] 10% | Loading reference...\n")
txlens <- as.data.table(load_to_var(TXLENS_FILE))
tss_extension <- if(SPECIES_NAME %in% c("sce_R64", "ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")) 25 else 0

cat("[PROGRESS] 20% | Reading BAM (Optimized)...\n")
param <- ScanBamParam(
  flag = scanBamFlag(isUnmappedQuery = FALSE),
  what = c("rname", "pos", "qwidth", "cigar"),
  simpleCigar = FALSE 
)
bam_data <- scanBam(BAM_FILE, index = paste0(BAM_FILE, '.bai'), param = param)[[1]]
reads <- as.data.table(bam_data)
setnames(reads, c("rname", "pos"), c("transcriptID", "start"))
reads[, end := start + cigarWidthAlongReferenceSpace(cigar) - 1]
reads[, match_len := cigarWidthAlongQuerySpace(cigar, after.soft.clipping = TRUE)]
rm(bam_data); invisible(gc())

tx_info <- txlens[, .(tx_name, utr5_len, cds_len, gene_id)]
setnames(tx_info, "tx_name", "transcriptID")
reads <- merge(reads, tx_info, by = 'transcriptID')

reads[, `:=`(start_pos = utr5_len + 1 + tss_extension, 
             stop_pos = utr5_len + cds_len + tss_extension)]

psite_plot_data(reads, SPECIES_NAME, SEQ_TYPE, RESULT_DIR)
rpf_saturation_data(reads, RESULT_DIR)

cat("[PROGRESS] 90% | Calibrating offsets (local peaks)...\n")
calibration_file <- if (SEQ_TYPE == "monosome") "psite.txt" else "psite_stopcodon.txt"
psite_data <- fread(file.path(RESULT_DIR, calibration_file))
offsets <- calibrate_offsets_with_local_peaks(psite_data, SEQ_TYPE)

fwrite(offsets[order(length)], file = file.path(RESULT_DIR, "offsets.conf.txt"), sep = "\t")
cat("[PROGRESS] 100% | Analysis complete.\n")
