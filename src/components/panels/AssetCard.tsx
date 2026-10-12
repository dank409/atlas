import { DetailCard, type DetailCardRow } from "../common/DetailCard";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import { ENERGY_LABELS, getEnergyType } from "../../utils/assetEnergy";
import { formatDailyVolume, formatLengthKm, formatMtpa, formatStatusLabel } from "../../utils/formatters";
import { getAssetTypeLabel } from "../../utils/infrastructure";

interface AssetCardProps {
  asset: InfrastructureAsset;
  onClear: () => void;
  /** Open the asset's country in the Reference view. */
  onOpenCountry: () => void;
  /** Open the asset's operator in the Reference view. Omitted when the source names none. */
  onOpenOperator?: () => void;
  /** Shown as a button when the card is open somewhere other than the map. */
  onShowOnMap?: () => void;
}

/** Detail card for the selected asset: the fields its source dataset carries for it. */
export function AssetCard({ asset, onClear, onOpenCountry, onOpenOperator, onShowOnMap }: AssetCardProps) {
  return (
    <DetailCard
      action={onShowOnMap ? { label: "SHOW ON MAP ▸", onClick: onShowOnMap } : undefined}
      closeLabel="Clear selection"
      footer={`SOURCE: ${asset._metadata.source} · ${asset._metadata.downloadDate}`}
      kind={getAssetTypeLabel(asset)}
      name={asset.name}
      onClose={onClear}
      rows={buildRows(asset, { onOpenCountry, onOpenOperator })}
    />
  );
}

function buildRows(
  asset: InfrastructureAsset,
  links: { onOpenCountry: () => void; onOpenOperator?: () => void }
): DetailCardRow[] {
  const countryRow: DetailCardRow = {
    label: "Country",
    onClick: links.onOpenCountry,
    value: asset.countryName || "--"
  };
  const energyRow: DetailCardRow = { label: "Energy", value: ENERGY_LABELS[getEnergyType(asset)].toUpperCase() };
  // The operator entry is linked from whichever of operator / owner the
  // dataset fills in for this asset kind (see `getAssetOperator`).
  const company = (label: string, value: string | null | undefined): DetailCardRow => ({
    label,
    onClick: value ? links.onOpenOperator : undefined,
    value: value || "--"
  });
  const status = (value: string): DetailCardRow => ({ label: "Status", value: formatStatusLabel(value) });

  if (asset.assetKind === "refinery") {
    return [
      countryRow,
      energyRow,
      { label: "Capacity", value: asset.capacity_bpd ? formatDailyVolume(asset.capacity_bpd) : "--" },
      company("Operator", asset.operator),
      { label: "Lat / lon", value: formatCoordinates(asset.lat, asset.lon) }
    ];
  }

  if (asset.assetKind === "pipeline") {
    return [
      ...(asset.segmentName ? [{ label: "Segment", value: asset.segmentName }] : []),
      countryRow,
      energyRow,
      {
        label: "Capacity",
        value: asset.capacity_boed ? formatDailyVolume(asset.capacity_boed, "BOE/D") : "--"
      },
      { label: "Length", value: asset.length_km ? formatLengthKm(asset.length_km) : "--" },
      { label: "Diameter", value: asset.diameter_inches ? `${asset.diameter_inches} IN` : "--" },
      { label: "Route", value: [asset.startPoint, asset.endPoint].filter(Boolean).join(" → ") || "--" },
      company("Owner", asset.owner),
      status(asset.status)
    ];
  }

  if (asset.assetKind === "field") {
    return [
      countryRow,
      energyRow,
      {
        label: "Production",
        value: asset.production_bpd ? formatDailyVolume(asset.production_bpd, "BOE/D") : "--"
      },
      company("Operator", asset.operator),
      { label: "Basin", value: asset.basin || "--" },
      status(asset.status),
      { label: "Lat / lon", value: formatCoordinates(asset.lat, asset.lon) }
    ];
  }

  return [
    countryRow,
    energyRow,
    { label: "Role", value: asset.terminalRole ? `LNG ${asset.terminalRole.toUpperCase()}` : "--" },
    { label: "Capacity", value: asset.capacity_mtpa ? formatMtpa(asset.capacity_mtpa) : "--" },
    // Operator is the name the operator index uses when both are given.
    asset.operator ? { label: "Owner", value: asset.owner || "--" } : company("Owner", asset.owner),
    company("Operator", asset.operator),
    status(asset.status),
    { label: "Lat / lon", value: formatCoordinates(asset.lat, asset.lon) }
  ];
}

function formatCoordinates(lat: number, lon: number) {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}
