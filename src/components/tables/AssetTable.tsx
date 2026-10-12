import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import type { DatasetId, InfrastructureAsset } from "../../types/Infrastructure";
import { ENERGY_LABELS, getEnergyType } from "../../utils/assetEnergy";
import { formatLengthKm, formatStatusLabel } from "../../utils/formatters";
import {
  formatPrimaryMetric,
  getAssetDisplayName,
  getAssetOperator,
  getPrimaryMetricValue,
  getSourceStatus
} from "../../utils/infrastructure";
import styles from "./AssetTable.module.css";

interface AssetTableProps {
  /** Rows to show: one layer's assets, already filtered. */
  assets: InfrastructureAsset[];
  datasetId: DatasetId;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  selectedAssetId: string | null;
}

interface ColumnMeta {
  isNumeric?: boolean;
  /** Column width as a share of the table. */
  width: string;
}

type AssetColumn = ColumnDef<InfrastructureAsset> & { header: string; meta: ColumnMeta };

const INITIAL_SORTING: SortingState = [{ desc: false, id: "name" }];

/**
 * Sortable table of one layer. Columns differ by layer because the
 * sources report different things for each; a refinery has no status
 * column because its source has no status.
 */
export function AssetTable({ assets, datasetId, onSelectAsset, selectedAssetId }: AssetTableProps) {
  const columns = useMemo(() => buildColumns(datasetId), [datasetId]);
  const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  const table = useReactTable({
    columns,
    data: assets,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting }
  });

  // An asset picked elsewhere (map, search) may be far down the table.
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedAssetId]);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.meta.width }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDirection = header.column.getIsSorted();
                const column = header.column.columnDef as AssetColumn;

                return (
                  <th
                    aria-sort={sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : "none"}
                    key={header.id}
                  >
                    <button
                      aria-label={`SORT BY ${column.header}`}
                      className={column.meta.isNumeric ? styles.sortButtonNumeric : styles.sortButton}
                      onClick={header.column.getToggleSortingHandler()}
                      type="button"
                    >
                      <span>{column.header}</span>
                      <span className={styles.sortIndicator}>
                        {sortDirection === "asc" ? "▲" : sortDirection === "desc" ? "▼" : "·"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isSelected = row.original.id === selectedAssetId;

            return (
              <tr
                aria-selected={isSelected}
                className={isSelected ? styles.selectedRow : undefined}
                key={row.id}
                onClick={() => onSelectAsset(row.original)}
                ref={isSelected ? selectedRowRef : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const column = cell.column.columnDef as AssetColumn;
                  const value = String(cell.getValue() ?? "");

                  return (
                    // `title` reveals the full text when the cell truncates it.
                    <td className={column.meta.isNumeric ? styles.numericCell : undefined} key={cell.id} title={value}>
                      {flexRender(column.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function textColumn(
  id: string,
  header: string,
  width: string,
  accessor: (asset: InfrastructureAsset) => string | null | undefined
): AssetColumn {
  return {
    accessorFn: (asset) => accessor(asset) || "--",
    header,
    id,
    meta: { width }
  };
}

function metricColumn(header: string, width: string): AssetColumn {
  return {
    accessorFn: getPrimaryMetricValue,
    cell: ({ row }) => formatPrimaryMetric(row.original),
    header,
    id: "metric",
    meta: { isNumeric: true, width },
    sortDescFirst: true
  };
}

const nameColumn = (width: string) => textColumn("name", "NAME", width, getAssetDisplayName);
const countryColumn = (width: string) => textColumn("country", "COUNTRY", width, (asset) => asset.countryName);
const statusColumn = (width: string) =>
  textColumn("status", "STATUS", width, (asset) => {
    const status = getSourceStatus(asset);

    return status ? formatStatusLabel(status) : null;
  });

function buildColumns(datasetId: DatasetId): AssetColumn[] {
  if (datasetId === "refineries") {
    return [
      nameColumn("36%"),
      countryColumn("18%"),
      metricColumn("CAPACITY", "16%"),
      textColumn("operator", "OPERATOR", "30%", getAssetOperator)
    ];
  }

  if (datasetId === "pipelines") {
    return [
      nameColumn("32%"),
      countryColumn("13%"),
      textColumn("energy", "CARRIES", "13%", (asset) => ENERGY_LABELS[getEnergyType(asset)]),
      {
        accessorFn: (asset) => (asset.assetKind === "pipeline" ? asset.length_km ?? 0 : 0),
        cell: ({ row }) =>
          row.original.assetKind === "pipeline" && row.original.length_km
            ? formatLengthKm(row.original.length_km)
            : "--",
        header: "LENGTH",
        id: "length",
        meta: { isNumeric: true, width: "9%" },
        sortDescFirst: true
      },
      metricColumn("CAPACITY", "13%"),
      textColumn("operator", "OWNER", "10%", getAssetOperator),
      statusColumn("10%")
    ];
  }

  if (datasetId === "fields") {
    return [
      nameColumn("32%"),
      countryColumn("14%"),
      textColumn("energy", "TYPE", "14%", (asset) => ENERGY_LABELS[getEnergyType(asset)]),
      metricColumn("PRODUCTION", "14%"),
      textColumn("operator", "OPERATOR", "14%", getAssetOperator),
      statusColumn("12%")
    ];
  }

  return [
    nameColumn("32%"),
    countryColumn("16%"),
    textColumn("role", "ROLE", "10%", (asset) =>
      asset.assetKind === "terminal" && asset.terminalRole ? asset.terminalRole.toUpperCase() : null
    ),
    metricColumn("CAPACITY", "12%"),
    textColumn("operator", "OPERATOR / OWNER", "18%", getAssetOperator),
    statusColumn("12%")
  ];
}
