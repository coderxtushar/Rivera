"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/format";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Mark complete" toggle. Completing draws the check, fills the dot and sends
 * two rings out like a ripple on water. Un-completing just reverses the check.
 */
export function CompleteButton({ done, onToggle, className }: { done: boolean; onToggle: () => void; className?: string }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "relative inline-flex h-12 shrink-0 items-center gap-3 rounded-control pl-3 pr-5 font-semibold transition-colors duration-300",
        done ? "bg-reef/20 text-shoal ring-1 ring-inset ring-shoal/40 hover:bg-reef/30" : "bg-white text-ink hover:bg-shoal",
        className,
      )}
    >
      <span className="relative grid size-7 place-items-center" aria-hidden>
        <AnimatePresence initial={false}>
          {done &&
            [0, 1].map((i) => (
              <motion.span
                key={`ripple-${i}`}
                className="absolute inset-0 rounded-full border-2 border-shoal"
                initial={{ scale: 1, opacity: 0.9 }}
                animate={{ scale: 2.8 + i * 0.6, opacity: 0 }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }}
              />
            ))}
        </AnimatePresence>
        <motion.svg viewBox="0 0 28 28" className="size-7" initial={false} animate={{ scale: done ? [1, 1.18, 1] : 1 }} transition={{ duration: 0.45, ease: EASE }}>
          <motion.circle
            cx="14"
            cy="14"
            r="12"
            strokeWidth="2"
            initial={false}
            animate={{
              fill: done ? "var(--color-shoal)" : "rgba(0,0,0,0)",
              stroke: done ? "var(--color-shoal)" : "var(--color-ink-3)",
            }}
            transition={{ duration: 0.25 }}
          />
          <motion.path
            d="M8.5 14.5l3.6 3.6L19.5 10.4"
            fill="none"
            stroke="var(--color-night)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ duration: done ? 0.4 : 0.15, delay: done ? 0.08 : 0, ease: EASE }}
          />
        </motion.svg>
      </span>
      <span>{done ? "Completed" : "Mark complete"}</span>
    </motion.button>
  );
}
