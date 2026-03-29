`%||%` <- function(left, right) {
  if (is.null(left)) {
    right
  } else {
    left
  }
}

peak_distribution_runtime_cache_env <- local({
  env <- new.env(parent = emptyenv())
  env$annotation_bundle <- new.env(hash = TRUE, parent = emptyenv())
  env$txdb_features <- new.env(hash = TRUE, parent = emptyenv())
  env
})

peak_distribution_bundle_cache_key <- function(annotation_dir, species, species_id = NULL) {
  paste(normalizePath(annotation_dir, winslash = "/", mustWork = FALSE), species, species_id %||% "", sep = "|")
}

peak_distribution_cached_annotation_bundle <- function(annotation_dir, species, species_id = NULL, loader) {
  key <- peak_distribution_bundle_cache_key(annotation_dir, species, species_id)
  cache <- peak_distribution_runtime_cache_env$annotation_bundle

  if (exists(key, envir = cache, inherits = FALSE)) {
    return(get(key, envir = cache, inherits = FALSE))
  }

  bundle <- loader()
  assign(key, bundle, envir = cache)
  bundle
}

peak_distribution_cached_txdb_features <- function(annotation_dir, species, species_id = NULL, minimal_component_length = 100, builder) {
  key <- paste(
    peak_distribution_bundle_cache_key(annotation_dir, species, species_id),
    minimal_component_length,
    sep = "|"
  )
  cache <- peak_distribution_runtime_cache_env$txdb_features

  if (exists(key, envir = cache, inherits = FALSE)) {
    return(get(key, envir = cache, inherits = FALSE))
  }

  features <- builder()
  assign(key, features, envir = cache)
  features
}
