"use client";

import { motion, useReducedMotion } from "motion/react";

/** Right-hand panel: concentric depth contours, slowly breathing. Decorative only. */
export function AuthArt() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="relative hidden overflow-hidden bg-night lg:block">
      <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {Array.from({ length: 14 }, (_, i) => (
          <motion.path
            key={i}
            d={`M ${300 - 30 - i * 26} 420 C ${300 - 30 - i * 26} ${300 - i * 30}, ${300 + 40 + i * 24} ${280 - i * 28}, ${300 + 40 + i * 24} ${410 + i * 4} S ${300 - 10 - i * 20} ${560 + i * 26}, ${300 - 30 - i * 26} 420 Z`}
            fill="none"
            strokeWidth={i === 4 ? 2 : 1.2}
            className={i === 4 ? "stroke-channel" : i < 4 ? "stroke-shoal/50" : "stroke-white/12"}
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 p-12 text-white">
        <p className="display max-w-md text-4xl" style={{ ["--wdth" as string]: 110 }}>
          Pick up exactly where you left off
        </p>
        <p className="mt-4 max-w-sm text-white/60">Your progress, certificates and wishlist follow your account on every device.</p>
      </div>
    </div>
  );
}
