import { useMemo, useState } from "react";
import type { RefineryAsset } from "../../types/Infrastructure";
import styles from "./RefineryReferenceTable.module.css";

interface RefineryReferenceTableProps {
  refineries: RefineryAsset[];
  onInspectRefinery: (asset: RefineryAsset) => void;
}

type SortKey = "name" | "capacity" | "country";
type SortDir = "asc" | "desc";

/**
 * Sortable MENA refinery reference grid. Pulls directly from the
 * already-shipped `/data/infrastructure/refineries.geojson` set — no
 * new dataset required. The sort state is local (we don't need to
 * sync it to the workspace reducer) and rows dispatch
 * `onInspectRefinery` so the user can jump from the reference grid
 * into the detail overlay / asset detail page.
 */
export function RefineryReferenceTable({
  refineries,
  onInspectRefinery
}: RefineryReferenceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("capacity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const list = [...refineries];
    list.sort((a, b) => compare(a, b, sortKey));
    if (sortDir === "desc") list.reverse();
    return list;
  }, [refineries, sortKey, sortDir]);

  const total = sorted.reduce((acc, r) => acc + (r.capacity_bpd ?? 0), 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>MIDDLE EAST REFINERY REFERENCE</span>
        <span className={styles.summary}>
          {sorted.length} SITES · {formatCapacity(total)} TOTAL BPD
        </span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortableHeader
              onClick={() => toggleSort("name", sortKey, sortDir, setSortKey, setSortDir)}
              label="NAME"
              active={sortKey === "name"}
              dir={sortDir}
            />
            <SortableHeader
              onClick={() => toggleSort("country", sortKey, sortDir, setSortKey, setSortDir)}
              label="COUNTRY"
              active={sortKey === "country"}
              dir={sortDir}
            />
            <SortableHeader
              onClick={() => toggleSort("capacity", sortKey, sortDir, setSortKey, setSortDir)}
              label="CAPACITY"
              active={sortKey === "capacity"}
              dir={sortDir}
              numeric
            />
            <th className={styles.operatorCell}>OPERATOR</th>
            <th className={styles.statusCell}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((refinery) => (
            <tr
              className={styles.row}
              key={refinery.id}
              onClick={() => onInspectRefinery(refinery)}
            >
              <td className={styles.nameCell}>{refinery.name}</td>
              <td className={styles.countryCell}>{refinery.countryName}</td>
              <td className={styles.capacityCell}>
                {refinery.capacity_bpd
                  ? `${formatCapacity(refinery.capacity_bpd)} BPD`
                  : "--"}
              </td>
              <td className={styles.operatorCell}>{refinery.operator ?? "--"}</td>
              <td className={styles.statusCell}>
                <span className={statusClass(refinery.status, styles)}>
                  {formatStatus(refinery.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  onClick,
  label,
  active,
  dir,
  numeric
}: {
  onClick: () => void;
  label: string;
  active: boolean;
  dir: SortDir;
  numeric?: boolean;
}) {
  return (
    <th className={numeric ? styles.numericHeader : undefined}>
      <button className={styles.sortButton} onClick={onClick} type="button">
        <span>{label}</span>
        <span className={styles.sortGlyph}>
          {active ? (dir === "asc" ? "▲" : "▼") : "·"}
        </span>
      </button>
    </th>
  );
}

function toggleSort(
  next: SortKey,
  current: SortKey,
  currentDir: SortDir,
  setKey: (k: SortKey) => void,
  setDir: (d: SortDir) => void
) {
  if (next === current) {
    setDir(currentDir === "asc" ? "desc" : "asc");
    return;
  }
  setKey(next);
  setDir(next === "capacity" ? "desc" : "asc");
}

function compare(a: RefineryAsset, b: RefineryAsset, key: SortKey): number {
  if (key === "capacity") {
    return (a.capacity_bpd ?? 0) - (b.capacity_bpd ?? 0);
  }
  if (key === "country") {
    return a.countryName.localeCompare(b.countryName);
  }
  return a.name.localeCompare(b.name);
}

function formatCapacity(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").toUpperCase();
}

function statusClass(status: string, stylesMap: Record<string, string>): string {
  if (status === "operational" || status === "operating") return stylesMap.statusGreen;
  if (status === "planned_maintenance") return stylesMap.statusYellow;
  if (status === "unplanned_incident") return stylesMap.statusRed;
  if (
    status === "mothballed" ||
    status === "retired" ||
    status === "cancelled" ||
    status === "shelved" ||
    status === "decommissioning"
  ) {
    return stylesMap.statusRed;
  }
  if (status === "construction" || status === "planned_startup" || status === "in_development") {
    return stylesMap.statusOrange;
  }
  return stylesMap.statusNeutral;
}
