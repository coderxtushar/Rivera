"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageFade } from "@/components/layout/app-shell";
import { Badge, EmptyState, PageTitle, Pagination } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { cn, date, fullName } from "@/lib/format";
import type { Paged } from "@/lib/types";
import { amount, type SaleRow } from "../_components/lib";
import { ErrorState, RowsSkeleton } from "../_components/ui";

export default function SalesPage() {
  const [page, setPage] = useState(1);
  const sales = useQuery({
    queryKey: ["studio", "sales", page],
    queryFn: () => api<Paged<SaleRow>>("/instructor/sales", { query: { page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });

  return (
    <PageFade>
      <PageTitle title="Sales" sub="Every paid and refunded purchase of your courses, newest first. Your earnings are what's left after the platform fee." />
      {sales.isPending ? (
        <RowsSkeleton rows={6} />
      ) : sales.isError ? (
        <ErrorState message={errorMessage(sales.error)} onRetry={() => sales.refetch()} />
      ) : sales.data.data.length === 0 ? (
        <EmptyState
          title="No sales yet"
          body="When a student buys one of your courses, the sale shows up here. A launch coupon can help the first ones along."
          action={
            <Link href="/studio/coupons" className="font-semibold text-channel hover:underline">
              Create a coupon
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className={cn("overflow-hidden rounded-panel border border-line bg-foam transition-opacity", sales.isPlaceholderData && "opacity-60")}>
            <table className="w-full text-sm">
              <caption className="sr-only">Sales, page {sales.data.meta.page} of {sales.data.meta.totalPages}</caption>
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Buyer and course</th>
                  <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">Coupon</th>
                  <th scope="col" className="hidden px-3 py-3 text-right font-semibold md:table-cell">Paid</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Your earnings</th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-semibold sm:table-cell sm:px-5">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.data.data.map((s) => {
                  const refunded = s.status === "refunded";
                  const when = refunded ? s.refundedAt ?? s.paidAt : s.paidAt;
                  return (
                    <tr key={s._id} className="border-b border-line/70 align-top last:border-0">
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{fullName(s.user) || "Deleted account"}</span>
                          {refunded ? <Badge tone="buoy">Refunded</Badge> : <Badge tone="reef">Paid</Badge>}
                        </div>
                        <Link href={`/studio/courses/${s.course}`} className="mt-0.5 block text-ink-3 hover:text-channel hover:underline">
                          {s.courseTitle || "Untitled course"}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-3 md:hidden">
                          <span>Paid {amount(s.amount, s.currency)}</span>
                          {s.couponCode && <span className="font-mono">{s.couponCode}</span>}
                          <span className="sm:hidden">{date(when)}</span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell">
                        {s.couponCode ? <span className="rounded-[6px] bg-ink/6 px-2 py-0.5 font-mono text-xs font-bold text-ink-2">{s.couponCode}</span> : <span className="text-ink-3">None</span>}
                      </td>
                      <td className="hidden px-3 py-3 text-right tabular-nums text-ink-2 md:table-cell">{amount(s.amount, s.currency)}</td>
                      <td className={cn("px-3 py-3 text-right font-semibold tabular-nums", refunded ? "text-ink-3 line-through" : "text-ink")}>
                        {amount(s.instructorEarning ?? 0, s.currency)}
                        {refunded && <span className="sr-only">, refunded</span>}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-ink-2 sm:table-cell sm:px-5">
                        <time dateTime={when}>{date(when)}</time>
                        {refunded && s.paidAt && <span className="block text-xs text-ink-3">Bought {date(s.paidAt)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={sales.data.meta} onPage={setPage} />
        </div>
      )}
    </PageFade>
  );
}
