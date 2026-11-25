"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/format";
import type { CourseStatus } from "@/lib/types";

const STATUS: Record<CourseStatus, { label: string; tone: "neutral" | "reef" | "ink" }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "reef" },
  archived: { label: "Archived", tone: "ink" },
};

export function StatusBadge({ status, className }: { status: CourseStatus; className?: string }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}

/** A quiet raised surface for grouping a form or a table. */
export function Panel({ title, description, action, children, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-panel border border-line bg-foam p-5 sm:p-6", className)}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Stat tile: label, then a proportional-figure value, then an optional note. */
export function StatTile({ label, value, note, className }: { label: string; value: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-foam p-5", className)}>
      <p className="text-sm font-semibold text-ink-3">{label}</p>
      <div className="mt-2 text-2xl font-semibold leading-tight text-ink">{value}</div>
      {note && <div className="mt-1 text-sm text-ink-3">{note}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="This didn't load"
      body={message}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

/** Confirmation for destructive actions. The confirm label names the action ("Delete section"). */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  tone?: "danger" | "primary";
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="text-ink-2">{body}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={tone} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** Rows of placeholder bars shaped like a list or table. */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-line rounded-panel border border-line bg-foam", className)} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="h-12 w-20 shrink-0 animate-pulse rounded-control bg-ink/8" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-ink/8" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-ink/8" />
          </div>
          <div className="hidden h-4 w-16 animate-pulse rounded bg-ink/8 sm:block" />
        </div>
      ))}
    </div>
  );
}
