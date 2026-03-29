peak_distribution_feature_order <- function() {
  c("Promoter", "UTR5", "Start Codon", "CDS", "Stop Codon", "UTR3", "Intron", "Intergenic")
}

peak_distribution_annotation_priority <- function() {
  c("Stopcodon", "Startcodon", "CDS", "5UTR", "3UTR", "Intron", "Transcript", "Promoter", "Intergenic")
}

peak_distribution_default_controls <- function() {
  list(
    selected_features = peak_distribution_feature_order(),
    detail_output_dir = NULL
  )
}
