"use client";

import * as React from "react";
import { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface FacetedFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: FacetedFilterOption[];
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue();
  const selectedValues = new Set(
    Array.isArray(filterValue) ? (filterValue as string[]) : [],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-dashed"
          aria-label={`Filter by ${title}`}
        >
          <PlusCircle className="mr-2 size-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2">
          <div className="space-y-1">
            {options.map((option) => {
              const isSelected = selectedValues.has(option.value);
              return (
                <button
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    const next = new Set(selectedValues);
                    if (isSelected) {
                      next.delete(option.value);
                    } else {
                      next.add(option.value);
                    }
                    const filterValues = Array.from(next);
                    column?.setFilterValue(
                      filterValues.length ? filterValues : undefined,
                    );
                  }}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                    isSelected && "font-medium",
                  )}
                >
                  <div
                    className={cn(
                      "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible",
                    )}
                  >
                    <Check className="size-3" />
                  </div>
                  {option.icon && (
                    <option.icon className="mr-2 size-4 text-muted-foreground" />
                  )}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {selectedValues.size > 0 && (
          <>
            <Separator />
            <div className="p-1">
              <button
                onClick={() => column?.setFilterValue(undefined)}
                className="w-full rounded-sm px-2 py-1.5 text-center text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Clear filters
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
