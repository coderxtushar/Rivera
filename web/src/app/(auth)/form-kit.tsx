"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthHeading({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="display text-4xl" style={{ ["--wdth" as string]: 96 }}>
        {title}
      </h1>
      {sub && <p className="mt-2 text-ink-3">{sub}</p>}
    </div>
  );
}

export function AuthSwitch({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <p className="mt-8 text-sm text-ink-3">
      {text}{" "}
      <Link href={href} className="font-semibold text-channel underline decoration-channel/30 underline-offset-4 hover:decoration-channel">
        {label}
      </Link>
    </p>
  );
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null, fallback = "/dashboard") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
