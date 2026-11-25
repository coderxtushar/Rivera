"use client";

import { useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Badge, EmptyState, PageTitle, Pagination } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { cn, date, money } from "@/lib/format";
import type { Coupon, Paged } from "@/lib/types";
import { toMinor, useMyCourses } from "../_components/lib";
import { ConfirmDialog, ErrorState, RowsSkeleton } from "../_components/ui";

const KEY = ["studio", "coupons"];

export default function CouponsPage() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const qc = useQueryClient();
  const courses = useMyCourses();

  const coupons = useQuery({
    queryKey: [...KEY, page],
    queryFn: () => api<Paged<Coupon>>("/coupons", { query: { page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api<{ data: { coupon: Coupon } }>(`/coupons/${id}`, { method: "PATCH", body: { isActive } }),
    onMutate: ({ id, isActive }) => {
      qc.setQueryData<Paged<Coupon>>([...KEY, page], (old) => (old ? { ...old, data: old.data.map((c) => (c._id === id ? { ...c, isActive } : c)) } : old));
    },
    onSuccess: (_r, v) => toast.success(v.isActive ? "Coupon turned on" : "Coupon turned off"),
    onError: (err) => {
      toast.error(errorMessage(err));
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (c: Coupon) => api(`/coupons/${c._id}`, { method: "DELETE" }),
    onSuccess: (_r, c) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(c.redemptionCount > 0 ? "Coupon turned off" : "Coupon deleted");
      setDeleting(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const hasCourses = (courses.data?.length ?? 0) > 0;
  const [now] = useState(() => Date.now());
  // The coupon list only carries the course title, so look up its currency for fixed discounts.
  const currencyOf = (c: Coupon) => {
    const id = typeof c.course === "object" && c.course ? c.course._id : c.course;
    return courses.data?.find((x) => x._id === id)?.currency ?? "INR";
  };
  const createButton = (
    <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)} disabled={courses.isSuccess && !hasCourses}>
      Create coupon
    </Button>
  );

  return (
    <PageFade>
      <PageTitle title="Coupons" sub="Discount codes for your courses. Share a code and students enter it at checkout." action={createButton} />

      {coupons.isPending ? (
        <RowsSkeleton rows={4} />
      ) : coupons.isError ? (
        <ErrorState message={errorMessage(coupons.error)} onRetry={() => coupons.refetch()} />
      ) : coupons.data.data.length === 0 ? (
        courses.isSuccess && !hasCourses ? (
          <EmptyState title="Create a course first" body="Coupons belong to a course. Once you have one, you can make codes for launches, partners or students who ask." action={<ButtonLink href="/studio/courses/new">Create course</ButtonLink>} />
        ) : (
          <EmptyState title="No coupons yet" body="Make a code for a launch, a partner newsletter or a student who asked nicely." action={createButton} />
        )
      ) : (
        <div className="space-y-5">
          <ul className={cn("divide-y divide-line rounded-panel border border-line bg-foam transition-opacity", coupons.isPlaceholderData && "opacity-60")}>
            <AnimatePresence initial={false}>
              {coupons.data.data.map((c) => (
                <motion.li key={c._id} layout exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  <CouponRow coupon={c} now={now} currency={currencyOf(c)} onToggle={(isActive) => toggle.mutate({ id: c._id, isActive })} onDelete={() => setDeleting(c)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Pagination meta={coupons.data.meta} onPage={setPage} />
        </div>
      )}

      <CreateCouponDialog open={creating} onClose={() => setCreating(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting && deleting.redemptionCount > 0 ? "Turn off this coupon?" : "Delete this coupon?"}
        confirmLabel={deleting && deleting.redemptionCount > 0 ? "Turn off coupon" : "Delete coupon"}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        body={
          deleting && deleting.redemptionCount > 0 ? (
            <p>
              <strong className="font-mono text-ink">{deleting.code}</strong> has already been used, so it stays in your sales history. It will be turned off and nobody can use it again.
            </p>
          ) : (
            <p>
              <strong className="font-mono text-ink">{deleting?.code}</strong> will be removed for good.
            </p>
          )
        }
      />
    </PageFade>
  );
}

function CouponRow({ coupon: c, now, currency, onToggle, onDelete }: { coupon: Coupon; now: number; currency: string; onToggle: (v: boolean) => void; onDelete: () => void }) {
  const course = typeof c.course === "object" && c.course ? c.course : null;
  const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < now : false;
  const usedUp = c.maxRedemptions != null && c.redemptionCount >= c.maxRedemptions;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:px-5">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[6px] bg-ink/6 px-2 py-0.5 font-mono text-sm font-bold tracking-wide text-ink">{c.code}</span>
          <span className="text-sm font-semibold text-ink-2">{c.type === "percent" ? `${c.value}% off` : `${money(c.value, currency)} off`}</span>
          {expired && <Badge tone="buoy">Expired</Badge>}
          {!expired && usedUp && <Badge tone="buoy">Used up</Badge>}
        </div>
        <p className="mt-1 truncate text-sm text-ink-3">{course ? course.title : "All courses"}</p>
      </div>
      <dl className="flex gap-6 text-sm">
        <div>
          <dt className="text-xs text-ink-3">Used</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {c.redemptionCount}
            <span className="font-normal text-ink-3"> / {c.maxRedemptions ?? "no limit"}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Expires</dt>
          <dd className="font-semibold text-ink">{c.expiresAt ? date(c.expiresAt) : "Never"}</dd>
        </div>
      </dl>
      <div className="flex items-center gap-3">
        <Switch checked={c.isActive} onChange={onToggle} label={<span className="w-7">{c.isActive ? "On" : "Off"}</span>} />
        <button type="button" onClick={onDelete} className="grid size-9 place-items-center rounded-control text-ink-3 hover:bg-buoy-wash hover:text-[#b23417]" aria-label={`Delete coupon ${c.code}`} title="Delete coupon">
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function CreateCouponDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Create coupon" description="Codes are not case sensitive for students.">
      {open && <CreateCouponForm onDone={onClose} />}
    </Dialog>
  );
}

function CreateCouponForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const courses = useMyCourses();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [course, setCourse] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedCourse = courses.data?.find((c) => c._id === course);
  const currency = selectedCourse?.currency ?? "INR";

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ data: { coupon: Coupon } }>("/coupons", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Coupon created");
      onDone();
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(errorMessage(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(c)) next.code = "Use 3 to 32 letters, digits, hyphens or underscores.";
    let amountValue: number | null = null;
    if (type === "percent") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 100) next.value = "Enter a whole percentage from 1 to 100.";
      else amountValue = n;
    } else {
      const minor = toMinor(value);
      if (minor === null || minor < 1) next.value = "Enter an amount like 100 or 99.50.";
      else amountValue = minor;
    }
    if (!course) next.course = "Pick the course this code applies to.";
    let maxRedemptions: number | null = null;
    if (maxUses.trim()) {
      const n = Number(maxUses);
      if (!Number.isInteger(n) || n < 1) next.maxRedemptions = "Enter a whole number, or leave empty for no limit.";
      else maxRedemptions = n;
    }
    let expiresAt: string | null = null;
    if (expires) {
      const d = new Date(`${expires}T23:59:59`);
      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) next.expiresAt = "Pick a date from today on.";
      else expiresAt = d.toISOString();
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate({ code: c, type, value: amountValue, course, maxRedemptions, expiresAt });
  };

  const price = selectedCourse?.price;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Code" error={errors.code} hint="Letters, digits, hyphens and underscores.">
        {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={32} placeholder="LAUNCH20" className="font-mono uppercase tracking-wide" autoComplete="off" />}
      </Field>

      <Field label="Course" error={errors.course}>
        {(p) => (
          <Select {...p} value={course} onChange={(e) => setCourse(e.target.value)} disabled={courses.isPending}>
            <option value="">{courses.isPending ? "Loading your courses" : "Choose a course"}</option>
            {courses.data?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex flex-col gap-1.5" role="group" aria-labelledby="discount-type-label">
        <span id="discount-type-label" className="text-sm font-semibold text-ink-2">
          Discount
        </span>
        <Tabs
          items={[
            { value: "percent", label: "Percentage" },
            { value: "fixed", label: "Fixed amount" },
          ]}
          value={type}
          onChange={(t) => (setType(t), setValue(""))}
          className="self-start"
        />
      </div>

      <Field
        label={type === "percent" ? "Percent off" : `Amount off (${currency})`}
        error={errors.value}
        hint={
          type === "fixed" && price ? `Course price is ${money(price, currency)}.` : type === "percent" && price && Number(value) > 0 && Number(value) <= 100 ? `Students pay ${money(Math.round(price * (1 - Number(value) / 100)), currency)}.` : undefined
        }
      >
        {(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} inputMode={type === "percent" ? "numeric" : "decimal"} placeholder={type === "percent" ? "20" : "100"} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Maximum uses" error={errors.maxRedemptions} hint="Optional. Empty means no limit.">
          {(p) => <Input {...p} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="No limit" />}
        </Field>
        <Field label="Expires on" error={errors.expiresAt} hint="Optional. Works until the end of that day.">
          {(p) => <Input {...p} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />}
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Create coupon
        </Button>
      </div>
    </form>
  );
}
