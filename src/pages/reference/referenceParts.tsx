import { useState, type ReactNode } from "react";
import type { DatasetId, InfrastructureAsset } from "../../types/Infrastructure";
import {
  formatPrimaryMetric,
  getAssetDisplayName,
  getAssetTypeLabel,
  sortByPrimaryMetric
} from "../../utils/infrastructure";
import styles from "./referenceParts.module.css";

// Building blocks shared by the country, operator and crude grade detail
// cards. Each one is a way of linking out: to another reference entry
// (chips) or to an asset on the map (asset lists).

interface DetailSectionProps {
  title: string;
  children: ReactNode;
}

export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export interface LinkChip {
  id: string;
  label: string;
  onClick: () => void;
}

/** A row of links to other reference entries. */
export function LinkChips({ chips, emptyText }: { chips: LinkChip[]; emptyText: string }) {
  if (chips.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  return (
    <ul className={styles.chips}>
      {chips.map((chip) => (
        <li key={chip.id}>
          <button className={styles.chip} onClick={chip.onClick} type="button">
            {chip.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface AssetLinkListProps {
  assets: InfrastructureAsset[];
  /** Rows shown before the "show all" toggle. */
  limit?: number;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  /** Show REFINERY / FIELD / … beside each name, for lists that mix layers. */
  showType?: boolean;
}

/** Assets as links: clicking one selects it and opens the map on it. */
export function AssetLinkList({ assets, limit = 5, onSelectAsset, showType = false }: AssetLinkListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shown = isExpanded ? assets : assets.slice(0, limit);

  return (
    <>
      <ul className={styles.assetList}>
        {shown.map((asset) => (
          <li key={asset.id}>
            <button className={styles.assetLink} onClick={() => onSelectAsset(asset)} type="button">
              <span className={styles.assetName}>{getAssetDisplayName(asset)}</span>
              <span className={styles.assetMeta}>{showType ? getAssetTypeLabel(asset) : formatPrimaryMetric(asset)}</span>
            </button>
          </li>
        ))}
      </ul>
      {assets.length > limit ? (
        <button className={styles.toggle} onClick={() => setIsExpanded((current) => !current)} type="button">
          {isExpanded ? "SHOW FEWER" : `SHOW ALL ${assets.length}`}
        </button>
      ) : null}
    </>
  );
}

const LAYER_GROUPS: Array<{ datasetId: DatasetId; title: string }> = [
  { datasetId: "refineries", title: "REFINERIES" },
  { datasetId: "terminals", title: "LNG TERMINALS" },
  { datasetId: "fields", title: "OIL & GAS FIELDS" },
  { datasetId: "pipelines", title: "PIPELINES" }
];

/**
 * An entry's assets, one linked list per layer, largest first. Layers the
 * entry has nothing in are left out.
 */
export function AssetGroups({
  assets,
  onSelectAsset
}: {
  assets: InfrastructureAsset[];
  onSelectAsset: (asset: InfrastructureAsset) => void;
}) {
  const groups = LAYER_GROUPS.map((group) => ({
    ...group,
    assets: sortByPrimaryMetric(assets.filter((asset) => asset.datasetId === group.datasetId))
  })).filter((group) => group.assets.length > 0);

  if (groups.length === 0) {
    return (
      <DetailSection title="ON THE MAP">
        <p className={styles.empty}>Nothing in the datasets used for this map.</p>
      </DetailSection>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <DetailSection key={group.datasetId} title={`${group.title} ON THE MAP (${group.assets.length})`}>
          <AssetLinkList assets={group.assets} onSelectAsset={onSelectAsset} />
        </DetailSection>
      ))}
    </>
  );
}
