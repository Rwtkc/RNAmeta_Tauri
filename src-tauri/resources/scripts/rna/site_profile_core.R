site_profile_require_saved_upload <- function(upload_context, module_label) {
  saved_files <- upload_run_context_saved_files(upload_context)

  if (is.null(upload_context) || !length(saved_files)) {
    stop(sprintf("Save a BED file in Upload / Run before running %s.", module_label))
  }

  if (is.null(upload_context$species) || !nzchar(upload_context$species)) {
    stop(sprintf("A species must be saved in Upload / Run before running %s.", module_label))
  }

  saved_files
}

site_profile_load_annotation_bundle <- function(annotation_dir, species, species_id = NULL) {
  load_peak_distribution_annotation_bundle(
    annotation_dir = annotation_dir,
    species = species,
    species_id = species_id
  )
}

site_profile_load_txdb_features <- function(annotation_dir, species, species_id = NULL, minimal_component_length = 100) {
  peak_distribution_cached_txdb_features(
    annotation_dir = annotation_dir,
    species = species,
    species_id = species_id,
    minimal_component_length = minimal_component_length,
    builder = function() {
      annotation_bundle <- site_profile_load_annotation_bundle(
        annotation_dir = annotation_dir,
        species = species,
        species_id = species_id
      )
      peak_distribution_build_txdb_features(
        txdb = annotation_bundle$txdb,
        txlens_summary = annotation_bundle$txlens,
        minimal_component_length = minimal_component_length
      )
    }
  )
}

site_profile_heatmap_peaks <- function(peaks) {
  GenomicRanges::resize(peaks, width = 15, fix = "center")
}

site_profile_center_peaks <- function(peaks) {
  GenomicRanges::resize(peaks, width = 1, fix = "center")
}

site_profile_query_table <- function(query_ranges, sample_name) {
  peak_table <- data.table::as.data.table(query_ranges)
  peak_table[, index := .I]
  peak_table[, Sample := sample_name]
  peak_table
}

site_profile_empty_hits <- function(sample_name, feature_label, x_min, x_max, flank_size) {
  data.table::data.table(
    seqnames = character(),
    start = integer(),
    end = integer(),
    width = integer(),
    strand = character(),
    Sample = sample_name,
    feature = feature_label,
    rel_pos = numeric(),
    flankSize = flank_size,
    xmin = x_min,
    xmax = x_max
  )
}

site_profile_collect_boundary_hits <- function(query_ranges, windows, sample_name, feature_label, rel_offset, x_min, x_max, flank_size) {
  hits <- GenomicFeatures::mapToTranscripts(query_ranges, windows, ignore.strand = FALSE)

  if (!length(hits)) {
    return(site_profile_empty_hits(sample_name, feature_label, x_min, x_max, flank_size))
  }

  peak_table <- site_profile_query_table(query_ranges, sample_name)
  hits_table <- data.table::as.data.table(hits)
  data.table::setnames(hits_table, c("seqnames", "xHits"), c("transcriptID", "index"))

  peak_hits <- peak_table[hits_table, on = "index"]
  peak_hits[, c("index", "transcriptsHits") := NULL]
  peak_hits[, feature := feature_label]
  peak_hits[, rel_pos := i.start - rel_offset]
  peak_hits[, flankSize := flank_size]
  peak_hits[, xmin := x_min]
  peak_hits[, xmax := x_max]
  peak_hits
}

site_profile_prepare_transcription_windows <- function(species_key, txdb_features, txlens, flank_size = 1000) {
  site_profile_cached_boundary_windows("transcription", species_key, flank_size, function() {
    if (identical(species_key, "sce_R64")) {
      feature_tss <- BiocGenerics::unlist(txdb_features$fiveUTRs)
      feature_tes <- BiocGenerics::unlist(txdb_features$threeUTRs)
    } else {
      feature_tss <- BiocGenerics::unlist(txdb_features$cds)
      feature_tes <- BiocGenerics::unlist(txdb_features$cds)
    }

    coverage_tss <- GenomicRanges::flank(feature_tss, width = flank_size, start = TRUE, both = TRUE)
    coverage_tes <- GenomicRanges::flank(feature_tes, width = flank_size, start = FALSE, both = TRUE)
    tx_names <- unique(as.character(data.table::as.data.table(txlens)$tx_name))
    heatmap_tss <- coverage_tss[names(coverage_tss) %in% tx_names]
    heatmap_tes <- coverage_tes[names(coverage_tes) %in% tx_names]

    list(
      coverage_tss = coverage_tss,
      coverage_tes = coverage_tes,
      heatmap_tss = heatmap_tss,
      heatmap_tes = heatmap_tes,
      x_positions = seq(-flank_size + 1, flank_size),
      x_domain = c(-flank_size, flank_size - 1)
    )
  })
}

site_profile_prepare_translation_windows <- function(species_key, txlens, exons, flank_size = 100) {
  site_profile_cached_boundary_windows("translation", species_key, flank_size, function() {
    txlens_dt <- data.table::as.data.table(txlens)

    if (identical(species_key, "sce_R64")) {
      usable <- txlens_dt[cds_len > flank_size, .(tx_name, utr5_len, cds_len, utr3_len)]
      tss_ranges <- usable[, .(
        seqnames = tx_name,
        start = utr5_len + 1,
        end = utr5_len + flank_size,
        strand = "*"
      )]
      tes_ranges <- usable[, .(
        seqnames = tx_name,
        start = utr5_len + cds_len - flank_size + 1,
        end = utr5_len + cds_len,
        strand = "*"
      )]
      x_domain <- c(1, flank_size)
      x_positions <- seq_len(flank_size)
    } else {
      usable <- txlens_dt[utr5_len > flank_size & utr3_len > flank_size & cds_len > flank_size, .(tx_name, utr5_len, cds_len, utr3_len)]
      tss_ranges <- usable[, .(
        seqnames = tx_name,
        start = utr5_len + 1 - flank_size,
        end = utr5_len + 1 + flank_size,
        strand = "*"
      )]
      tes_ranges <- usable[, .(
        seqnames = tx_name,
        start = utr5_len + cds_len - flank_size,
        end = utr5_len + cds_len + flank_size,
        strand = "*"
      )]
      x_domain <- c(-flank_size, flank_size)
      x_positions <- seq(-flank_size + 1, flank_size + 1)
    }

    tss_windows <- GenomicRanges::makeGRangesFromDataFrame(tss_ranges, keep.extra.columns = TRUE)
    tes_windows <- GenomicRanges::makeGRangesFromDataFrame(tes_ranges, keep.extra.columns = TRUE)
    names(tss_windows) <- as.character(tss_ranges$seqnames)
    names(tes_windows) <- as.character(tes_ranges$seqnames)
    GenomeInfoDb::seqlevels(tss_windows) <- unique(c(GenomeInfoDb::seqlevels(tss_windows), names(exons)))
    GenomeInfoDb::seqlevels(tes_windows) <- unique(c(GenomeInfoDb::seqlevels(tes_windows), names(exons)))

    list(
      tss_windows = tss_windows,
      tes_windows = tes_windows,
      x_positions = x_positions,
      x_domain = x_domain
    )
  })
}

site_profile_prepare_splicesite_windows <- function(species_key, exons_by_tx, flank_size = 100) {
  site_profile_cached_boundary_windows("splicesite", species_key, flank_size, function() {
    exons_flat <- BiocGenerics::unlist(exons_by_tx)
    exons_flat <- exons_flat[IRanges::width(exons_flat) > flank_size]
    transcript_ranges <- BiocGenerics::unlist(range(exons_by_tx))

    ss5p <- GenomicRanges::GRanges(
      seqnames = GenomeInfoDb::seqnames(exons_flat),
      ranges = IRanges::IRanges(
        ifelse(as.character(GenomicRanges::strand(exons_flat)) == "+", BiocGenerics::end(exons_flat) + 1, BiocGenerics::start(exons_flat) - 1),
        ifelse(as.character(GenomicRanges::strand(exons_flat)) == "+", BiocGenerics::end(exons_flat) + 1, BiocGenerics::start(exons_flat) - 1)
      ),
      strand = GenomicRanges::strand(exons_flat)
    )
    names(ss5p) <- names(exons_flat)

    ss3p <- GenomicRanges::GRanges(
      seqnames = GenomeInfoDb::seqnames(exons_flat),
      ranges = IRanges::IRanges(
        ifelse(as.character(GenomicRanges::strand(exons_flat)) == "+", BiocGenerics::start(exons_flat) - 1, BiocGenerics::end(exons_flat) + 1),
        ifelse(as.character(GenomicRanges::strand(exons_flat)) == "+", BiocGenerics::start(exons_flat) - 1, BiocGenerics::end(exons_flat) + 1)
      ),
      strand = GenomicRanges::strand(exons_flat)
    )
    names(ss3p) <- names(exons_flat)

    transcript5p <- GenomicRanges::GRanges(
      seqnames = GenomeInfoDb::seqnames(transcript_ranges),
      ranges = IRanges::IRanges(
        ifelse(as.character(GenomicRanges::strand(transcript_ranges)) == "+", BiocGenerics::end(transcript_ranges) + 1, BiocGenerics::start(transcript_ranges) - 1),
        ifelse(as.character(GenomicRanges::strand(transcript_ranges)) == "+", BiocGenerics::end(transcript_ranges) + 1, BiocGenerics::start(transcript_ranges) - 1)
      ),
      strand = GenomicRanges::strand(transcript_ranges)
    )

    transcript3p <- GenomicRanges::GRanges(
      seqnames = GenomeInfoDb::seqnames(transcript_ranges),
      ranges = IRanges::IRanges(
        ifelse(as.character(GenomicRanges::strand(transcript_ranges)) == "+", BiocGenerics::start(transcript_ranges) - 1, BiocGenerics::end(transcript_ranges) + 1),
        ifelse(as.character(GenomicRanges::strand(transcript_ranges)) == "+", BiocGenerics::start(transcript_ranges) - 1, BiocGenerics::end(transcript_ranges) + 1)
      ),
      strand = GenomicRanges::strand(transcript_ranges)
    )

    ss5p <- ss5p[-S4Vectors::queryHits(GenomicRanges::findOverlaps(ss5p, transcript5p))]
    ss3p <- ss3p[-S4Vectors::queryHits(GenomicRanges::findOverlaps(ss3p, transcript3p))]

    windows_5p <- GenomicRanges::resize(
      GenomicRanges::flank(ss5p, width = flank_size, start = TRUE, both = FALSE),
      width = flank_size * 2,
      fix = "start"
    )
    windows_3p <- GenomicRanges::resize(
      GenomicRanges::flank(ss3p, width = 2 * flank_size, start = TRUE, both = FALSE),
      width = flank_size * 3,
      fix = "start"
    )

    list(
      windows_5p = windows_5p,
      windows_3p = windows_3p
    )
  })
}

site_profile_map_to_transcript_space <- function(source_file, species_key, peaks, exons, cache_tag = "default") {
  site_profile_cached_transcript_space_peaks(source_file, species_key, cache_tag = cache_tag, function() {
    transcript_peaks <- GenomicFeatures::mapToTranscripts(peaks, exons)
    if (length(transcript_peaks)) {
      GenomicRanges::strand(transcript_peaks) <- "*"
    }
    transcript_peaks
  })
}

site_profile_evenly_sample_windows <- function(windows, sample_n = 10000) {
  if (is.null(windows) || !length(windows) || length(windows) <= sample_n) {
    return(windows)
  }

  sampled_index <- unique(round(seq(1, length(windows), length.out = sample_n)))
  windows[sampled_index]
}

site_profile_score_matrix_rna <- function(target, windows) {
  window_seqlengths <- GenomeInfoDb::seqlengths(windows)
  inferred_seqlengths <- window_seqlengths

  if (!length(inferred_seqlengths)) {
    inferred_seqlengths <- numeric()
  }

  missing_seqlevels <- names(inferred_seqlengths)[is.na(inferred_seqlengths)]
  if (length(missing_seqlevels)) {
    window_dt <- data.table::data.table(
      seqname = as.character(GenomeInfoDb::seqnames(windows)),
      end = BiocGenerics::end(windows)
    )
    inferred_max_end <- window_dt[
      seqname %in% missing_seqlevels,
      .(seqlength = max(end, na.rm = TRUE)),
      by = seqname
    ]

    if (nrow(inferred_max_end)) {
      inferred_seqlengths[inferred_max_end$seqname] <- inferred_max_end$seqlength
    }
  }

  if (length(inferred_seqlengths)) {
    common_seqlevels <- intersect(GenomeInfoDb::seqlevels(target), names(inferred_seqlengths))
    valid_seqlevels <- common_seqlevels[!is.na(inferred_seqlengths[common_seqlevels])]

    if (length(valid_seqlevels)) {
      target_seqinfo <- GenomeInfoDb::seqinfo(target)
      GenomeInfoDb::seqlengths(target_seqinfo)[valid_seqlevels] <- inferred_seqlengths[valid_seqlevels]
      GenomeInfoDb::seqinfo(target) <- target_seqinfo
    }
  }

  target_rle <- GenomicRanges::coverage(target)

  if (length(unique(IRanges::width(windows))) > 1) {
    stop("width of 'windows' are not equal, provide 'windows' with equal widths")
  }

  windows_len <- length(windows)
  windows <- genomation::constrainRanges(target_rle, windows)
  if (length(windows) != windows_len) {
    warning(sprintf("%d windows fall off the target", windows_len - length(windows)))
  }

  chroms <- sort(intersect(names(target_rle), as.character(unique(GenomeInfoDb::seqnames(windows)))))
  views <- IRanges::Views(target_rle[chroms], as(windows, "IntegerRangesList")[chroms])
  matrix_list <- lapply(views, function(view_set) t(IRanges::viewApply(view_set, as.vector)))
  score_matrix <- do.call("rbind", matrix_list)

  if (!is.null(S4Vectors::mcols(windows)[, "X_rank", drop = TRUE])) {
    ranks <- unlist(split(S4Vectors::mcols(windows)[, "X_rank"], as.vector(GenomeInfoDb::seqnames(windows))))
    rownames(score_matrix) <- ranks
    minus_rows <- windows[GenomicRanges::strand(windows) == "-"]$X_rank
    if (length(minus_rows)) {
      score_matrix[rownames(score_matrix) %in% minus_rows, ] <- score_matrix[rownames(score_matrix) %in% minus_rows, ncol(score_matrix):1]
    }
    score_matrix <- score_matrix[order(ranks), , drop = FALSE]
  }

  score_matrix
}
