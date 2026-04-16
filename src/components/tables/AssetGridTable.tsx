import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import type { AssetGridRow, DatasetId, InfrastructureAsset } from "../../types/Infrastructure";
import {
  formatCapacityCompact,
  formatMtpa,
  formatStatusLabel
} from "../../utils/formatters";
import styles from "./AssetGridTable.module.css";

interface AssetGridTableProps {
  activeDatasetCount: number;
  gridDatasetId?: DatasetId | null;
  latestUpdate: string;
  /**
   * Row click handler. When `onInspectAsset` is provided the table
   * routes clicks there instead of `onSelectAsset`, giving the caller
   * a chance to open a detail overlay (the new Bloomberg-selector
   * pattern) before — or instead of — a map fly-to.
   */
  onInspectAsset?: (asset: InfrastructureAsset) => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  rows: AssetGridRow[];
  selectedAssetId: string | null;
}

type GridDatasetMode = DatasetId | "mixed";

export function AssetGridTable({
  activeDatasetCount,
  gridDatasetId,
  latestUpdate,
  onInspectAsset,
  onSelectAsset,
  rows,
  selectedAssetId
}: AssetGridTableProps) {
  const datasetMode = useMemo(() => resolveDatasetMode(rows, gridDatasetId), [gridDatasetId, rows]);
  const columns = useMemo(() => buildColumns(datasetMode), [datasetMode]);
  const [sorting, setSorting] = useState<SortingState>(() => defaultSortingFor(datasetMode));

  useEffect(() => {
    setSorting(defaultSortingFor(datasetMode));
  }, [datasetMode]);

  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting
    }
  });

  if (!rows.length) {
    return <div className={styles.emptyState}>NO VISIBLE ASSETS FOR THE CURRENT LAYER SELECTION.</div>;
  }

  return (
    <div className={styles.gridShell}>
      <div className={styles.metaRow}>
        <span>ROWS: {rows.length}</span>
        <span className={styles.separator}>|</span>
        <span>DATASETS: {activeDatasetCount}</span>
        <span className={styles.separator}>|</span>
        <span>GRID: {datasetMode === "mixed" ? "MIXED" : datasetMode.toUpperCase()}</span>
        <span className={styles.separator}>|</span>
        <span>UPDATED: {latestUpdate}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col key={column.id} style={column.columnDef.meta?.width ? { width: column.columnDef.meta.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta;
                  const label = meta?.label ?? header.column.id.toUpperCase();
                  const isNumeric = meta?.numeric === true;

                  return (
                    <th className={isNumeric ? styles.numericCell : undefined} key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          aria-label={`SORT BY ${label}`}
                          className={styles.sortButton}
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          <span className={styles.sortIndicator}>
                            {sortDirection === "asc" ? "▲" : sortDirection === "desc" ? "▼" : "·"}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                className={row.original.asset.id === selectedAssetId ? styles.selectedRow : undefined}
                key={row.id}
                onClick={() =>
                  onInspectAsset
                    ? onInspectAsset(row.original.asset)
                    : onSelectAsset(row.original.asset)
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const isNumeric = cell.column.columnDef.meta?.numeric === true;
                  return (
                    <td className={isNumeric ? styles.numericCell : undefined} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    label?: string;
    width?: string;
    numeric?: boolean;
  }
}

function resolveDatasetMode(rows: AssetGridRow[], gridDatasetId?: DatasetId | null): GridDatasetMode {
  if (gridDatasetId) {
    return gridDatasetId;
  }

  const datasetIds = Array.from(new Set(rows.map((row) => row.asset.datasetId)));
  return datasetIds.length === 1 ? datasetIds[0] : "mixed";
}

function defaultSortingFor(datasetMode: GridDatasetMode): SortingState {
  if (datasetMode === "refineries" || datasetMode === "fields" || datasetMode === "terminals") {
    return [{ id: "name", desc: false }];
  }

  if (datasetMode === "pipelines") {
    return [{ id: "capacity", desc: true }];
  }

  if (datasetMode === "chokepoints") {
    return [{ id: "transit", desc: true }];
  }

  return [{ id: "name", desc: false }];
}

function buildColumns(datasetMode: GridDatasetMode): Array<ColumnDef<AssetGridRow>> {
  // Trimmed to the four essentials a trader scans for at a glance:
  // identity, geography, the one numeric that matters, and status.
  // Every other field (operator, owner, reference, hydrocarbon, etc.)
  // lives in the detail overlay that opens on row click — so the grid
  // stays readable at any panel width, and the overlay becomes the
  // single drill-down destination (Bloomberg selector pattern).
  if (datasetMode === "refineries") {
    return [
      textColumn("name", "NAME", (row) => row.name, undefined, "44%"),
      textColumn("country", "COUNTRY", (row) => row.countryName, undefined, "20%"),
      numericColumn("capacity", "CAPACITY", (row) => getRefineryCapacity(row), (row) => formatCapacityCompact(getRefineryCapacity(row)), "18%"),
      statusColumn("status", "STATUS", (row) => row.status.toUpperCase(), "18%")
    ];
  }

  if (datasetMode === "pipelines") {
    return [
      textColumn("name", "NAME", (row) => row.name, undefined, "44%"),
      textColumn("country", "COUNTRY", (row) => row.countryName, undefined, "20%"),
      numericColumn("capacity", "CAPACITY", (row) => getPipelineCapacity(row), (row) => row.primaryMetric, "18%"),
      statusColumn("status", "STATUS", (row) => row.status.toUpperCase(), "18%")
    ];
  }

  if (datasetMode === "fields") {
    return [
      textColumn("name", "NAME", (row) => row.name, undefined, "44%"),
      textColumn("country", "COUNTRY", (row) => row.countryName, undefined, "20%"),
      numericColumn("production", "PRODUCTION", (row) => getFieldProduction(row), (row) =>
        getFieldProduction(row) ? formatCapacityCompact(getFieldProduction(row)) : "--", "18%"
      ),
      statusColumn("status", "STATUS", (row) => row.status.toUpperCase(), "18%")
    ];
  }

  if (datasetMode === "terminals") {
    return [
      textColumn("name", "NAME", (row) => row.name, undefined, "44%"),
      textColumn("country", "COUNTRY", (row) => row.countryName, undefined, "20%"),
      numericColumn("capacity", "CAPACITY", (row) => getTerminalCapacity(row), (row) =>
        getTerminalMtpa(row) ? formatMtpa(getTerminalMtpa(row)) : row.primaryMetric, "18%"
      ),
      statusColumn("status", "STATUS", (row) => row.status.toUpperCase(), "18%")
    ];
  }

  if (datasetMode === "chokepoints") {
    return [
      textColumn("name", "NAME", (row) => row.name, undefined, "44%"),
      textColumn("country", "COUNTRY", (row) => row.countryName, undefined, "20%"),
      numericColumn("transit", "TRANSIT", (row) => getChokepointTransit(row), (row) => row.primaryMetric, "18%"),
      statusColumn("status", "STATUS", (row) => row.status.toUpperCase(), "18%")
    ];
  }

  return [
    textColumn("name", "NAME", (row) => row.name, undefined, "40%"),
    textColumn("dataset", "DATASET", (row) => row.datasetLabel, undefined, "18%"),
    textColumn("country", "COUNTRY", (row) => row.countryName, undefined, "18%"),
    textColumn("metric", "METRIC", (row) => row.primaryMetric, undefined, "24%")
  ];
}

const STATUS_PILL_COLORS: Record<string, string> = {
  operational: "#00C853",
  operating: "#00C853",
  construction: "#FF8C00",
  in_development: "#FF8C00",
  proposed: "#FF8C00",
  planned_startup: "#FF8C00",
  planned_maintenance: "#FFD600",
  unplanned_incident: "#FF1744",
  mothballed: "#FF1744",
  idle: "#FF1744",
  idled: "#FF1744",
  decommissioning: "#FF1744",
  retired: "#FF1744",
  cancelled: "#FF1744",
  shelved: "#FF1744"
};

function statusColumn(
  id: string,
  label: string,
  accessor: (row: AssetGridRow) => string,
  width?: string
): ColumnDef<AssetGridRow> {
  return {
    accessorFn: accessor,
    cell: ({ row }) => {
      const raw = row.original.status;
      const display = formatStatusLabel(raw).toUpperCase();
      const color = STATUS_PILL_COLORS[raw] ?? "#666666";
      return (
        <span
          className={styles.statusPill}
          style={{ borderColor: color, color }}
          title={display}
        >
          {display}
        </span>
      );
    },
    header: label,
    id,
    meta: { label, width }
  };
}

function textColumn(
  id: string,
  label: string,
  accessor: (row: AssetGridRow) => string,
  display?: (row: AssetGridRow) => string,
  width?: string
): ColumnDef<AssetGridRow> {
  return {
    accessorFn: accessor,
    cell: ({ row }) => {
      const value = (display ? display(row.original) : accessor(row.original)) || "--";
      // `title` gives hover-reveal for truncated values (the table
      // uses `table-layout: fixed` + ellipsis so long owner / operator
      // strings are clipped at the cell edge).
      return <span title={value}>{value}</span>;
    },
    header: label,
    id,
    meta: { label, width }
  };
}

function numericColumn(
  id: string,
  label: string,
  accessor: (row: AssetGridRow) => number,
  display: (row: AssetGridRow) => string,
  width?: string
): ColumnDef<AssetGridRow> {
  return {
    accessorFn: accessor,
    cell: ({ row }) => {
      const value = display(row.original);
      return <span title={value}>{value}</span>;
    },
    header: label,
    id,
    meta: { label, width, numeric: true },
    sortDescFirst: false,
    sortingFn: "basic"
  };
}

function getRefineryCapacity(row: AssetGridRow) {
  return row.asset.assetKind === "refinery" ? row.asset.capacity_bpd ?? 0 : 0;
}

function getPipelineCapacity(row: AssetGridRow) {
  return row.asset.assetKind === "pipeline" ? row.asset.capacity_boed ?? 0 : 0;
}

function getFieldProduction(row: AssetGridRow) {
  return row.asset.assetKind === "field" ? row.asset.production_bpd ?? 0 : 0;
}

function getTerminalMtpa(row: AssetGridRow) {
  return row.asset.assetKind === "terminal" ? row.asset.capacity_mtpa ?? 0 : 0;
}

function getTerminalCapacity(row: AssetGridRow) {
  if (row.asset.assetKind !== "terminal") {
    return 0;
  }

  return row.asset.capacity_mtpa ?? row.asset.capacity_bpd ?? 0;
}

function getChokepointTransit(row: AssetGridRow) {
  return row.asset.assetKind === "chokepoint" ? row.asset.transitVolume_mbpd : 0;
}
