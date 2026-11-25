"use client";

import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, CircleAlert, KeyRound } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, PageTitle, Pagination } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { cn, date, fullName, money } from "@/lib/format";
import type { OrderStatus, Paged } from "@/lib/types";
import { GrantAccessDialog } from "../_components/grant-access";
import { amount as cash, ConfirmDialog, ORDER_STATUS, PAGE_SIZE, PROVIDER_LABEL, type AdminOrder } from "../_components/shared";
import { Cell, DataTable, RangeNote, Row, SkeletonRows, TableEmpty, TableError } from "../_components/table";

type Tab = OrderStatus | "all";
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "refund_pending", label: "Refund pending" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
  { value: "created", label: "Created" },
];

const COLUMNS = [
  { label: "Buyer" },
  { label: "Course" },
  { label: "Amount", className: "text-right" },
  { label: "Provider" },
  { label: "Status" },
  { label: "Date" },
  { label: "Actions", srOnly: true, className: "text-right" },
];

const NO_MONEY = new Set<AdminOrder["provider"]>(["mock", "none"]);
const dateTime = { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" } as const;

export default function AdminOrdersPage() {
  const [granting, setGranting] = useState(false);
  return (
    <PageFade>
      <PageTitle
        title="Orders"
        sub="Every checkout on Rivera. Refund paid orders here, and grant access by hand when someone should have a course without paying."
        action={
          <Button variant="secondary" icon={<KeyRound className="size-4" />} onClick={() => setGranting(true)}>
            Grant course access
          </Button>
        }
      />
      <Suspense fallback={<OrdersFallback />}>
        <OrdersView />
      </Suspense>
      <GrantAccessDialog open={granting} onClose={() => setGranting(false)} />
    </PageFade>
  );
}

function OrdersFallback() {
  return (
    <DataTable caption="Orders" columns={COLUMNS}>
      <SkeletonRows columns={COLUMNS.length} />
    </DataTable>
  );
}

function OrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("status");
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "all";
  const status = tab === "all" ? undefined : tab;

  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<AdminOrder | null>(null);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin", "orders", { status: status ?? "all", page }],
    queryFn: () => api<Paged<AdminOrder>>("/admin/orders", { query: { status, page, limit: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });
  const pendingCount = useQuery({
    queryKey: ["admin", "orders", { status: "refund_pending", page: 1, count: true }],
    queryFn: () => api<Paged<AdminOrder>>("/admin/orders", { query: { status: "refund_pending", limit: 1 } }).then((r) => r.meta.total),
  });

  const refund = useMutation({
    mutationFn: (order: AdminOrder) => api<{ data: { order: AdminOrder } }>(`/admin/orders/${order._id}/refund`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Order refunded");
      setRefunding(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
  });

  const changeTab = (t: Tab) => {
    setPage(1);
    setOpenId(null);
    router.replace(t === "all" ? pathname : `${pathname}?status=${t}`, { scroll: false });
  };

  const rows = list.data?.data ?? [];

  return (
    <>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        <Tabs<Tab>
          value={tab}
          onChange={changeTab}
          className="whitespace-nowrap"
          items={TABS.map((t) => (t.value === "refund_pending" ? { ...t, count: pendingCount.data || undefined } : t))}
        />
      </div>

      <div className={cn("transition-opacity", list.isPlaceholderData && "opacity-60")}>
        <DataTable caption={tab === "all" ? "Orders" : `${ORDER_STATUS[tab].label} orders`} columns={COLUMNS}>
          {list.isPending ? (
            <SkeletonRows columns={COLUMNS.length} />
          ) : list.isError ? (
            <TableError error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            tab === "refund_pending" ? (
              <TableEmpty title="No refunds waiting" body="Orders land here when a payment is captured but access can't be granted. You're all caught up." />
            ) : tab === "all" ? (
              <TableEmpty title="No orders yet" body="Orders show up here as soon as someone starts a checkout." />
            ) : (
              <TableEmpty
                title={`No ${ORDER_STATUS[tab].label.toLowerCase()} orders`}
                body="Try another status to see more orders."
                action={
                  <Button variant="secondary" onClick={() => changeTab("all")}>
                    Show all orders
                  </Button>
                }
              />
            )
          ) : (
            rows.map((o) => {
              const st = ORDER_STATUS[o.status];
              const open = openId === o._id;
              const name = fullName(o.user) || o.user?.email || "Deleted account";
              const canRefund = o.status === "paid" || o.status === "refund_pending";
              return (
                <Row key={o._id} detailOpen={open} detail={<OrderDetail order={o} />}>
                  <Cell lead>
                    <span className="min-w-0">
                      <span className={cn("block font-semibold break-words", o.user ? "text-ink" : "text-ink-3")}>{name}</span>
                      {o.user?.email && <span className="block break-all text-ink-3">{o.user.email}</span>}
                    </span>
                  </Cell>
                  <Cell label="Course">
                    {o.course ? (
                      <Link href={`/courses/${o.course.slug}`} className="line-clamp-2 text-right text-ink hover:text-channel hover:underline md:text-left">
                        {o.course.title}
                      </Link>
                    ) : (
                      <span className="text-ink-3">{o.courseTitle || "Deleted course"}</span>
                    )}
                  </Cell>
                  <Cell label="Amount" className="whitespace-nowrap tabular-nums md:text-right">
                    <span className="flex flex-col items-end">
                      <span className="font-semibold text-ink">{money(o.amount, o.currency)}</span>
                      {o.discount > 0 && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <s className="text-ink-3">{money(o.originalAmount, o.currency)}</s>
                          {o.couponCode && <Badge tone="buoy" className="px-2 py-0 font-mono">{o.couponCode}</Badge>}
                        </span>
                      )}
                    </span>
                  </Cell>
                  <Cell label="Provider">
                    {PROVIDER_LABEL[o.provider]}
                  </Cell>
                  <Cell label="Status">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {o.failureReason && (
                        <span title={o.failureReason} className="text-[#b23417]">
                          <CircleAlert className="size-4" aria-hidden />
                          <span className="sr-only">Reason: {o.failureReason}</span>
                        </span>
                      )}
                    </span>
                  </Cell>
                  <Cell label="Date" className="whitespace-nowrap tabular-nums">
                    {date(o.createdAt)}
                  </Cell>
                  <Cell actions>
                    <span className="flex flex-wrap gap-2 md:justify-end">
                      {canRefund && (
                        <Button size="sm" variant={o.status === "refund_pending" ? "danger" : "ghost"} className={cn(o.status === "paid" && "text-[#b23417]!")} onClick={() => setRefunding(o)}>
                          Refund order
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : o._id)}
                        icon={<ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />}
                      >
                        {open ? "Hide details" : "Details"}
                      </Button>
                    </span>
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </div>

      <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <RangeNote meta={list.data?.meta} />
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>

      <RefundDialog order={refunding} loading={refund.isPending} onClose={() => !refund.isPending && setRefunding(null)} onConfirm={(o) => refund.mutate(o)} />
    </>
  );
}

function OrderDetail({ order: o }: { order: AdminOrder }) {
  const items: [string, ReactNode][] = [
    ["Order ID", <span key="id" className="font-mono text-xs break-all">{o._id}</span>],
    ["Started", date(o.createdAt, dateTime)],
  ];
  if (o.paidAt) items.push(["Paid", date(o.paidAt, dateTime)]);
  if (o.refundedAt) items.push(["Refunded", date(o.refundedAt, dateTime)]);
  if (o.discount > 0) {
    items.push(["List price", money(o.originalAmount, o.currency)]);
    items.push(["Discount", `−${money(o.discount, o.currency)}`]);
  }
  if (o.platformFee !== undefined) items.push(["Platform fee", cash(o.platformFee, o.currency)]);
  if (o.instructorEarning !== undefined) items.push(["Instructor earning", cash(o.instructorEarning, o.currency)]);

  return (
    <div className="space-y-4">
      {o.failureReason && (
        <div className="flex gap-2 rounded-control bg-buoy-wash px-3 py-2.5 text-sm text-[#8a2a14]">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">{o.status === "refund_pending" ? "Why it needs a refund: " : "What went wrong: "}</span>
            {o.failureReason}
          </p>
        </div>
      )}
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-medium text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RefundDialog({ order, loading, onClose, onConfirm }: { order: AdminOrder | null; loading: boolean; onClose: () => void; onConfirm: (o: AdminOrder) => void }) {
  // Keep the last order on screen while the dialog animates out.
  const [last, setLast] = useState<AdminOrder | null>(order);
  if (order && order !== last) setLast(order);
  const o = order ?? last;
  if (!o) return null;

  const name = fullName(o.user) || o.user?.email || "this buyer";
  const course = o.course?.title || o.courseTitle || "this course";
  const amount = money(o.amount, o.currency);
  const movesMoney = o.amount > 0 && !NO_MONEY.has(o.provider);

  return (
    <ConfirmDialog
      open={Boolean(order)}
      onClose={onClose}
      title={o.amount > 0 ? `Refund ${amount} to ${name}?` : `Refund this order for ${name}?`}
      description={course}
      confirmLabel="Refund order"
      danger
      loading={loading}
      onConfirm={() => onConfirm(o)}
    >
      <p>
        {movesMoney
          ? `${amount} goes back to them through ${PROVIDER_LABEL[o.provider]}. This can't be undone.`
          : "This was a test or free order, so no money moves. This can't be undone."}
      </p>
      {o.status === "paid" ? (
        <p>
          Their access to <span className="font-semibold text-ink">{course}</span> is removed, along with any review or certificate from this purchase.
        </p>
      ) : (
        <p>They never got access to this course, so nothing else changes.</p>
      )}
    </ConfirmDialog>
  );
}
