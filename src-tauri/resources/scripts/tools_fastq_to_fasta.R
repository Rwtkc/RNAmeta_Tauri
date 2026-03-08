#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(ShortRead)
  library(data.table)
  library(seqinr)
  library(R.utils)
})

args <- commandArgs(trailingOnly = TRUE)

parse_args <- function(args) {
  params <- list()
  for (i in seq(1, length(args), by = 2)) {
    key <- sub("^--", "", args[[i]])
    params[[key]] <- args[[i + 1]]
  }
  params
}

params <- parse_args(args)
required_params <- c("inputFastq", "outputFaGz")
missing <- setdiff(required_params, names(params))
if (length(missing) > 0) {
  stop(sprintf("[ERROR] Missing required arguments: %s", paste(missing, collapse = ", ")))
}

input_fastq <- params$inputFastq
output_fa_gz <- params$outputFaGz
summary_path <- params$summaryPath
trimlog_path <- params$trimlogPath

if (!file.exists(input_fastq)) {
  stop(sprintf("[ERROR] Input FASTQ not found: %s", input_fastq))
}

cat("[PROGRESS] Starting FASTQ to collapsed FASTA conversion...\n")

count_env <- new.env(hash = TRUE, parent = emptyenv())
streamer <- FastqStreamer(input_fastq, n = 250000L)
streamer_closed <- FALSE
on.exit(
  if (!streamer_closed) {
    try(close(streamer), silent = TRUE)
  },
  add = TRUE
)

total_reads <- 0L
chunk_index <- 0L

repeat {
  fq_chunk <- yield(streamer)
  if (length(fq_chunk) == 0L) {
    break
  }

  chunk_index <- chunk_index + 1L
  chunk_dt <- data.table(sequence = as.character(sread(fq_chunk)))[, .(count = .N), by = sequence]
  total_reads <- total_reads + length(fq_chunk)

  for (i in seq_len(nrow(chunk_dt))) {
    seq_key <- chunk_dt$sequence[[i]]
    current_count <- if (exists(seq_key, envir = count_env, inherits = FALSE)) {
      get(seq_key, envir = count_env, inherits = FALSE)
    } else {
      0L
    }
    assign(seq_key, current_count + chunk_dt$count[[i]], envir = count_env)
  }

  cat(sprintf(
    "[PROGRESS] Chunks processed: %d | reads=%d | unique=%d\n",
    chunk_index,
    total_reads,
    length(ls(count_env, all.names = TRUE))
  ))

  rm(fq_chunk, chunk_dt)
  if (chunk_index %% 4L == 0L) {
    invisible(gc(verbose = FALSE))
  }
}

try(close(streamer), silent = TRUE)
streamer_closed <- TRUE

all_sequences <- ls(count_env, all.names = TRUE)
if (length(all_sequences) == 0L) {
  stop("[ERROR] No sequences detected in trimmed FASTQ.")
}

seq_dt <- data.table(
  sequence = all_sequences,
  count = as.integer(unlist(mget(all_sequences, envir = count_env, inherits = FALSE), use.names = FALSE))
)
rm(all_sequences)
rm(count_env)
invisible(gc(verbose = FALSE))

setorder(seq_dt, -count, sequence)
seq_dt[, name := sprintf("seq%d_x%d", .I, count)]
unique_count <- nrow(seq_dt)

tmp_fasta <- tempfile(pattern = "collapsed_", fileext = ".fa")
fasta_sequences <- as.list(seq_dt$sequence)
fasta_names <- seq_dt$name
write.fasta(
  sequences = fasta_sequences,
  names = fasta_names,
  file.out = tmp_fasta
)
rm(fasta_sequences, fasta_names)
invisible(gc(verbose = FALSE))

cat(sprintf(
  "[PROGRESS] Writing collapsed FASTA with %d unique sequences...\n",
  unique_count
))

if (file.exists(output_fa_gz)) {
  unlink(output_fa_gz, force = TRUE)
}

gzip(tmp_fasta, destname = output_fa_gz, overwrite = TRUE)
unlink(tmp_fasta, force = TRUE)
rm(seq_dt, tmp_fasta)
invisible(gc(verbose = FALSE))

cleanup_targets <- c(input_fastq, summary_path, trimlog_path)
cleanup_targets <- cleanup_targets[!is.na(cleanup_targets) & nzchar(cleanup_targets)]
cleanup_targets <- cleanup_targets[file.exists(cleanup_targets)]
if (length(cleanup_targets) > 0) {
  invisible(file.remove(cleanup_targets))
}
rm(cleanup_targets)
invisible(gc(verbose = FALSE))

cat(sprintf(
  "[PROGRESS] Completed FASTA export. Reads=%d | unique=%d | output=%s\n",
  total_reads,
  unique_count,
  output_fa_gz
))
