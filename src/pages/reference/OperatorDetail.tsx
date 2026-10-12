import { DetailCard, type DetailCardRow } from "../../components/common/DetailCard";
import { MAP_DATA_SOURCES } from "../../constants/datasetCatalog";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import type { NavigateReference } from "../../types/View";
import { formatDailyVolume, formatLengthKm } from "../../utils/formatters";
import type { OperatorEntry } from "../../utils/referenceIndex";
import { AssetGroups, DetailSection, LinkChips } from "./referenceParts";
import styles from "./referenceParts.module.css";

interface OperatorDetailProps {
  /** Country names by code, for the country links. */
  countryNameByCode: Record<string, string>;
  onNavigate: NavigateReference;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  /** Open the map filtered to this operator. */
  onShowOnMap: () => void;
  operator: OperatorEntry;
}

/**
 * One operator as the source data names it: where it has assets, what
 * they are, and a background note for the few operators that have one.
 * Spelling variants of a name are merged; subsidiaries stay separate.
 */
export function OperatorDetail({
  countryNameByCode,
  onNavigate,
  onSelectAsset,
  onShowOnMap,
  operator
}: OperatorDetailProps) {
  const rows: DetailCardRow[] = [
    { label: "Assets on map", value: String(operator.assets.length) },
    ...(operator.refiningCapacityBpd > 0
      ? [{ label: "Refining cap.", value: formatDailyVolume(operator.refiningCapacityBpd) }]
      : []),
    ...(operator.pipelineLengthKm > 0
      ? [{ label: "Pipeline length", value: formatLengthKm(operator.pipelineLengthKm) }]
      : [])
  ];

  return (
    <DetailCard
      action={{ label: "SHOW ON MAP ▸", onClick: onShowOnMap }}
      footer={`SOURCES: ${[MAP_DATA_SOURCES, operator.profile?.source].filter(Boolean).join(" · ")}`}
      kind="OPERATOR"
      name={operator.name}
      rows={rows}
    >
      <DetailSection title="COUNTRIES">
        <LinkChips
          chips={operator.countryCodes.map((code) => ({
            id: code,
            label: countryNameByCode[code] ?? code,
            onClick: () => onNavigate("countries", code)
          }))}
          emptyText="--"
        />
      </DetailSection>

      {operator.profile ? (
        <DetailSection title="BACKGROUND">
          <p className={styles.prose}>{operator.profile.summary}</p>
          <p className={styles.prose}>
            <span className={styles.proseLabel}>BASED IN</span>
            {operator.profile.domicile} · {operator.profile.website}
          </p>
        </DetailSection>
      ) : null}

      <AssetGroups assets={operator.assets} onSelectAsset={onSelectAsset} />
    </DetailCard>
  );
}
