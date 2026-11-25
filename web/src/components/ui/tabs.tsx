"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/format";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Segmented tabs; the active marker glides between options (shared layoutId). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  tone = "light",
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  tone?: "light" | "dark";
  /** Accessible name for the tab list. */
  label?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex gap-1 rounded-full p-1", tone === "light" ? "bg-ink/6" : "bg-white/8", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tone === "light" ? (active ? "text-white" : "text-ink-2 hover:text-ink") : active ? "text-ink" : "text-white/70 hover:text-white",
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className={cn("absolute inset-0 rounded-full", tone === "light" ? "bg-ink" : "bg-white")}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">
              {item.label}
              {item.count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{item.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
