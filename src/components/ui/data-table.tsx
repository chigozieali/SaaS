"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  filterKeys?: Array<keyof TData | string>;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  dense?: boolean;
  paginated?: boolean;
};

function getPath<TRow>(row: TRow, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, row);
}

export function DataTable<TData>({
  columns,
  data,
  filterKeys = [],
  searchPlaceholder = "Search…",
  toolbar,
  loading = false,
  emptyMessage = "No results found",
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  dense = false,
  paginated = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [searchValue, setSearchValue] = React.useState("");

  const filteredData = React.useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query || filterKeys.length === 0) return data;
    return data.filter((row) =>
      filterKeys.some((key) => {
        const value = getPath(row, String(key));
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, searchValue, filterKeys]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { rows } = table.getFilteredRowModel();
  const page = table.getRowModel().rows;
  const pageIdx = table.getState().pagination.pageIndex;
  const pageSizeActive = table.getState().pagination.pageSize;

  return (
    <div className="space-y-4">
      {filterKeys.length > 0 || toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {filterKeys.length > 0 ? (
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8"
              />
            </div>
          ) : null}
          {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.columnDef.meta?.headerClassName,
                        sortable && "cursor-pointer select-none"
                      )}
                      onClick={
                        sortable
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1.5">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sortable ? (
                            sorted === "asc" ? (
                              <ChevronDown className="h-3.5 w-3.5 -rotate-180 text-muted-foreground" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground/50" />
                            )
                          ) : null}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : page.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              page.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.columnDef.meta?.cellClassName,
                        dense && "p-1.5"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        {paginated ? (
          <>
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(pageSizeActive)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="whitespace-nowrap">
                {rows.length === 0
                  ? "0 rows"
                  : `${pageIdx * pageSizeActive + 1}–${Math.min(
                      (pageIdx + 1) * pageSizeActive,
                      rows.length
                    )} of ${rows.length}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <span>
            {rows.length === 0
              ? "0 rows"
              : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
          </span>
        )}
      </div>
    </div>
  );
}