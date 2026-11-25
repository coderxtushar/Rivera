import { SiteFooter } from "@/components/layout/site-footer";
import { Suspense } from "react";
import { SiteHeader, SiteHeaderFallback } from "@/components/layout/site-header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
