import type { ReactNode } from "react";

/** Business details shown on policy pages (set in Vercel; required by Razorpay for activation). */
export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "Rivera",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "",
  updated: "25 November 2026",
};

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="display text-4xl sm:text-5xl" style={{ ["--wdth" as string]: 100 }}>
        {title}
      </h1>
      <p className="mt-3 text-sm text-ink-3">Last updated {BUSINESS.updated}</p>
      <p className="mt-8 text-lg leading-relaxed text-ink-2">{intro}</p>
      <div className="prose-rivera mt-10 text-ink-2">{children}</div>
    </article>
  );
}

export function SupportLine() {
  return BUSINESS.email ? (
    <>
      email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
    </>
  ) : (
    <>use the contact details on our <a href="/contact">contact page</a></>
  );
}
