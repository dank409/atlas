import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ReferenceTable.module.css";

export interface ReferenceColumn<TRow> {
  /** Text shown in the cell when it differs from the sort value (formatted numbers). */
  format?: (row: TRow) => string;
  /** Value to sort by; also the cell text unless `format` is given. */
  getValue: (row: TRow) => number | string;
  header: string;
  id: string;
  isNumeric?: boolean;
}

interface ReferenceTableProps<TRow> {
  ariaLabel: string;
  columns: ReferenceColumn<TRow>[];
  getRowId: (row: TRow) => string;
  initialSort: { columnId: string; isDescending: boolean };
  onSelect: (id: string) => void;
  rows: TRow[];
  selectedId: string | null;
}

/**
 * Sortable pick-list for the country and operator indexes. The first
 * column is the entry's name; clicking a row shows that entry beside it.
 */
export function ReferenceTable<TRow>({
  ariaLabel,
  columns,
  getRowId,
  initialSort,
  onSelect,
  rows,
  selectedId
}: ReferenceTableProps<TRow>) {
  const [sort, setSort] = useState(initialSort);
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  const sortedRows = useMemo(() => {
    const column = columns.find((candidate) => candidate.id === sort.columnId) ?? columns[0];
    const direction = sort.isDescending ? -1 : 1;

    return [...rows].sort((left, right) => {
      const leftValue = column.getValue(left);
      const rightValue = column.getValue(right);
      const order =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));

      return order * direction;
    });
  }, [columns, rows, sort]);

  // An entry reached by a link from elsewhere may be far down the list.
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  function handleSort(column: ReferenceColumn<TRow>) {
    setSort((current) =>
      current.columnId === column.id
        ? { columnId: column.id, isDescending: !current.isDescending }
        : // Numbers open largest-first, names A to Z.
          { columnId: column.id, isDescending: Boolean(column.isNumeric) }
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table aria-label={ariaLabel} className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = column.id === sort.columnId;

              return (
                <th aria-sort={isSorted ? (sort.isDescending ? "descending" : "ascending") : "none"} key={column.id}>
                  <button
                    aria-label={`SORT BY ${column.header}`}
                    className={column.isNumeric ? styles.sortButtonNumeric : styles.sortButton}
                    onClick={() => handleSort(column)}
                    type="button"
                  >
                    <span>{column.header}</span>
                    <span className={styles.sortIndicator}>{isSorted ? (sort.isDescending ? "▼" : "▲") : "·"}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const id = getRowId(row);
            const isSelected = id === selectedId;

            return (
              <tr
                aria-selected={isSelected}
                className={isSelected ? styles.selectedRow : undefined}
                key={id}
                onClick={() => onSelect(id)}
                ref={isSelected ? selectedRowRef : undefined}
              >
                {columns.map((column, index) => {
                  const text = column.format ? column.format(row) : String(column.getValue(row));

                  return (
                    <td className={column.isNumeric ? styles.numericCell : undefined} key={column.id}>
                      {index === 0 ? (
                        // A real button so the list is keyboard-reachable; the
                        // row click is a larger target for the same action.
                        <button className={styles.nameButton} type="button">
                          {text}
                        </button>
                      ) : (
                        text
                      )}
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
