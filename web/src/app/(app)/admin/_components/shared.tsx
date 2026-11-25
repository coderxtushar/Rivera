"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { cn, money } from "@/lib/format";
import type { Course, CourseStatus, Order, OrderStatus, User } from "@/lib/types";

/* ------------------------------------------------------------------ types */

export interface AdminStats {
  users: { byRole: Partial<Record<User["role"], number>>; newLast30Days: number };
  courses: { byStatus: Partial<Record<CourseStatus, number>> };
  enrollments: number;
  revenue: { currency: string; gross: number; platformFees: number; orders: number }[];
}

/** `/admin/courses` populates the instructor with an email. */
export type AdminCourse = Omit<Course, "instructor"> & {
  instructor: { _id: string; firstName: string; lastName: string; email: string } | null;
};

/** `/admin/orders` populates user (name, email) and course (title, slug); either can be null if deleted. */
export type AdminOrder = Omit<Order, "user" | "course"> & {
  user: { _id: string; firstName: string; lastName: string; email: string } | null;
  course: { _id: string; title: string; slug: string } | null;
};

export const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ hooks */

export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/* ----------------------------------------------------------------- labels */

/** `money()` prints 0 as "Free"; totals and fees should read as an amount. */
export function amount(value: number, currency: string) {
  if (value !== 0) return money(value, currency);
  return money(100, currency).replace(/[\d.,]+/, "0");
}

export const ROLE_LABEL: Record<User["role"], string> = { student: "Student", instructor: "Instructor", admin: "Admin" };

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: "neutral" | "current" | "reef" | "buoy" | "ink" }> = {
  paid: { label: "Paid", tone: "reef" },
  refund_pending: { label: "Refund pending", tone: "buoy" },
  refunded: { label: "Refunded", tone: "current" },
  failed: { label: "Failed", tone: "neutral" },
  created: { label: "Created", tone: "neutral" },
};

export const PROVIDER_LABEL: Record<Order["provider"], string> = { mock: "Test payment", razorpay: "Razorpay", stripe: "Stripe", none: "No payment" };

export const COURSE_STATUS: Record<CourseStatus, { label: string; tone: "neutral" | "current" | "reef" }> = {
  published: { label: "Published", tone: "reef" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "current" },
};

/* --------------------------------------------------------------- controls */

/** Labelled search box with a leading icon. */
export function SearchField({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <Field label={label} className={className}>
      {(p) => (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input {...p} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-10" autoComplete="off" />
        </div>
      )}
    </Field>
  );
}

/** Row of labelled filters above a table; wraps on small screens. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-5 flex flex-wrap items-end gap-3 [&>*]:min-w-40 [&>*:first-child]:flex-1 [&>*:first-child]:basis-64", className)}>{children}</div>;
}

/** Confirmation dialog for consequential actions. The confirm label is the action's verb. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  loading,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      {children && <div className="space-y-3 text-ink-2">{children}</div>}
      <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children && "mt-6")}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** Section heading inside admin pages. */
export function SectionHeading({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-baseline justify-between gap-2", className)}>
      <h2 className="display text-xl" style={{ ["--wdth" as string]: 86 }}>
        {children}
      </h2>
      {aside}
    </div>
  );
}
