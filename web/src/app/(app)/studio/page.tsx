"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageTitle, Skeleton, Stars } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { compact } from "@/lib/format";
import { EarningsChart, lastTwelveMonths } from "./_components/earnings-chart";
import { amount, type InstructorStats } from "./_components/lib";
import { ErrorState, Panel, StatTile } from "./_components/ui";

const createAction = (
  <ButtonLink href="/studio/courses/new" icon={<Plus className="size-4" />}>
    Create course
  </ButtonLink>
);

export default function StudioOverviewPage() {
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["studio", "stats"],
    queryFn: () => api<{ data: InstructorStats }>("/instructor/stats"),
    select: (d) => d.data,
  });

  return (
    <PageFade>
      <PageTitle title={user ? `Welcome back, ${user.firstName}` : "Overview"} sub="Your courses, students and earnings at a glance." action={createAction} />
      {stats.isPending ? (
        <OverviewSkeleton />
      ) : stats.isError ? (
        <ErrorState message={errorMessage(stats.error)} onRetry={() => stats.refetch()} />
      ) : stats.data.courses.total === 0 ? (
        <EmptyState
          title="Your first course starts here"
          body="Give it a working title and a price. You can shape the details, build the curriculum and publish when it's ready."
          action={createAction}
        />
      ) : (
        <Overview stats={stats.data} />
      )}
    </PageFade>
  );
}

function Overview({ stats }: { stats: InstructorStats }) {
  const currencies = useMemo(() => {
    const set = new Set<string>([...stats.revenue.map((r) => r.currency), ...stats.monthly.map((m) => m.currency)]);
    return [...set].sort((a, b) => (stats.revenue.find((r) => r.currency === b)?.earnings ?? 0) - (stats.revenue.find((r) => r.currency === a)?.earnings ?? 0));
  }, [stats]);
  const [picked, setPicked] = useState<string | null>(null);
  const currency = picked ?? currencies[0] ?? "INR";
  const [now] = useState(() => new Date());
  const months = useMemo(() => lastTwelveMonths(now, stats.monthly.filter((m) => m.currency === currency)), [now, stats.monthly, currency]);
  const yearTotal = months.reduce((s, m) => s + m.earnings, 0);
  const totalSales = stats.revenue.reduce((s, r) => s + r.sales, 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Earnings"
          value={
            stats.revenue.length ? (
              <span className="flex flex-col">
                {stats.revenue.map((r) => (
                  <span key={r.currency}>{amount(r.earnings, r.currency)}</span>
                ))}
              </span>
            ) : (
              amount(0, currency)
            )
          }
          note={totalSales ? `From ${totalSales.toLocaleString("en-IN")} ${totalSales === 1 ? "sale" : "sales"}` : "No sales yet"}
        />
        <StatTile label="Students" value={stats.students.toLocaleString("en-IN")} note="Across all your courses" />
        <StatTile
          label="Rating"
          value={
            stats.rating.count ? (
              <span className="flex items-center gap-2">
                {stats.rating.average.toFixed(1)}
                <Stars value={stats.rating.average} size={16} />
              </span>
            ) : (
              "No ratings yet"
            )
          }
          note={stats.rating.count ? `${compact(stats.rating.count)} ${stats.rating.count === 1 ? "review" : "reviews"}` : "Enrolled students can rate your courses"}
        />
        <StatTile
          label="Published courses"
          value={
            <span>
              {stats.courses.published}
              <span className="text-lg text-ink-3"> of {stats.courses.total}</span>
            </span>
          }
          note={
            <Link href="/studio/courses" className="font-semibold text-channel hover:underline">
              Manage courses
            </Link>
          }
        />
      </div>

      <Panel
        title="Earnings by month"
        description={yearTotal ? `${amount(yearTotal, currency)} in the last 12 months` : "The last 12 months"}
        action={currencies.length > 1 ? <Tabs items={currencies.map((c) => ({ value: c, label: c }))} value={currency} onChange={setPicked} /> : undefined}
      >
        {yearTotal > 0 ? (
          <EarningsChart data={months} currency={currency} />
        ) : (
          <p className="rounded-card border border-dashed border-line-strong px-5 py-10 text-center text-ink-3">
            No sales in the last 12 months yet. Earnings show up here, month by month, as students buy your courses.
          </p>
        )}
      </Panel>

      <Panel title="Earnings by course" description="Paid sales only. Refunded orders are left out.">
        {stats.perCourse.length === 0 ? (
          <p className="text-ink-3">Once a course makes its first sale, its earnings appear here.</p>
        ) : (
          <div className="-mx-5 sm:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th scope="col" className="px-5 py-2 font-semibold sm:px-6">Course</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Students</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold md:table-cell">Rating</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Sales</th>
                  <th scope="col" className="px-5 py-2 text-right font-semibold sm:px-6">Earnings</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {stats.perCourse.map((p) => (
                  <tr key={p.course._id} className="border-b border-line/70 last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-semibold text-ink sm:px-6">
                      <Link href={`/studio/courses/${p.course._id}`} className="hover:text-channel hover:underline">
                        {p.course.title}
                      </Link>
                      <span className="mt-0.5 block text-xs font-normal text-ink-3 sm:hidden">{p.sales === 1 ? "1 sale" : `${p.sales} sales`}</span>
                    </th>
                    <td className="hidden px-3 py-3 text-right text-ink-2 sm:table-cell">{p.course.stats.enrollmentCount.toLocaleString("en-IN")}</td>
                    <td className="hidden px-3 py-3 text-right text-ink-2 md:table-cell">{p.course.stats.ratingCount ? p.course.stats.ratingAvg.toFixed(1) : "None yet"}</td>
                    <td className="hidden px-3 py-3 text-right text-ink-2 sm:table-cell">{p.sales}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink sm:px-6">{amount(p.earnings, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading your studio">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-panel" />
      <Skeleton className="h-48 rounded-panel" />
    </div>
  );
}
