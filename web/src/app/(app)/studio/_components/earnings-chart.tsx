"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Collapse } from "@/components/ui/misc";
import { cn, plural } from "@/lib/format";
import { amount, compactMoney } from "./lib";

export interface MonthPoint {
  key: string; // "2026-03"
  short: string; // "Mar"
  long: string; // "March 2026"
  earnings: number; // minor units
  sales: number;
}

/** The last 12 calendar months (UTC, matching the API's grouping), oldest first, zero-filled. */
export function lastTwelveMonths(now: Date, rows: { month: string; earnings: number; sales: number }[]): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const match = rows.filter((r) => r.month === key);
    out.push({
      key,
      short: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(d),
      long: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
      earnings: match.reduce((s, r) => s + r.earnings, 0),
      sales: match.reduce((s, r) => s + r.sales, 0),
    });
  }
  return out;
}

/** Round the axis top up to 1, 2, 2.5 or 5 × 10^n (in major units) so ticks land on clean values. */
function niceScale(maxMinor: number, count = 4) {
  const max = Math.max(maxMinor / 100, 1);
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100));
  return { top: top * 100, ticks };
}

const PLOT_H = 220;
const TOP = 24; // room for the direct label above the tallest bar
const AXIS_H = 28;
const LEFT = 56;
const RIGHT = 8;
const EASE = [0.22, 1, 0.36, 1] as const;

/** Single-series monthly earnings columns. No legend: the panel title names the series. */
export function EarningsChart({ data, currency }: { data: MonthPoint[]; currency: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const reduce = useReducedMotion();
  const clipId = `clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(...data.map((d) => d.earnings));
  const { top, ticks } = useMemo(() => niceScale(max), [max]);
  const maxIndex = max > 0 ? data.findIndex((d) => d.earnings === max) : -1;

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const band = plotW / data.length;
  const barW = Math.min(24, Math.max(6, band * 0.62));
  const baseline = TOP + PLOT_H;
  const y = (v: number) => baseline - (v / top) * PLOT_H;
  const cx = (i: number) => LEFT + band * i + band / 2;
  const thinLabels = band < 34;

  const activePoint = active !== null ? data[active] : null;

  return (
    <div>
      <div ref={wrap} className="relative" style={{ height: TOP + PLOT_H + AXIS_H }}>
        {width > 0 && (
          <svg width={width} height={TOP + PLOT_H + AXIS_H} role="group" aria-label={`Earnings by month in ${currency}, last 12 months`} className="block overflow-visible">
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={width} height={baseline} />
              </clipPath>
            </defs>

            {/* Recessive hairline grid and tick labels */}
            {ticks.map((t) => (
              <g key={t} aria-hidden>
                <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-line-strong" : "stroke-line"} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={LEFT - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
                  {t === 0 ? amount(0, currency) : compactMoney(t, currency)}
                </text>
              </g>
            ))}

            {/* Columns: 4px rounded cap, square at the baseline (the overhang is clipped). */}
            <g clipPath={`url(#${clipId})`}>
              {data.map((d, i) => {
                if (d.earnings <= 0) return null;
                const h = baseline - y(d.earnings);
                return (
                  <motion.rect
                    key={d.key}
                    x={cx(i) - barW / 2}
                    width={barW}
                    rx={4}
                    initial={reduce ? false : { y: baseline, height: 0 }}
                    animate={{ y: baseline - h, height: h + 4 }}
                    transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : i * 0.035 }}
                    className={cn("transition-[fill] duration-150", active === i ? "fill-channel" : "fill-deep")}
                  />
                );
              })}
            </g>

            {/* Direct label on the best month only */}
            {maxIndex > -1 && active !== maxIndex && (
              <motion.text
                aria-hidden
                x={cx(maxIndex)}
                y={y(max) - 8}
                textAnchor="middle"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 0.7 }}
                className="fill-ink-2 text-[11px] font-semibold tabular-nums"
              >
                {compactMoney(max, currency)}
              </motion.text>
            )}

            {/* Month labels */}
            {data.map((d, i) => {
              // When space is tight, label every other month counting back from the latest.
              const show = !thinLabels || (data.length - 1 - i) % 2 === 0;
              return show ? (
                <text key={d.key} aria-hidden x={cx(i)} y={baseline + 18} textAnchor="middle" className={cn("text-[11px]", active === i ? "fill-ink font-semibold" : "fill-ink-3")}>
                  {d.short}
                </text>
              ) : null;
            })}

            {/* Hit targets: the whole column band, focusable, with the full reading as its name */}
            {data.map((d, i) => (
              <rect
                key={d.key}
                x={LEFT + band * i}
                y={TOP}
                width={band}
                height={PLOT_H}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${d.long}: ${amount(d.earnings, currency)} from ${plural(d.sales, "sale")}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={(e) => {
                  setActive(i);
                  setKeyboard(e.currentTarget.matches(":focus-visible"));
                }}
                onBlur={() => {
                  setActive((a) => (a === i ? null : a));
                  setKeyboard(false);
                }}
                className="cursor-default outline-none"
              />
            ))}
            {active !== null && (
              <rect
                aria-hidden
                x={LEFT + band * active + 1}
                y={TOP}
                width={Math.max(0, band - 2)}
                height={PLOT_H}
                rx={6}
                strokeWidth={keyboard ? 2 : 0}
                className="pointer-events-none fill-ink/[0.04] stroke-channel"
              />
            )}
          </svg>
        )}

        {activePoint && active !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-full rounded-control bg-ink px-3 py-2 text-white shadow-float"
            style={{
              left: Math.min(Math.max(cx(active), 70), width - 70),
              top: Math.max(y(activePoint.earnings) - 10, 46),
            }}
          >
            <p className="text-sm font-bold tabular-nums">{amount(activePoint.earnings, currency)}</p>
            <p className="text-xs text-white/70">{activePoint.long}</p>
            <p className="text-xs text-white/70">{plural(activePoint.sales, "sale")}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable} className="text-sm font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
          {showTable ? "Hide table" : "Show as table"}
        </button>
      </div>
      <Collapse open={showTable}>
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Earnings by month in {currency}</caption>
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th scope="col" className="py-2 font-semibold">Month</th>
              <th scope="col" className="py-2 text-right font-semibold">Sales</th>
              <th scope="col" className="py-2 text-right font-semibold">Earnings</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...data].reverse().map((d) => (
              <tr key={d.key} className="border-b border-line/70 last:border-0">
                <th scope="row" className="py-2 text-left font-medium text-ink-2">{d.long}</th>
                <td className="py-2 text-right text-ink-2">{d.sales}</td>
                <td className="py-2 text-right font-semibold text-ink">{amount(d.earnings, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Collapse>
    </div>
  );
}
