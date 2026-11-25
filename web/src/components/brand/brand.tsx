"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { cn, hueFrom, LEVELS } from "@/lib/format";
import type { Level } from "@/lib/types";

/* ------------------------------------------------------------------ logo */

export function Logo({ className, tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Rivera home">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" className={tone === "ink" ? "fill-ink" : "fill-white"} />
        {[11, 16, 21].map((y, i) => (
          <path
            key={y}
            d={`M6 ${y} C 10 ${y - 4}, 14 ${y + 4}, 18 ${y} S 24 ${y - 4}, 26 ${y}`}
            fill="none"
            strokeWidth="2.2"
            strokeLinecap="round"
            className={cn(
              "transition-transform duration-500 group-hover:translate-x-[1.5px]",
              i === 1 ? "stroke-channel" : tone === "ink" ? "stroke-shoal" : "stroke-deep",
            )}
          />
        ))}
      </svg>
      <span className={cn("display text-[1.35rem] leading-none", tone === "ink" ? "text-ink" : "text-white")} style={{ ["--wdth" as string]: 125 }}>
        Rivera
      </span>
    </Link>
  );
}

/* ----------------------------------------------------------- depth gauge */

/** Course level as water depth: one band for beginner, three for advanced. */
export function DepthGauge({ level, showLabel = true, tone = "ink", className }: { level: Level; showLabel?: boolean; tone?: "ink" | "light"; className?: string }) {
  const { label, depth } = LEVELS[level] ?? LEVELS.all;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", tone === "ink" ? "text-ink-2" : "text-white/80", className)} title={label}>
      <svg viewBox="0 0 18 14" className="h-3.5 w-[18px]" aria-hidden>
        {[3, 7, 11].map((y, i) => {
          const on = depth === 0 || i < depth;
          return (
            <path
              key={y}
              d={`M1 ${y} q 4 -2.6 8 0 t 8 0`}
              fill="none"
              strokeWidth="1.8"
              strokeLinecap="round"
              className={on ? (depth === 0 ? "stroke-reef" : "stroke-deep") : tone === "ink" ? "stroke-line-strong" : "stroke-white/25"}
              style={tone === "light" && on ? { stroke: "var(--color-shoal)" } : undefined}
            />
          );
        })}
      </svg>
      {showLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}

/* --------------------------------------------------------- course cover */

/** Generated cover for courses without a thumbnail: contours tinted by the course id. */
export function CourseCover({ seed, title, className }: { seed: string; title?: string; className?: string }) {
  const h = hueFrom(seed);
  const lines = Array.from({ length: 7 }, (_, i) => i);
  const phase = (h % 40) - 20;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={cn("size-full", className)} role="img" aria-label={title ? `Cover for ${title}` : "Course cover"}>
      <rect width="320" height="180" fill={`hsl(${h} 38% 20%)`} />
      {lines.map((i) => {
        const y = 30 + i * 20;
        return (
          <path
            key={i}
            d={`M-10 ${y + phase / 3} C 70 ${y - 26 + phase}, 130 ${y + 30 - phase}, 200 ${y} S 290 ${y - 24}, 340 ${y + 6}`}
            fill="none"
            stroke={i === 3 ? `hsl(${(h + 150) % 360} 85% 70%)` : `hsl(${h} 45% ${48 + i * 4}%)`}
            strokeOpacity={i === 3 ? 0.95 : 0.55}
            strokeWidth={i === 3 ? 2.4 : 1.2}
          />
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------- contour river */

const W = 1600;
const H = 720;

/** Centre line of the river: a meander drifting from upper-left to lower-right. */
function riverY(x: number) {
  const t = x / W;
  return 300 + t * 220 + 70 * Math.sin(t * Math.PI * 2.2 + 0.6) + 26 * Math.sin(t * Math.PI * 5.1);
}

function contour(offset: number, wobble: number) {
  const pts: string[] = [];
  for (let x = -40; x <= W + 40; x += 40) {
    const y = riverY(x) + offset + wobble * Math.sin(x / 140 + offset / 30);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

export const RIVER_SIZE = { W, H, riverY };

/**
 * The hero's signature moment: contour lines draw in from the channel outwards,
 * then three dashed "currents" keep flowing. Static under reduced motion.
 */
export function ContourRiver({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const offsets = [-210, -165, -125, -90, -60, -34, 34, 60, 90, 125, 165, 210];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("pointer-events-none", className)} aria-hidden>
      <defs>
        <linearGradient id="river-fade" x1="0" x2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.12" stopColor="white" stopOpacity="1" />
          <stop offset="0.88" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="river-mask">
          <rect width={W} height={H} fill="url(#river-fade)" />
        </mask>
      </defs>

      <g mask="url(#river-mask)">
        {/* Channel body */}
        <motion.path
          d={`${contour(-26, 4)} L${W + 40},${H + 200} L-40,${H + 200} Z`}
          className="fill-shoal/25"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.8, delay: 0.6 }}
        />
        <path d={`${contour(26, 4)} L${W + 40},${H + 200} L-40,${H + 200} Z`} className="fill-mist/70" />

        {offsets.map((o, i) => {
          const dist = Math.abs(o);
          return (
            <motion.path
              key={o}
              d={contour(o, 6 + dist / 18)}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={dist < 70 ? 1.6 : 1}
              className={dist < 70 ? "stroke-deep/60" : "stroke-reef/45"}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.2, delay: 0.15 + (dist / 210) * 0.9 + (i % 2) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}

        {/* Flowing currents along the channel */}
        {[-12, 0, 12].map((o, i) => (
          <motion.path
            key={o}
            d={contour(o, 2)}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={i === 1 ? 2.4 : 1.4}
            strokeLinecap="round"
            strokeDasharray={i === 1 ? "28 56" : "10 40"}
            className={i === 1 ? "stroke-channel" : "stroke-channel/50"}
            initial={reduce ? false : { opacity: 0, strokeDashoffset: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, strokeDashoffset: i === 1 ? -840 : -500 }}
            transition={{
              opacity: { duration: 1, delay: 1.4 },
              strokeDashoffset: { duration: i === 1 ? 14 : 18, ease: "linear", repeat: Infinity },
            }}
          />
        ))}
      </g>
    </svg>
  );
}
