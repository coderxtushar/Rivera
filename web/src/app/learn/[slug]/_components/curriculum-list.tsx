"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, FileText, PlayCircle } from "lucide-react";
import { Collapse } from "@/components/ui/misc";
import { clock, cn, duration } from "@/lib/format";
import type { CurriculumSection } from "@/lib/types";

interface Props {
  slug: string;
  sections: CurriculumSection[];
  completed: Set<string>;
  currentId?: string;
  /** "dark" for the player sidebar, "light" inside the mobile sheet. */
  tone?: "dark" | "light";
  onNavigate?: () => void;
}

/** Sections with their lessons, check states and durations. Each lesson is a link (?lesson=id). */
export function CurriculumList({ slug, sections, completed, currentId, tone = "dark", onNavigate }: Props) {
  const dark = tone === "dark";
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav aria-label="Course content">
      <ol className="space-y-1">
        {sections.map((section) => {
          const open = !closed.has(section._id);
          const done = section.lessons.filter((l) => completed.has(l._id)).length;
          const total = section.lessons.length;
          const secs = section.lessons.reduce((sum, l) => sum + (l.durationSec || 0), 0);
          const panelId = `section-${section._id}-${tone}`;
          return (
            <li key={section._id}>
              <button
                type="button"
                onClick={() => toggle(section._id)}
                aria-expanded={open}
                aria-controls={panelId}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[12px] px-3 py-3 text-left transition-colors",
                  dark ? "hover:bg-white/5" : "hover:bg-ink/5",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-bold leading-snug", dark ? "text-white" : "text-ink")}>{section.title}</span>
                  <span className={cn("mt-1 flex gap-3 text-xs tabular-nums", dark ? "text-white/55" : "text-ink-3")}>
                    <span>
                      {done} of {total} done
                    </span>
                    {secs > 0 && <span>{duration(secs)}</span>}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn("mt-1 size-4 shrink-0 transition-transform duration-300", open && "rotate-180", dark ? "text-white/50" : "text-ink-3")}
                />
              </button>
              <Collapse open={open}>
                <ol id={panelId} className="pb-2">
                  {section.lessons.map((lesson) => {
                    const isDone = completed.has(lesson._id);
                    const current = lesson._id === currentId;
                    const Icon = lesson.type === "article" ? FileText : PlayCircle;
                    return (
                      <li key={lesson._id}>
                        <Link
                          href={`/learn/${slug}?lesson=${lesson._id}`}
                          replace
                          scroll={false}
                          onClick={onNavigate}
                          aria-current={current ? "true" : undefined}
                          className={cn(
                            "group relative flex items-start gap-3 rounded-[12px] px-3 py-2.5 text-sm transition-colors",
                            dark
                              ? current
                                ? "bg-white/10 text-white"
                                : "text-white/75 hover:bg-white/5 hover:text-white"
                              : current
                                ? "bg-channel-wash text-ink"
                                : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                          )}
                        >
                          {current && (
                            <span aria-hidden className={cn("absolute inset-y-2 left-0 w-[3px] rounded-full", dark ? "bg-shoal" : "bg-channel")} />
                          )}
                          <CheckDot done={isDone} current={current} dark={dark} />
                          <span className="min-w-0 flex-1">
                            <span className={cn("line-clamp-2 leading-snug", current && "font-semibold")}>{lesson.title}</span>
                            <span className={cn("mt-1 flex items-center gap-1.5 text-xs", dark ? "text-white/50" : "text-ink-3")}>
                              <Icon className="size-3.5" aria-hidden />
                              <span>{lesson.type === "article" ? "Article" : "Video"}</span>
                            </span>
                          </span>
                          {lesson.durationSec > 0 && (
                            <span className={cn("shrink-0 pt-0.5 text-xs tabular-nums", dark ? "text-white/55" : "text-ink-3")}>
                              <span className="sr-only">Length </span>
                              {clock(lesson.durationSec)}
                            </span>
                          )}
                          {isDone && <span className="sr-only">, completed</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </Collapse>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CheckDot({ done, current, dark }: { done: boolean; current: boolean; dark: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset transition-colors",
        done ? "ring-transparent" : current ? (dark ? "ring-shoal" : "ring-channel") : dark ? "ring-white/30" : "ring-line-strong",
      )}
    >
      <AnimatePresence initial={false}>
        {done && (
          <motion.span
            key="done"
            className="absolute inset-0 grid place-items-center rounded-full bg-reef"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
          >
            <Check className="size-3 text-white" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
