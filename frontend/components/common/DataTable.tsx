import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyTitle = "No records available",
  emptyDescription = "Data rows will appear once the corresponding backend calculation runs.",
  caption,
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/80 bg-card/90">
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
          {rows.map((row, idx) => (
            <TableRow
              key={getRowKey(row, idx)}
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
      {caption ? (
        <div className="border-t border-border/60 bg-secondary/25 px-4 py-2 text-xs text-muted-foreground">
          {caption}
        </div>
      ) : null}
    </div>
  );
}

