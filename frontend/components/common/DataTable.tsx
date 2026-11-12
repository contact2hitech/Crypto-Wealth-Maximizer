"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/LoadingState";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  numeric?: boolean;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyTitle = "No records available",
  emptyDescription = "Data rows will appear once the corresponding backend calculation runs.",
  caption,
  pageSize,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);

  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : rows.length;
  const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize));
  const safePage = Math.min(page, totalPages - 1);
  const startIdx = safePage * effectivePageSize;
  const visibleRows = rows.slice(startIdx, startIdx + effectivePageSize);
  const showPagination = Boolean(pageSize && rows.length > pageSize);

  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card/90">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="border-border/80 hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "h-10 whitespace-nowrap text-xs font-medium uppercase tracking-wider text-muted-foreground",
                    col.align === "right" ? "text-right" : "text-left",
                    col.className
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, idx) => (
              <TableRow
                key={getRowKey(row, startIdx + idx)}
                className="border-border/60 hover:bg-secondary/35"
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap py-2.5 text-sm",
                      col.align === "right" ? "text-right" : "text-left",
                      col.numeric ? "font-mono tabular-nums" : "",
                      col.className
                    )}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {showPagination || caption ? (
        <div className="flex flex-col gap-2 border-t border-border/60 bg-secondary/25 px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            {caption ??
              `Showing ${startIdx + 1}–${Math.min(startIdx + effectivePageSize, rows.length)} of ${rows.length} rows`}
          </div>
          {showPagination ? (
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums">
                Page {safePage + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, Math.min(p, totalPages - 1) - 1))}
                aria-label="Previous table page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, Math.min(p, totalPages - 1) + 1))
                }
                aria-label="Next table page"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
