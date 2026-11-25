"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageFade } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, Pagination, PageTitle, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { date, money } from "@/lib/format";
import type { Order, OrderStatus, Paged } from "@/lib/types";
import { QueryError } from "../_components/query-error";

const STATUS: Record<OrderStatus, { label: string; tone: "reef" | "neutral" | "buoy" | "current" }> = {
  paid: { label: "Paid", tone: "reef" },
  refunded: { label: "Refunded", tone: "neutral" },
  refund_pending: { label: "Refund pending", tone: "current" },
  failed: { label: "Failed", tone: "buoy" },
  created: { label: "Awaiting payment", tone: "neutral" },
};

function courseOf(o: Order) {
  const c = typeof o.course === "object" && o.course ? o.course : null;
  return { title: c?.title || o.courseTitle || "Deleted course", slug: c?.slug };
}

const orderDate = (o: Order) => o.paidAt || o.createdAt;

export default function PurchasesPage() {
  const [page, setPage] = useState(1);
  const orders = useQuery({
    queryKey: ["dashboard", "orders", page],
    queryFn: () => api<Paged<Order>>("/users/me/orders", { query: { page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });
  const items = orders.data?.data ?? [];

  return (
    <PageFade>
      <PageTitle title="Purchases" sub="Every course you've paid for, with refunds and failed payments." />

      {orders.isPending ? (
        <div className="space-y-3" aria-busy aria-label="Loading purchases">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-card" />
          ))}
        </div>
      ) : orders.isError ? (
        <QueryError title="We couldn't load your purchases" error={orders.error} onRetry={() => orders.refetch()} retrying={orders.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          body="When you buy a course, the receipt details show up here."
          action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
        />
      ) : (
        <>
          {/* Desktop: a table */}
          <div className="hidden overflow-hidden rounded-panel border border-line bg-foam md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Purchase history</caption>
              <thead className="border-b border-line text-ink-3">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Course</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Date</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">Discount</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((o) => (
                  <tr key={o._id} className="align-top">
                    <td className="max-w-xs px-5 py-4">
                      <CourseLink order={o} />
                      {o.failureReason && <p className="mt-1 text-xs text-ink-3">{o.failureReason}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 tabular-nums text-ink-2">
                      <time dateTime={orderDate(o)}>{date(orderDate(o))}</time>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Discount order={o} align="end" />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Amount order={o} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked rows */}
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-foam md:hidden">
            {items.map((o) => (
              <li key={o._id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CourseLink order={o} />
                    <p className="mt-1 text-sm tabular-nums text-ink-3">
                      <time dateTime={orderDate(o)}>{date(orderDate(o))}</time>
                    </p>
                  </div>
                  <Amount order={o} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} />
                  <Discount order={o} />
                </div>
                {o.failureReason && <p className="mt-2 text-xs text-ink-3">{o.failureReason}</p>}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Pagination meta={orders.data?.meta} onPage={setPage} />
          </div>
        </>
      )}
    </PageFade>
  );
}

function CourseLink({ order }: { order: Order }) {
  const { title, slug } = courseOf(order);
  if (!slug) return <span className="font-semibold text-ink">{title}</span>;
  return (
    <Link href={`/courses/${slug}`} className="font-semibold text-ink underline-offset-4 hover:text-channel hover:underline">
      {title}
    </Link>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status] ?? STATUS.created;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

function Discount({ order, align = "start" }: { order: Order; align?: "start" | "end" }) {
  if (!order.discount) return align === "end" ? <span className="text-ink-3">None</span> : null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${align === "end" ? "justify-end" : ""}`}>
      {order.couponCode && <Badge tone="buoy">{order.couponCode}</Badge>}
      <span className="tabular-nums text-ink-2">
        <span className="sr-only">Discount </span>−{money(order.discount, order.currency)}
      </span>
    </span>
  );
}

function Amount({ order }: { order: Order }) {
  const refunded = order.status === "refunded";
  return (
    <span className="flex flex-col items-end">
      <span className={`font-bold tabular-nums ${refunded || order.status === "failed" ? "text-ink-3 line-through" : "text-ink"}`}>
        {money(order.amount, order.currency)}
      </span>
      {order.discount > 0 && (
        <span className="text-xs tabular-nums text-ink-3 line-through">
          <span className="sr-only">Original price </span>
          {money(order.originalAmount, order.currency)}
        </span>
      )}
    </span>
  );
}
