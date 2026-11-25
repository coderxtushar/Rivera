import { Suspense } from "react";
import { SiteHeader, SiteHeaderFallback } from "@/components/layout/site-header";
import { Spinner } from "@/components/ui/misc";

/**
 * Signed-in areas render behind a client-side auth gate, so there's nothing for
 * Next to prerender or validate for instant navigation. Opt the whole group out.
 */
export const instant = false;

/** Signed-in areas: learner dashboard, settings, instructor studio, admin. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <Suspense
        fallback={
          <div className="grid min-h-[50vh] place-items-center text-ink-3">
            <Spinner className="size-6" />
          </div>
        }
      >
        {children}
      </Suspense>
    </>
  );
}
