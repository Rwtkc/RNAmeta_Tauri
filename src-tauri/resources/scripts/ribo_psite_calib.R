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
required_params <- c("bam", "txlens", "outdir", "species")
missing <- setdiff(required_params, names(params))
if (length(missing) > 0) {
  stop(paste("[ERROR] Missing required arguments:", paste(missing, collapse = ", ")))
}

BAM_FILE <- params$bam
TXLENS_FILE  <- params$txlens
RESULT_DIR <- params$outdir
SPECIES_NAME <- params$species

if (!dir.exists(RESULT_DIR)) dir.create(RESULT_DIR, recursive = TRUE)

load_to_var <- function(file_path) {
  temp_env <- new.env()
  vars <- load(file_path, envir = temp_env)
  return(temp_env[[vars[1]]])
}

psite_plot_data <- function(dt, species, result_dir) {
  cat("[PROGRESS] 30% | Calculating distribution (Vectorized)...\n")
  is_prokaryote <- species %in% c("ecoli_k12", "bsu_168", "pfu_dsm_3638", "hsa_NRC1")
  
  if(is_prokaryote) {
    dt[, `:=`(site_dist_end5 = end - start_pos, site_dist_end3 = end - stop_pos)]
  } else {
    dt[, `:=`(site_dist_end5 = start - start_pos, site_dist_end3 = start - stop_pos)]
  }
  
  res5 <- dt[site_dist_end5 %between% c(-25, 50), .N, by = .(qwidth, site_dist_end5)]
  setnames(res5, c("length", "distance", "reads"))
  all_coords5 <- CJ(length = unique(dt$qwidth), distance = -25:50)
  res5 <- res5[all_coords5, on = .(length, distance)][is.na(reads), reads := 0]
  
  res5 <- res5[order(length, distance)]
  setkey(res5, NULL)
  fwrite(res5[, .(distance, reads, length)], file = file.path(result_dir, "psite.txt"), sep="\t")
  
  cat("[PROGRESS] 50% | Aggregating Stop-codon regions...\n")
  res3 <- dt[site_dist_end3 %between% c(-50, 25), .N, by = .(qwidth, site_dist_end3)]
  setnames(res3, c("length", "distance", "reads"))
  all_coords3 <- CJ(length = unique(dt$qwidth), distance = -50:25)
  res3 <- res3[all_coords3, on = .(length, distance)][is.na(reads), reads := 0]
  
  res3 <- res3[order(length, distance)]
  setkey(res3, NULL)
  fwrite(res3[, .(distance, reads, length)], file = file.path(result_dir, "psite_stopcodon.txt"), sep = "\t")
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

psite_plot_data(reads, SPECIES_NAME, RESULT_DIR)
rpf_saturation_data(reads, RESULT_DIR)

cat("[PROGRESS] 90% | Calibrating offsets...\n")
psite_data <- fread(file.path(RESULT_DIR, "psite.txt"))
obj_sites <- c(-15, -14, -13, -12, -11, -10, -9)

offsets <- psite_data[distance %in% obj_sites, 
                      .(p_offset = if(sum(reads) > 0) abs(distance[which.max(reads)]) else 12), 
                      by = length]

fwrite(offsets[order(length)], file = file.path(RESULT_DIR, "offsets.conf.txt"), sep = "\t")
cat("[PROGRESS] 100% | Analysis complete.\n")
