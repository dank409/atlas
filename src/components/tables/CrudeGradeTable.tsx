import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import type { CrudeGrade, CrudeGradeSnapshot } from "../../types/CrudeGrade";
import {
  formatCadenceLabel,
  formatClassificationLabel
} from "../../types/DataSource";
import styles from "./CrudeGradeTable.module.css";

interface CrudeGradeTableProps {
  snapshot: CrudeGradeSnapshot | null;
  isLoading: boolean;
  error: Error | null;
  /**
   * Row click → inspect overlay. When provided, rows are marked
   * clickable (cursor + hover) and emit the full `CrudeGrade` to
   * the caller. Omitted in tests that only want to assert rendering.
   */
  onInspectGrade?: (grade: CrudeGrade) => void;
}

export function CrudeGradeTable({
  snapshot,
  isLoading,
  error,
  onInspectGrade
}: CrudeGradeTableProps) {
  const columns = useMemo(() => buildColumns(), []);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "apiGravity", desc: true }
  ]);

  const grades = snapshot?.grades ?? [];

  const table = useReactTable({
    columns,
    data: grades,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting
    }
  });

  if (isLoading && !snapshot) {
    return <div className={styles.loadingState}>LOADING CRUDE GRADES…</div>;
  }

  if (error) {
    return <div className={styles.errorState}>CRUDE GRADE LOAD FAILED: {error.message}</div>;
  }

  if (!grades.length) {
    return <div className={styles.emptyState}>NO CRUDE GRADES IN THE REFERENCE TABLE.</div>;
  }

  const modeClassName =
    snapshot?.classification === "OBSERVED" ? styles.modeLive : styles.modeStatic;
  const producerCount = new Set(grades.map((grade) => grade.producerIso)).size;
  const totalProductionMbpd = grades.reduce((sum, grade) => sum + grade.productionMbpd, 0);

  return (
    <div className={styles.gridShell}>
      <div className={styles.metaRow}>
        <span>GRADES: {grades.length}</span>
        <span className={styles.separator}>|</span>
        <span>PRODUCERS: {producerCount}</span>
        <span className={styles.separator}>|</span>
        <span>TOTAL: {totalProductionMbpd.toFixed(2)} MBPD</span>
        <span className={styles.separator}>|</span>
        <span>AS OF: {snapshot?.asOf ?? "--"}</span>
        <span className={styles.separator}>|</span>
        <span className={modeClassName}>
          {snapshot
            ? `${formatClassificationLabel(snapshot.classification)} ${formatCadenceLabel(snapshot.cadence)}`
            : "CURATED"}
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          {/* Explicit widths + `table-layout: fixed` (see .table CSS)
              let long grade names like "Iranian Heavy" truncate with
              an ellipsis instead of shoving API / SULFUR off the
              right edge of the panel. */}
          <colgroup>
            <col style={{ width: "36%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "16%" }} />
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
                  const thClassName = isNumeric ? styles.numericHeader : undefined;
                  const buttonClassName = isNumeric ? styles.sortButtonRight : styles.sortButton;

                  return (
                    <th className={thClassName} key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          aria-label={`SORT BY ${label}`}
                          className={buttonClassName}
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
            {table.getRowModel().rows.map((row) => {
              const isClickable = Boolean(onInspectGrade);
              return (
                <tr
                  className={isClickable ? styles.clickableRow : undefined}
                  key={row.id}
                  onClick={
                    isClickable ? () => onInspectGrade?.(row.original) : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = cell.column.columnDef.meta?.numeric === true;
                    const className = isNumeric ? styles.numericCell : undefined;
                    return (
                      <td className={className} key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {snapshot ? (
        <div className={styles.sourceLine}>SOURCE: {snapshot.source}</div>
      ) : null}
    </div>
  );
}

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    label?: string;
    numeric?: boolean;
  }
}

function buildColumns(): Array<ColumnDef<CrudeGrade>> {
  // Trimmed from 7 → 5 columns: PRICING REF and NOTE moved into the
  // inspect overlay that opens on row click. The grid's job is now
  // scan-at-a-glance assay (API° / sulfur / class / production) —
  // the metadata lives one click away.
  return [
    {
      id: "name",
      accessorKey: "name",
      header: () => <span>NAME</span>,
      cell: (info) => {
        const grade = info.row.original;
        return (
          <div className={styles.nameCell}>
            <span className={styles.nameLabel} title={grade.name}>
              {grade.name}
            </span>
            <span
              className={styles.producerLabel}
              title={grade.producer}
            >
              {grade.producer.toUpperCase()}
            </span>
          </div>
        );
      },
      meta: { label: "NAME" }
    },
    {
      id: "apiGravity",
      accessorKey: "apiGravity",
      header: () => <span>API°</span>,
      cell: (info) => info.row.original.apiGravity.toFixed(1),
      meta: { label: "API", numeric: true }
    },
    {
      id: "sulfurPct",
      accessorKey: "sulfurPct",
      header: () => <span>SULFUR %</span>,
      cell: (info) => info.row.original.sulfurPct.toFixed(2),
      meta: { label: "SULFUR", numeric: true }
    },
    {
      id: "classification",
      accessorKey: "classification",
      header: () => <span>CLASS</span>,
      cell: (info) => {
        const classification = info.row.original.classification;
        return (
          <span className={styles.classificationBadge} data-tone={classification}>
            {classification.replace("-", " ")}
          </span>
        );
      },
      meta: { label: "CLASSIFICATION" }
    },
    {
      id: "productionMbpd",
      accessorKey: "productionMbpd",
      header: () => <span>PROD (MBPD)</span>,
      cell: (info) => info.row.original.productionMbpd.toFixed(2),
      meta: { label: "PRODUCTION", numeric: true }
    }
  ];
}
