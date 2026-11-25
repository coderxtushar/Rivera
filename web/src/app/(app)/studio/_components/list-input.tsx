"use client";

import { useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/** An editable list of short lines (requirements, outcomes). Empty lines are dropped on save. */
export function ListInput({
  label,
  hint,
  error,
  value,
  onChange,
  addLabel,
  placeholder,
  max = 20,
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string[];
  onChange: (v: string[]) => void;
  addLabel: string;
  placeholder?: string;
  max?: number;
}) {
  const id = useId();
  const list = useRef<HTMLUListElement>(null);
  // Rows present when the field mounts don't animate in; only rows you add do.
  const [initialCount] = useState(value.length);

  const focusRow = (i: number) => requestAnimationFrame(() => list.current?.querySelectorAll("input")[i]?.focus());

  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
    focusRow(value.length);
  };

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={`${id}-hint`}>
      <legend className="mb-1.5 text-sm font-semibold text-ink-2">{label}</legend>
      <ul ref={list} className="flex flex-col gap-2">
          {value.map((item, i) => (
            <motion.li
              // Rows have no ids, so only the arrival of a new row animates; removal is instant.
              key={i}
              initial={i < initialCount ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <Input
                value={item}
                aria-label={`${label}, item ${i + 1}`}
                maxLength={200}
                placeholder={placeholder}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === value.length - 1) add();
                    else focusRow(i + 1);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="grid size-11 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-ink/6 hover:text-ink"
                aria-label={`Remove item ${i + 1}`}
              >
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
      </ul>
      <div>
        <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={add} disabled={value.length >= max} className="-ml-3">
          {addLabel}
        </Button>
      </div>
      <p id={`${id}-hint`} className={error ? "text-xs font-medium text-[#c23a1e]" : "text-xs text-ink-3"} role={error ? "alert" : undefined}>
        {error ?? hint ?? `Up to ${max}.`}
      </p>
    </fieldset>
  );
}
