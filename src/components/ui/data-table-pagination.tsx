"use client";

import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  /** For server-side pagination: total pages from the API */
  pageCount?: number;
  /** For server-side pagination: current page (1-indexed) */
  currentPage?: number;
  /** For server-side pagination: callback when page changes */
  onPageChange?: (page: number) => void;
  /** For server-side pagination: callback when page size changes */
  onPageSizeChange?: (size: number) => void;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [25, 50, 100],
  pageCount,
  currentPage,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps<TData>) {
  const isServerSide = pageCount !== undefined;

  const selectedRowCount = table.getFilteredSelectedRowModel().rows.length;
  const totalRowCount = table.getFilteredRowModel().rows.length;

  const actualPageCount = isServerSide ? pageCount : table.getPageCount();
  const actualCurrentPage = isServerSide
    ? (currentPage ?? 1)
    : table.getState().pagination.pageIndex + 1;

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-muted-foreground flex-1 text-sm">
        {selectedRowCount > 0 && (
          <span>
            {selectedRowCount} of {totalRowCount} row(s) selected
          </span>
        )}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              const size = Number(value);
              table.setPageSize(size);
              onPageSizeChange?.(size);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]" aria-label="Rows per page">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {actualCurrentPage} of {actualPageCount}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              if (isServerSide) {
                onPageChange?.(1);
              } else {
                table.setPageIndex(0);
              }
            }}
            disabled={
              isServerSide
                ? actualCurrentPage <= 1
                : !table.getCanPreviousPage()
            }
            aria-label="Go to first page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              if (isServerSide) {
                onPageChange?.(actualCurrentPage - 1);
              } else {
                table.previousPage();
              }
            }}
            disabled={
              isServerSide
                ? actualCurrentPage <= 1
                : !table.getCanPreviousPage()
            }
            aria-label="Go to previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              if (isServerSide) {
                onPageChange?.(actualCurrentPage + 1);
              } else {
                table.nextPage();
              }
            }}
            disabled={
              isServerSide
                ? actualCurrentPage >= (actualPageCount ?? 1)
                : !table.getCanNextPage()
            }
            aria-label="Go to next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              if (isServerSide) {
                onPageChange?.(actualPageCount ?? 1);
              } else {
                table.setPageIndex(table.getPageCount() - 1);
              }
            }}
            disabled={
              isServerSide
                ? actualCurrentPage >= (actualPageCount ?? 1)
                : !table.getCanNextPage()
            }
            aria-label="Go to last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
