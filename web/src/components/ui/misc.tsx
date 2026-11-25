"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn, initials } from "@/lib/format";
import type { PageMeta } from "@/lib/types";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-ink/8", className)} />;
}

type BadgeTone = "neutral" | "current" | "reef" | "buoy" | "ink";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-ink/6 text-ink-2",
  current: "bg-channel-wash text-channel-deep",
  reef: "bg-shoal/50 text-deep",
  buoy: "bg-buoy-wash text-[#b23417]",
  ink: "bg-ink text-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", badgeTones[tone], className)}>{children}</span>;
}

export function Avatar({
  user,
  size = 36,
  className,
}: {
  user?: { firstName?: string; lastName?: string; avatarUrl?: string } | null;
  size?: number;
  className?: string;
}) {
  if (user?.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-deep font-semibold text-shoal", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(user)}
    </span>
  );
}

/** Read-only star rating, with partial fill for fractional values. */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)} role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line-strong" style={{ width: size, height: size }} strokeWidth={0} fill="currentColor" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-[#f2a20c]" style={{ width: size, height: size }} strokeWidth={0} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Interactive 1–5 picker. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star className={cn("size-7", n <= value ? "text-[#f2a20c]" : "text-line-strong")} fill="currentColor" strokeWidth={0} />
        </motion.button>
      ))}
    </div>
  );
}

/** A horizontal fill bar; animates when the value changes. */
export function ProgressBar({ value, className, tone = "reef" }: { value: number; className?: string; tone?: "reef" | "current" | "shoal" }) {
  const color = { reef: "bg-reef", current: "bg-channel", shoal: "bg-shoal" }[tone];
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-ink/10", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn("h-full rounded-full", color)} initial={false} animate={{ width: `${value}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export function ProgressRing({ value, size = 44, stroke = 4, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute text-[0.7rem] font-bold tabular-nums">{children ?? `${value}%`}</span>
    </span>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex flex-col items-center overflow-hidden rounded-panel border border-dashed border-line-strong px-6 py-14 text-center", className)}>
      <svg aria-hidden viewBox="0 0 200 60" className="mb-5 w-40 text-reef/60">
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M0 ${20 + i * 12} C 40 ${8 + i * 12}, 60 ${34 + i * 12}, 100 ${20 + i * 12} S 160 ${8 + i * 12}, 200 ${20 + i * 12}`} fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
      </svg>
      <h3 className="display text-xl" style={{ ["--wdth" as string]: 90 }}>
        {title}
      </h3>
      {body && <p className="mt-2 max-w-md text-ink-3">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid size-10 place-items-center rounded-full hover:bg-ink/6 disabled:opacity-30" aria-label="Previous page">
        <ChevronLeft className="size-5" />
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-3">…</span>}
          <button
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn("relative grid size-10 place-items-center rounded-full text-sm font-semibold tabular-nums", p === page ? "text-white" : "hover:bg-ink/6")}
          >
            {p === page && <motion.span layoutId="page-dot" className="absolute inset-0 rounded-full bg-ink" />}
            <span className="relative">{p}</span>
          </button>
        </span>
      ))}
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="grid size-10 place-items-center rounded-full hover:bg-ink/6 disabled:opacity-30" aria-label="Next page">
        <ChevronRight className="size-5" />
      </button>
    </nav>
  );
}

/** Height-animated disclosure body. */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Page-level title block used across app pages. */
export function PageTitle({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-3xl sm:text-4xl" style={{ ["--wdth" as string]: 88 }}>
          {title}
        </h1>
        {sub && <p className="mt-2 max-w-2xl text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
