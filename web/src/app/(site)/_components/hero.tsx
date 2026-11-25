"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Search } from "lucide-react";
import { ContourRiver, RIVER_SIZE } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/lib/public-queries";

/** Where category "soundings" sit along the river, as fractions of its length. */
const SOUNDING_X = [0.08, 0.22, 0.37, 0.52, 0.66, 0.8, 0.92];

export function Hero() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const { data: categories } = useCategories();
  const soundings = (categories ?? [])
    .filter((c) => (c.courseCount ?? 0) > 0)
    .sort((a, b) => (b.courseCount ?? 0) - (a.courseCount ?? 0))
    .slice(0, SOUNDING_X.length);
  const chips = soundings.length ? soundings : (categories ?? []).slice(0, 6);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
  };

  return (
    <section className="relative isolate -mt-16 overflow-hidden pt-16">
      <ContourRiver className="absolute inset-x-0 bottom-0 top-[56%] -z-10 h-[44%] w-full lg:top-[48%] lg:h-[52%]" />

      <div className="mx-auto flex min-h-[min(96dvh,940px)] max-w-7xl flex-col px-4 pb-[46vh] pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-[40vh]">
        <motion.h1
          className="display max-w-[15ch] text-[clamp(2.6rem,7.2vw,6.4rem)] leading-[0.92] text-ink"
          initial={reduce ? false : { ["--wdth" as string]: 150, opacity: 0 }}
          animate={{ ["--wdth" as string]: 104, opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ ["--wdth" as string]: 104 }}
        >
          Go deeper into what you want to learn
        </motion.h1>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl"
        >
          <p className="text-lg text-ink-2">
            Video courses from independent instructors. Watch the free lessons first, pay once for the rest, and keep access for good.
          </p>

          <form onSubmit={submit} role="search" className="mt-8 flex max-w-lg items-center gap-2 rounded-[14px] bg-foam p-1.5 shadow-lift ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-channel">
            <Search className="ml-2.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <label htmlFor="hero-search" className="sr-only">
              Search courses
            </label>
            <input
              id="hero-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try React, pandas or UI design"
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3/80 focus:outline-none"
            />
            <Button type="submit" className="shrink-0">
              Search
            </Button>
          </form>

          {chips.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2 lg:hidden">
              {chips.map((c) => (
                <li key={c._id}>
                  <Link href={`/courses?category=${c.slug}`} className="inline-block rounded-full bg-foam/80 px-3 py-1.5 text-sm font-semibold text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-3">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>

      {/* Depth soundings: categories placed along the channel, with their course counts. */}
      {soundings.length > 0 && (
        <nav aria-label="Popular categories" className="absolute inset-x-0 bottom-0 top-[48%] hidden lg:block">
          <ul>
            {soundings.map((c, i) => {
              const fx = SOUNDING_X[i];
              const y = RIVER_SIZE.riverY(fx * RIVER_SIZE.W) + (i % 2 ? 62 : -78);
              return (
                <motion.li
                  key={c._id}
                  className="absolute"
                  style={{ left: `${fx * 100}%`, top: `${(y / RIVER_SIZE.H) * 100}%` }}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + i * 0.08, duration: 0.5 }}
                >
                  <Link
                    href={`/courses?category=${c.slug}`}
                    className="group flex -translate-x-1/2 items-baseline gap-1.5 whitespace-nowrap rounded-full bg-mist/70 px-2.5 py-1 backdrop-blur-[2px] transition-colors hover:bg-ink hover:text-white"
                  >
                    <span className="display-narrow text-[1.05rem] tabular-nums text-deep group-hover:text-shoal">{c.courseCount}</span>
                    <span className="text-sm font-semibold">{c.name}</span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </nav>
      )}
    </section>
  );
}
