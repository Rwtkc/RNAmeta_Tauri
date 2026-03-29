peak_exon_runtime_cache_env <- local({
  env <- new.env(parent = emptyenv())
  env$feature_bundle <- new.env(hash = TRUE, parent = emptyenv())
  env
})

peak_exon_feature_bundle_cache_key <- function(annotation_dir, species, species_id = NULL) {
  paste(
    normalizePath(annotation_dir, winslash = "/", mustWork = FALSE),
    species,
    if (is.null(species_id)) "" else species_id,
    sep = "|"
  )
}

peak_exon_cached_feature_bundle <- function(annotation_dir, species, species_id = NULL, builder) {
  key <- peak_exon_feature_bundle_cache_key(annotation_dir, species, species_id)
  cache <- peak_exon_runtime_cache_env$feature_bundle

  if (exists(key, envir = cache, inherits = FALSE)) {
    return(get(key, envir = cache, inherits = FALSE))
  }

  feature_bundle <- builder()
  assign(key, feature_bundle, envir = cache)
  feature_bundle
}
