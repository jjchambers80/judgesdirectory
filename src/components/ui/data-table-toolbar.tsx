"use client";

import { Table } from "@tanstack/react-table";
import { X, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FacetedFilterConfig {
  columnId: string;
  title: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

export interface TextFilterConfig {
  columnId: string;
  placeholder: string;
}

export interface DataTableToolbarConfig {
  textFilters?: TextFilterConfig[];
  facetedFilters?: FacetedFilterConfig[];
  enableColumnVisibility?: boolean;
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  config: DataTableToolbarConfig;
  /** Text filter value for server-side tables (controlled externally) */
  textFilterValue?: string;
  /** Callback for server-side text filtering */
  onTextFilterChange?: (value: string) => void;
  /** Arbitrary content rendered at the start of the toolbar row */
  leadingContent?: React.ReactNode;
  /** Arbitrary content rendered at the end of the toolbar row */
  trailingContent?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  config,
  textFilterValue,
  onTextFilterChange,
  leadingContent,
  trailingContent,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    (textFilterValue !== undefined && textFilterValue.length > 0);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {leadingContent}
        {config.textFilters?.map((filter) => {
          // For server-side: use the controlled textFilterValue
          if (onTextFilterChange) {
            return (
              <Input
                key={filter.columnId}
                placeholder={filter.placeholder}
                value={textFilterValue ?? ""}
                onChange={(e) => onTextFilterChange(e.target.value)}
                className="h-8 w-[200px] lg:w-[350px]"
                aria-label={filter.placeholder}
              />
            );
          }
          // For client-side: use column filter value
          const column = table.getColumn(filter.columnId);
          return (
            <Input
              key={filter.columnId}
              placeholder={filter.placeholder}
              value={(column?.getFilterValue() as string) ?? ""}
              onChange={(e) => column?.setFilterValue(e.target.value)}
              className="h-8 w-[200px] lg:w-[350px]"
              aria-label={filter.placeholder}
            />
          );
        })}
        {config.facetedFilters?.map((filter) => {
          const column = table.getColumn(filter.columnId);
          if (!column) return null;
          return (
            <DataTableFacetedFilter
              key={filter.columnId}
              column={column}
              title={filter.title}
              options={filter.options}
            />
          );
        })}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              onTextFilterChange?.("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 size-4" />
          </Button>
        )}
      </div>
      {trailingContent}
      {config.enableColumnVisibility && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-8">
              <SlidersHorizontal className="mr-2 size-4" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[150px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" &&
                  column.getCanHide(),
              )
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
