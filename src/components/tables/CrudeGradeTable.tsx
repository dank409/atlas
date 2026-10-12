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
import styles from "./CrudeGradeTable.module.css";

interface CrudeGradeTableProps {
  snapshot: CrudeGradeSnapshot | null;
  isLoading: boolean;
  error: Error | null;
  /** Row click shows the grade's detail card (note and source of the figures). */
  onInspectGrade: (grade: CrudeGrade) => void;
  selectedGradeId?: string | null;
}

export function CrudeGradeTable({
  snapshot,
  isLoading,
  error,
  onInspectGrade,
  selectedGradeId = null
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

  const producerCount = new Set(grades.map((grade) => grade.producerIso)).size;

  return (
    <div className={styles.gridShell}>
      <div className={styles.metaRow}>
        <span>GRADES: {grades.length}</span>
        <span className={styles.separator}>|</span>
        <span>PRODUCERS: {producerCount}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          {/* Explicit widths + `table-layout: fixed` (see .table CSS)
              let long grade names like "Iranian Heavy" truncate with
              an ellipsis instead of shoving API / SULFUR off the
              right edge of the panel. */}
          <colgroup>
            <col style={{ width: "48%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "30%" }} />
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
            {table.getRowModel().rows.map((row) => (
              <tr
                aria-selected={row.original.id === selectedGradeId}
                className={row.original.id === selectedGradeId ? styles.selectedRow : styles.clickableRow}
                key={row.id}
                onClick={() => onInspectGrade(row.original)}
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
            ))}
          </tbody>
        </table>
      </div>
      {snapshot ? (
        <div className={styles.sourceLine}>SOURCES: {snapshot.source}</div>
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
  // The note and the source of each grade's figures are long prose; they
  // live in the detail card beside the table so the rows stay scannable.
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
    }
  ];
}
