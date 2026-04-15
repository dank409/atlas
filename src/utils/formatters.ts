export function formatCapacity(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} bpd`;
}

export function formatCapacityCompact(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} MM B/D`;
  }

  return `${new Intl.NumberFormat("en-US").format(value)} B/D`;
}

export function formatLengthKm(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} km`;
}

export function formatTransitVolume(value: number) {
  return `${value.toFixed(1)} MM B/D`;
}

export function formatMtpa(value: number) {
  return `${value.toFixed(1)} MTPA`;
}

export function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}
