"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  DataTableToolbar,
  type DataTableToolbarConfig,
} from "@/components/ui/data-table-toolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Toolbar configuration
  toolbarConfig?: DataTableToolbarConfig;

  // Server-side controlled state
  manualSorting?: boolean;
  manualFiltering?: boolean;
  manualPagination?: boolean;
  sorting?: SortingState;
  onSortingChange?: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: React.Dispatch<
    React.SetStateAction<ColumnFiltersState>
  >;
  pageCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Text filter (for server-side search)
  textFilterValue?: string;
  onTextFilterChange?: (value: string) => void;

  // Row selection
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: React.Dispatch<
    React.SetStateAction<RowSelectionState>
  >;
  enableRowSelection?: boolean;

  // Column visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: React.Dispatch<
    React.SetStateAction<VisibilityState>
  >;

  // Expandable rows
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;

  // Pagination config
  pageSizeOptions?: number[];
  defaultPageSize?: number;

  // Toolbar leading/trailing content
  toolbarLeadingContent?: React.ReactNode;
  toolbarTrailingContent?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  toolbarConfig,
  manualSorting = false,
  manualFiltering = false,
  manualPagination = false,
  sorting: controlledSorting,
  onSortingChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  pageCount,
  currentPage,
  onPageChange,
  onPageSizeChange,
  textFilterValue,
  onTextFilterChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  enableRowSelection = false,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  renderSubComponent,
  pageSizeOptions,
  defaultPageSize = 50,
  toolbarLeadingContent,
  toolbarTrailingContent,
}: DataTableProps<TData, TValue>) {
  // Internal state (used for client-side mode)
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    [],
  );
  const [internalFilters, setInternalFilters] =
    React.useState<ColumnFiltersState>([]);
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({});
  const [internalVisibility, setInternalVisibility] =
    React.useState<VisibilityState>({});
  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  // Use controlled state if provided, otherwise use internal state
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;
  const columnFilters = controlledColumnFilters ?? internalFilters;
  const setColumnFilters = onColumnFiltersChange ?? setInternalFilters;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const setRowSelection = onRowSelectionChange ?? setInternalRowSelection;
  const columnVisibility = controlledColumnVisibility ?? internalVisibility;
  const setColumnVisibility = onColumnVisibilityChange ?? setInternalVisibility;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      expanded,
      ...(manualPagination
        ? {}
        : { pagination: { pageIndex: 0, pageSize: defaultPageSize } }),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    enableRowSelection,
    manualSorting,
    manualFiltering,
    manualPagination,
    ...(manualPagination && pageCount ? { pageCount } : {}),
    getCoreRowModel: getCoreRowModel(),
    ...(!manualSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(!manualFiltering ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    ...(!manualPagination
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
    ...(renderSubComponent
      ? { getExpandedRowModel: getExpandedRowModel() }
      : {}),
  });

  return (
    <div className="space-y-4">
      {toolbarConfig && (
        <DataTableToolbar
          table={table}
          config={toolbarConfig}
          textFilterValue={textFilterValue}
          onTextFilterChange={onTextFilterChange}
          leadingContent={toolbarLeadingContent}
          trailingContent={toolbarTrailingContent}
        />
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubComponent && row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={row.getVisibleCells().length}>
                        {renderSubComponent({ row })}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        table={table}
        pageSizeOptions={pageSizeOptions}
        pageCount={manualPagination ? pageCount : undefined}
        currentPage={manualPagination ? currentPage : undefined}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
