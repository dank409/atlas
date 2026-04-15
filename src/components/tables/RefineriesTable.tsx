import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import styles from "./RefineriesTable.module.css";
import { formatCapacity } from "../../utils/formatters";
import type { RefineryProperties, SourceMetadata } from "../../types/Refinery";

const columns: ColumnDef<RefineryProperties>[] = [
  {
    accessorKey: "name",
    header: "Name"
  },
  {
    accessorKey: "countryName",
    header: "Country"
  },
  {
    accessorKey: "status",
    header: "Status"
  },
  {
    accessorKey: "capacity_bpd",
    header: "Capacity",
    cell: ({ row }) => row.original.capacity_bpd ? formatCapacity(row.original.capacity_bpd) : "--"
  }
];

interface RefineriesTableProps {
  metadata: SourceMetadata | null;
  refineries: RefineryProperties[];
  selectedRefineryId: string | null;
  onSelectRefinery: (refinery: RefineryProperties) => void;
}

export function RefineriesTable({
  metadata,
  onSelectRefinery,
  refineries,
  selectedRefineryId
}: RefineriesTableProps) {
  const [searchValue, setSearchValue] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const filteredRefineries = refineries.filter((refinery) => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      refinery.name,
      refinery.countryName,
      refinery.operator,
      refinery.status
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const table = useReactTable({
    columns,
    data: filteredRefineries,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting
    }
  });

  return (
    <section className={styles.tableShell}>
      <div className={styles.header}>
        <div className={styles.title}>REFINERIES TABLE</div>
        <input
          className={styles.searchInput}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="SEARCH"
          type="text"
          value={searchValue}
        />
      </div>
      <div className={styles.metaRow}>
        <span>{metadata?.source ?? "--"}</span>
        <span>{metadata?.downloadDate ?? "--"}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                aria-selected={row.original.id === selectedRefineryId}
                className={row.original.id === selectedRefineryId ? styles.selectedRow : undefined}
                key={row.id}
                onClick={() => onSelectRefinery(row.original)}
                tabIndex={0}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {cell.column.columnDef.cell
                      ? flexRender(cell.column.columnDef.cell, cell.getContext())
                      : String(cell.getValue() ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
