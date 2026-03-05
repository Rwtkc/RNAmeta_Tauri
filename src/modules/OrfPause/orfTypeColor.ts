const FIXED_ORF_TYPE_COLORS: Record<string, string> = {
  canonical: "#0ea5e9",
  truncation: "#f97316",
  internal: "#22c55e",
  extension: "#8b5cf6",
  dorf: "#0284c7",
  uorf: "#475569",
  odorf: "#64748b",
  ouorf: "#7c3aed",
  readthrough: "#0f766e",
  seqerror: "#dc2626",
  unknown: "#94a3b8",
};

const normalize = (orfType: string): string => {
  const v = (orfType || "").trim().toLowerCase();
  return v.length > 0 ? v : "unknown";
};

const hashToHue = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
};

export const getOrfTypeColor = (orfType: string): string => {
  const key = normalize(orfType);
  const fixed = FIXED_ORF_TYPE_COLORS[key];
  if (fixed) return fixed;

  const hue = hashToHue(key);
  return `hsl(${hue} 65% 48%)`;
};

