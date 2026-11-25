"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Award, Star, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;
const RINGS = 7;

/** A closed contour around the centre: a circle with a gentle, seeded wobble. */
function contourRing(radius: number, seed: number) {
  const pts: string[] = [];
  const steps = 72;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius * (1 + 0.045 * Math.sin(3 * t + seed) + 0.03 * Math.sin(5 * t - seed * 1.7) + 0.015 * Math.sin(9 * t + seed * 0.6));
    pts.push(`${(Math.cos(t) * r).toFixed(1)},${(Math.sin(t) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L")}Z`;
}

const RING_PATHS = Array.from({ length: RINGS }, (_, i) => contourRing(70 + i * 46, i * 1.3));
const RING_CLASS = ["stroke-shoal", "stroke-reef", "stroke-channel", "stroke-shoal", "stroke-reef", "stroke-deep", "stroke-reef"];

interface Props {
  open: boolean;
  courseTitle: string;
  certificateCode?: string;
  canReview: boolean;
  onReview: () => void;
  onClose: () => void;
}

/** Course finished: contour ripples spread out from the centre like a stone dropped in the river. */
export function Celebration({ open, courseTitle, certificateCode, canReview, onReview, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restore?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-night/95 px-4 text-white backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <svg viewBox="-400 -400 800 800" className="pointer-events-none absolute left-1/2 top-1/2 size-[max(140vmax,900px)] -translate-x-1/2 -translate-y-1/2" aria-hidden>
            {RING_PATHS.map((d, i) => (
              <motion.path
                key={i}
                d={d}
                fill="none"
                strokeWidth={i === 2 ? 2.2 : 1.3}
                vectorEffect="non-scaling-stroke"
                className={RING_CLASS[i]}
                initial={{ scale: 0.15, opacity: 0 }}
                animate={{ scale: [0.15, 1.08, 1], opacity: [0, 0.95, i === 2 ? 0.55 : 0.28] }}
                transition={{ duration: 2.2, delay: 0.1 + i * 0.16, ease: EASE, times: [0, 0.75, 1] }}
              />
            ))}
            {/* One last, faster wave that passes through and fades. */}
            <motion.circle
              r={60}
              fill="none"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="stroke-shoal"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 7, opacity: 0 }}
              transition={{ duration: 1.6, delay: 0.05, ease: EASE }}
            />
          </svg>

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="celebration-title"
            aria-describedby="celebration-body"
            className="relative flex max-w-xl flex-col items-center text-center"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
          >
            <motion.span
              className="grid size-20 place-items-center rounded-full bg-shoal text-night shadow-[0_0_0_10px_rgb(154_219_208/0.15)]"
              initial={{ scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 }}
              aria-hidden
            >
              <Award className="size-9" strokeWidth={2.2} />
            </motion.span>
            <h2 id="celebration-title" className="display mt-7 text-3xl text-white sm:text-4xl" style={{ ["--wdth" as string]: 96 }}>
              You finished {courseTitle}
            </h2>
            <p id="celebration-body" className="mt-4 max-w-md text-white/75">
              Every lesson, done. {certificateCode ? "Your certificate is ready, with a public link anyone can use to check it." : "Your certificate is on its way."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {certificateCode && (
                <ButtonLink href={`/certificates/${certificateCode}`} variant="light" icon={<Award className="size-4" />} data-autofocus>
                  View certificate
                </ButtonLink>
              )}
              {canReview && (
                <Button
                  variant="ghost"
                  className="text-white ring-1 ring-inset ring-white/30 hover:bg-white/10"
                  icon={<Star className="size-4" />}
                  onClick={onReview}
                  data-autofocus={certificateCode ? undefined : true}
                >
                  Leave a review
                </Button>
              )}
            </div>
            <Link href="/dashboard" className="mt-6 text-sm font-semibold text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">
              Back to my learning
            </Link>
          </motion.div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
