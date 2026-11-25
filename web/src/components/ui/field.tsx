"use client";

import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/format";

const control =
  "w-full rounded-control bg-foam text-ink placeholder:text-ink-3/80 ring-1 ring-inset ring-line-strong transition-[box-shadow,background] duration-200 hover:ring-ink-3 focus:outline-none focus:ring-2 focus:ring-channel focus:bg-white disabled:opacity-60 aria-[invalid=true]:ring-buoy";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-11 px-3.5", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-28 px-3.5 py-2.5 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        control,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='m1 1.5 5 5 5-5' stroke='%2334505f' stroke-width='1.6'/%3E%3C/svg%3E\")] bg-[right_0.9rem_center] bg-no-repeat pl-3.5 pr-9",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  /** Render prop gets the generated id + aria props to spread on the control. */
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs font-medium text-[#c23a1e]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Checkbox({ label, className, ...rest }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-2", className)}>
      <input type="checkbox" className="size-4 rounded accent-channel" {...rest} />
      {label}
    </label>
  );
}

/** Accessible on/off switch with a sliding knob. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-ink-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-channel" : "bg-line-strong",
        )}
      >
        <motion.span
          layout
          className="absolute top-1 size-4 rounded-full bg-white shadow"
          style={{ left: checked ? "1.25rem" : "0.25rem" }}
        />
      </button>
      {label}
    </label>
  );
}
