import { DetailCard } from "../../components/common/DetailCard";
import { MAP_DATA_SOURCES } from "../../constants/datasetCatalog";
import type { CrudeGrade } from "../../types/CrudeGrade";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import type { NavigateReference } from "../../types/View";
import { formatDailyVolume } from "../../utils/formatters";
import { countByDataset } from "../../utils/infrastructure";
import { findMentionedAssets, type CountryEntry, type OperatorEntry } from "../../utils/referenceIndex";
import { AssetGroups, AssetLinkList, DetailSection, LinkChips } from "./referenceParts";
import styles from "./referenceParts.module.css";

interface CountryDetailProps {
  country: CountryEntry;
  /** Grades in the crude grade table produced by this country. */
  grades: CrudeGrade[];
  /** Every country name, so a note saying "Yemen" does not link to "Yemen LNG Terminal". */
  ignoredMentionNames: string[];
  onNavigate: NavigateReference;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  /** Open the map filtered to this country. */
  onShowOnMap: () => void;
  /** Operators with assets here, most assets first. */
  operators: OperatorEntry[];
}

const MAX_OPERATOR_CHIPS = 8;

/**
 * Everything the app knows about one country: what the datasets hold for
 * it, a background note, and links to its crude grades, operators and
 * individual assets.
 */
export function CountryDetail({
  country,
  grades,
  ignoredMentionNames,
  onNavigate,
  onSelectAsset,
  onShowOnMap,
  operators
}: CountryDetailProps) {
  const counts = countByDataset(country.assets);
  const { profile } = country;
  const mentionedAssets = profile
    ? findMentionedAssets(
        [profile.summary, profile.exportRoutes, ...(profile.keyExportTerminals ?? [])].join(". "),
        country.assets,
        ignoredMentionNames
      )
    : [];
  const hiddenOperatorCount = Math.max(0, operators.length - MAX_OPERATOR_CHIPS);

  return (
    <DetailCard
      action={country.assets.length > 0 ? { label: "SHOW ON MAP ▸", onClick: onShowOnMap } : undefined}
      footer={`SOURCES: ${[MAP_DATA_SOURCES, profile?.source].filter(Boolean).join(" · ")}`}
      kind="COUNTRY"
      name={country.name}
      rows={[
        {
          label: "Refineries",
          value:
            counts.refineries > 0
              ? `${counts.refineries} · ${formatDailyVolume(country.refiningCapacityBpd)}`
              : "0"
        },
        { label: "Pipelines", value: String(counts.pipelines) },
        { label: "Fields", value: String(counts.fields) },
        { label: "LNG terminals", value: String(counts.terminals) }
      ]}
    >
      <DetailSection title="BACKGROUND">
        {profile ? (
          <>
            <p className={styles.prose}>{profile.summary}</p>
            <p className={styles.prose}>
              <span className={styles.proseLabel}>EXPORT ROUTES</span>
              {profile.exportRoutes}
            </p>
            {profile.keyExportTerminals?.length ? (
              <p className={styles.prose}>
                <span className={styles.proseLabel}>PORTS AND TERMINALS NAMED</span>
                {profile.keyExportTerminals.join(" · ")}
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.empty}>No background note has been written for this country.</p>
        )}
      </DetailSection>

      {mentionedAssets.length > 0 ? (
        <DetailSection title="NAMED IN THE NOTE, ON THE MAP">
          <AssetLinkList assets={mentionedAssets} limit={8} onSelectAsset={onSelectAsset} showType />
        </DetailSection>
      ) : null}

      <DetailSection title="CRUDE GRADES">
        <LinkChips
          chips={grades.map((grade) => ({
            id: grade.id,
            label: grade.name,
            onClick: () => onNavigate("grades", grade.id)
          }))}
          emptyText="None in the crude grade table."
        />
      </DetailSection>

      <DetailSection title={`OPERATORS (${operators.length})`}>
        <LinkChips
          chips={operators.slice(0, MAX_OPERATOR_CHIPS).map((operator) => ({
            id: operator.id,
            label: `${operator.name} (${operator.assets.filter((asset) => country.assets.includes(asset)).length})`,
            onClick: () => onNavigate("operators", operator.id)
          }))}
          emptyText="No named operators in the map data."
        />
        {hiddenOperatorCount > 0 ? (
          <p className={styles.empty}>and {hiddenOperatorCount} more with fewer assets, listed in the Operators tab.</p>
        ) : null}
      </DetailSection>

      <AssetGroups assets={country.assets} onSelectAsset={onSelectAsset} />
    </DetailCard>
  );
}
