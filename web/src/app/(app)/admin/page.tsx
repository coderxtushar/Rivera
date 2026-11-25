"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, UserCheck } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageTitle, Skeleton } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/format";
import type { Paged, User } from "@/lib/types";
import { amount, SectionHeading, type AdminOrder, type AdminStats } from "./_components/shared";

export default function AdminOverviewPage() {
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api<{ data: AdminStats }>("/admin/stats").then((r) => r.data),
  });
  const refunds = useQuery({
    queryKey: ["admin", "orders", { status: "refund_pending", page: 1, count: true }],
    queryFn: () => api<Paged<AdminOrder>>("/admin/orders", { query: { status: "refund_pending", limit: 1 } }).then((r) => r.meta.total),
  });
  const applications = useQuery({
    queryKey: ["admin", "users", { instructorStatus: "pending", count: true }],
    queryFn: () => api<Paged<User>>("/admin/users", { query: { instructorStatus: "pending", limit: 1 } }).then((r) => r.meta.total),
  });

  return (
    <PageFade>
      <PageTitle title="Overview" sub="Who is on Rivera, what is published and what it has earned." />

      <div className="mb-10 space-y-3 empty:hidden">
        {!!refunds.data && (
          <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-buoy-wash px-5 py-4 ring-1 ring-inset ring-buoy/40">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-buoy text-white">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{refunds.data === 1 ? "1 order needs a refund" : `${refunds.data.toLocaleString("en-IN")} orders need a refund`}</p>
              <p className="text-sm text-ink-2">The payment was captured but the student never got access. Refund it so they get their money back.</p>
            </div>
            <ButtonLink href="/admin/orders?status=refund_pending" variant="secondary" size="sm">
              Review refunds
            </ButtonLink>
          </div>
        )}
        {!!applications.data && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-channel-wash/60 px-5 py-4 ring-1 ring-inset ring-channel/20">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-channel text-white">
              <UserCheck className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 font-semibold text-ink">
              {applications.data === 1 ? "1 instructor application is waiting" : `${applications.data.toLocaleString("en-IN")} instructor applications are waiting`}
            </p>
            <ButtonLink href="/admin/users?view=applications" variant="secondary" size="sm">
              Review applications
            </ButtonLink>
          </div>
        )}
      </div>

      {stats.isPending ? (
        <OverviewSkeleton />
      ) : stats.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-buoy-wash px-5 py-4 text-[#8a2a14]">
          <p className="flex-1">Couldn&apos;t load the numbers. {errorMessage(stats.error)}</p>
          <Button size="sm" variant="secondary" onClick={() => stats.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <Stats stats={stats.data} />
      )}
    </PageFade>
  );
}

function Stats({ stats }: { stats: AdminStats }) {
  const roles = stats.users.byRole;
  const statuses = stats.courses.byStatus;
  const totalUsers = (roles.student ?? 0) + (roles.instructor ?? 0) + (roles.admin ?? 0);
  const totalCourses = (statuses.published ?? 0) + (statuses.draft ?? 0) + (statuses.archived ?? 0);
  const published = statuses.published ?? 0;

  return (
    <div className="space-y-12">
      <section aria-labelledby="revenue-heading">
        <SectionHeading aside={<p className="text-sm text-ink-3">Paid orders, all time</p>}>
          <span id="revenue-heading">Revenue</span>
        </SectionHeading>
        {stats.revenue.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-5 py-8 text-center text-ink-3">
            No paid orders yet. Revenue shows here after the first purchase.
          </p>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {stats.revenue.map((r) => (
              <div key={r.currency} className="grid gap-x-10 gap-y-4 py-6 sm:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))] sm:items-end">
                <div>
                  <p className="text-sm text-ink-3">Gross in {r.currency}</p>
                  <p className="display mt-1 text-4xl tabular-nums sm:text-5xl" style={{ ["--wdth" as string]: 78 }}>
                    {amount(r.gross, r.currency)}
                  </p>
                </div>
                <Figure label="Platform fees" value={amount(r.platformFees, r.currency)} />
                <Figure label="Paid orders" value={r.orders.toLocaleString("en-IN")} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-3">
        <Ledger
          title="People"
          total={totalUsers}
          totalLabel={totalUsers === 1 ? "account" : "accounts"}
          rows={[
            { label: "Students", value: roles.student ?? 0, color: "bg-shoal" },
            { label: "Instructors", value: roles.instructor ?? 0, color: "bg-reef" },
            { label: "Admins", value: roles.admin ?? 0, color: "bg-deep" },
          ]}
          footer={
            <>
              <span className="font-semibold text-ink tabular-nums">{stats.users.newLast30Days.toLocaleString("en-IN")}</span> joined in the last 30 days
            </>
          }
          link={{ href: "/admin/users", label: "Manage users" }}
        />
        <Ledger
          title="Courses"
          total={totalCourses}
          totalLabel={totalCourses === 1 ? "course" : "courses"}
          rows={[
            { label: "Published", value: published, color: "bg-reef" },
            { label: "Drafts", value: statuses.draft ?? 0, color: "bg-shoal" },
            { label: "Archived", value: statuses.archived ?? 0, color: "bg-ink/25" },
          ]}
          link={{ href: "/admin/courses", label: "Manage courses" }}
        />
        <section aria-labelledby="enrollments-heading">
          <h2 id="enrollments-heading" className="display text-xl" style={{ ["--wdth" as string]: 86 }}>
            Enrollments
          </h2>
          <p className="display mt-3 text-4xl tabular-nums" style={{ ["--wdth" as string]: 78 }}>
            {stats.enrollments.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-sm text-ink-3">students enrolled across all courses</p>
          {published > 0 && (
            <p className="mt-6 border-t border-line pt-4 text-sm text-ink-2">
              About <span className="font-semibold text-ink tabular-nums">{Math.round(stats.enrollments / published).toLocaleString("en-IN")}</span> per published course
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Ledger({
  title,
  total,
  totalLabel,
  rows,
  footer,
  link,
}: {
  title: string;
  total: number;
  totalLabel: string;
  rows: { label: string; value: number; color: string }[];
  footer?: ReactNode;
  link: { href: string; label: string };
}) {
  const id = `${title.toLowerCase()}-heading`;
  return (
    <section aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="display text-xl" style={{ ["--wdth" as string]: 86 }}>
          {title}
        </h2>
        <Link href={link.href} className="text-sm font-semibold text-channel hover:underline">
          {link.label}
        </Link>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="display text-4xl tabular-nums" style={{ ["--wdth" as string]: 78 }}>
          {total.toLocaleString("en-IN")}
        </span>
        <span className="text-sm text-ink-3">{totalLabel}</span>
      </p>

      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-ink/6" aria-hidden>
        {total > 0 && rows.map((r) => r.value > 0 && <span key={r.label} className={cn("h-full", r.color)} style={{ width: `${(r.value / total) * 100}%` }} />)}
      </div>

      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="flex items-center gap-2 text-ink-2">
              <span className={cn("size-2.5 rounded-full", r.color)} aria-hidden />
              {r.label}
            </dt>
            <dd className="font-semibold tabular-nums">{r.value.toLocaleString("en-IN")}</dd>
          </div>
        ))}
      </dl>
      {footer && <p className="mt-4 text-sm text-ink-2">{footer}</p>}
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-12" aria-busy="true" aria-label="Loading numbers">
      <div className="border-y border-line py-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-12 w-64" />
      </div>
      <div className="grid gap-10 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
