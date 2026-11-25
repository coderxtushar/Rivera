"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Info, X } from "lucide-react";
import { cn } from "@/lib/format";

type Tone = "success" | "error" | "info";
interface Item {
  id: number;
  tone: Tone;
  message: string;
}

let items: Item[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(tone: Tone, message: string, ms = 4200) {
  const id = nextId++;
  items = [...items.slice(-3), { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), ms);
}

function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

/** Fire-and-forget notifications: toast.success("Saved"). */
export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m, 6000),
  info: (m: string) => push("info", m),
};

const icons = { success: Check, error: X, info: Info };
const tones = {
  success: "bg-reef text-white",
  error: "bg-buoy text-white",
  info: "bg-channel text-white",
};

const EMPTY: Item[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
    () => EMPTY,
  );

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
              className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-card bg-ink py-3 pl-3 pr-2 text-sm text-white shadow-float"
              role={t.tone === "error" ? "alert" : "status"}
            >
              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", tones[t.tone])}>
                <Icon className="size-3.5" strokeWidth={3} />
              </span>
              <p className="flex-1 leading-snug">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="rounded p-1 text-white/60 hover:text-white" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
