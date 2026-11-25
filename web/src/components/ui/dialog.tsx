"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** "center" modal, or a "sheet" that slides in from the right. */
  variant?: "center" | "sheet";
}

export function Dialog({ open, onClose, title, description, children, className, variant = "center" }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        // Keep focus inside the dialog.
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
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
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const sheet = variant === "sheet";
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-[90] flex", sheet ? "justify-end" : "items-end justify-center p-0 sm:items-center sm:p-6")}>
          <motion.div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={sheet ? { x: "100%" } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={sheet ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={sheet ? { x: "100%" } : { opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.15 } }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-foam shadow-float",
              sheet ? "h-dvh max-h-none max-w-xl" : "max-w-lg rounded-t-panel sm:rounded-panel",
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <h2 id={titleId} className="display text-xl" style={{ ["--wdth" as string]: 90 }}>
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
              </div>
              <button data-close onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-3 hover:bg-ink/6 hover:text-ink" aria-label="Close">
                <X className="size-5" />
              </button>
            </header>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
