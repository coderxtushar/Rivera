"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/format";
import { Spinner } from "./misc";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-channel text-white hover:bg-channel-deep shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]",
  secondary: "bg-foam text-ink ring-1 ring-inset ring-line-strong hover:ring-ink",
  ghost: "text-ink hover:bg-ink/6",
  danger: "bg-buoy text-white hover:bg-[#e8482a]",
  light: "bg-white text-ink hover:bg-shoal",
  quiet: "text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-[8px]",
  md: "h-11 px-5 text-[0.95rem] rounded-control",
  lg: "h-13 px-7 text-base rounded-control",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], variant === "quiet" ? "h-auto px-0" : sizes[size], className);
}

interface ButtonProps extends Omit<ComponentProps<typeof motion.button>, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </motion.button>
  );
});

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
