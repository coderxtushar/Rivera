"use client";

import { Fragment, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapse, EmptyState, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/format";

export interface Column {
  label: ReactNode;
  className?: string;
  /** Visually hidden header (e.g. the actions column). */
  srOnly?: boolean;
}

/**
 * Admin data table. From `md` up it is a real table with a sticky header;
 * below `md` every row stacks into a block and each cell shows its own label.
 */
export function DataTable({ caption, columns, children }: { caption: string; columns: Column[]; children: ReactNode }) {
  return (
    <div className="rounded-panel border border-line bg-foam md:max-lg:overflow-x-auto">
      <table className="block w-full border-separate border-spacing-0 text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden md:table-header-group">
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "sticky top-16 z-10 border-b border-line bg-foam px-4 py-3 text-left text-xs font-semibold text-ink-3",
                  i === 0 && "rounded-tl-panel pl-5",
                  i === columns.length - 1 && "rounded-tr-panel pr-5",
                  c.className,
                )}
              >
                {c.srOnly ? <span className="sr-only">{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block md:table-row-group">{children}</tbody>
      </table>
    </div>
  );
}

/** A table row; `detail` renders an expandable full-width row underneath. */
export function Row({ children, detail, detailOpen, dim, className }: { children: ReactNode; detail?: ReactNode; detailOpen?: boolean; dim?: boolean; className?: string }) {
  return (
    <Fragment>
      <tr
        className={cn(
          "block border-t border-line px-4 py-3 first:border-t-0 md:table-row md:border-t-0 md:p-0 md:[&>td]:border-t md:[&>td]:border-line md:first:[&>td]:border-t-0",
          dim && "text-ink-3",
          className,
        )}
      >
        {children}
      </tr>
      {detail !== undefined && (
        <tr className="block md:table-row">
          <td colSpan={99} className="block p-0 md:table-cell">
            <Collapse open={Boolean(detailOpen)}>
              <div className="border-t border-line bg-mist/60 px-4 py-4 md:px-5">{detail}</div>
            </Collapse>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * A cell. Below `md` it shows `label` on the left; `lead` cells (the row's main
 * identity) and `actions` cells span the full width without a label.
 */
export function Cell({ label, lead, actions, className, children }: { label?: string; lead?: boolean; actions?: boolean; className?: string; children?: ReactNode }) {
  const labelled = !lead && !actions && label;
  return (
    <td
      data-label={labelled ? label : undefined}
      className={cn(
        "flex items-center gap-4 py-1 md:table-cell md:px-4 md:py-3 md:align-middle md:first:pl-5 md:last:pr-5",
        labelled && "justify-between before:shrink-0 before:text-ink-3 before:content-[attr(data-label)] md:before:content-none",
        lead && "pb-2",
        actions && "flex-wrap pt-3 md:pt-3",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Placeholder rows that match the table's rhythm while a page loads. */
export function SkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="block border-t border-line px-4 py-4 first:border-t-0 md:table-row md:border-t-0 md:p-0" aria-hidden>
          {Array.from({ length: columns }, (_, c) => (
            <td
              key={c}
              className={cn(
                "py-1 md:table-cell md:px-4 md:py-4 md:first:pl-5 md:last:pr-5",
                r > 0 && "md:border-t md:border-line",
                c > 2 ? "hidden" : "block",
              )}
            >
              <Skeleton className={cn("h-4", c === 0 ? "w-40" : c % 2 ? "w-24" : "w-16")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Full-width message row: empty and error states inside the table body. */
export function MessageRow({ children }: { children: ReactNode }) {
  return (
    <tr className="block md:table-row">
      <td colSpan={99} className="block p-4 md:table-cell md:p-5">
        {children}
      </td>
    </tr>
  );
}

export function TableError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <MessageRow>
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-buoy-wash px-4 py-3 text-[#8a2a14]">
        <AlertTriangle className="size-4 shrink-0" />
        <p className="flex-1">Couldn&apos;t load this list. {errorMessage(error)}</p>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </MessageRow>
  );
}

export function TableEmpty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <MessageRow>
      <EmptyState title={title} body={body} action={action} className="border-0 py-10" />
    </MessageRow>
  );
}

/** Small "Showing 1–20 of 134" line for paged lists. */
export function RangeNote({ meta }: { meta?: { page: number; limit: number; total: number } }) {
  if (!meta || !meta.total) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <p className="text-sm text-ink-3 tabular-nums">
      Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {meta.total.toLocaleString("en-IN")}
    </p>
  );
}
