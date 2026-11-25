"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/** Tags as removable chips. Enter or comma adds; Backspace on an empty input removes the last. */
export function ChipInput({
  label,
  hint,
  error,
  value,
  onChange,
  max = 10,
  maxLength = 30,
  placeholder = "Add a tag",
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim().toLowerCase().slice(0, maxLength))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < max) next.push(p);
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-control bg-foam px-2 py-1.5 ring-1 ring-inset ring-line-strong transition-shadow focus-within:bg-white focus-within:ring-2 focus-within:ring-channel",
          error && "ring-buoy",
        )}
      >
        <AnimatePresence initial={false}>
          {value.map((tag) => (
            <motion.span
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
              className="inline-flex items-center gap-1 rounded-full bg-channel-wash py-0.5 pl-2.5 pr-1 text-sm font-semibold text-channel-deep"
            >
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="rounded-full p-0.5 hover:bg-channel/15" aria-label={`Remove tag ${tag}`}>
                <X className="size-3.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          disabled={full}
          placeholder={full ? `${max} tags is the limit` : placeholder}
          aria-describedby={`${id}-hint`}
          aria-invalid={error ? true : undefined}
          className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-ink placeholder:text-ink-3/80 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      <p id={`${id}-hint`} className={cn("text-xs", error ? "font-medium text-[#c23a1e]" : "text-ink-3")} role={error ? "alert" : undefined}>
        {error ?? hint ?? `Press Enter or comma to add. Up to ${max}.`}
      </p>
    </div>
  );
}
