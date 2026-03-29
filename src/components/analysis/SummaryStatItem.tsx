export function SummaryStatItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="meta-plot-summary-item">
      <span className="meta-plot-summary-item__label">{label}</span>
      <strong className="meta-plot-summary-item__value">{value}</strong>
    </div>
  );
}
