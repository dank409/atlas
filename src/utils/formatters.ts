const INTEGER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Daily volume with thousands separators, e.g. `400,000 BPD`. */
export function formatDailyVolume(value: number, unit: "BPD" | "BOE/D" = "BPD") {
  return `${INTEGER_FORMAT.format(value)} ${unit}`;
}

export function formatLengthKm(value: number) {
  return `${INTEGER_FORMAT.format(value)} KM`;
}

export function formatMtpa(value: number) {
  return `${value.toFixed(1)} MTPA`;
}

export function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}
