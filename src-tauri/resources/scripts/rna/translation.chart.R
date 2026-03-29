translation_build_chart_payload <- function(density_data, heatmap_panels, sample_metadata) {
  density_titles <- translation_panel_titles()
  heatmap_samples <- lapply(sample_metadata, function(sample) {
    list(
      value = sample$display_name,
      label = sample$display_name
    )
  })
  density_panels <- lapply(names(density_titles), function(panel_key) {
    site_profile_density_panel(
      panel_title = density_titles[[panel_key]],
      panel_key = panel_key,
      density_data = density_data,
      sample_metadata = sample_metadata,
      x_domain = c(-100, 100),
      x_label = "Region around the site (0 and 5' -> 3' direction)",
      y_label = "Density"
    )
  })

  list(
    title = "Translation",
    hideTitle = TRUE,
    layout = "stacked",
    panels = c(density_panels, heatmap_panels),
    heatmapSamples = heatmap_samples,
    defaultHeatmapSample = if (length(heatmap_samples)) heatmap_samples[[1]]$value else NULL,
    legend = site_profile_legend_entries(sample_metadata)
  )
}
