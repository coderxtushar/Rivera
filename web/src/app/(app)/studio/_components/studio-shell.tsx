"use client";

import { Suspense, type ReactNode } from "react";
import { BookOpenText, LayoutDashboard, Receipt, TicketPercent } from "lucide-react";
import { AppShell, RequireAuth, type ShellLink } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/misc";

const LINKS: ShellLink[] = [
  { href: "/studio", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/studio/courses", label: "Courses", icon: BookOpenText },
  { href: "/studio/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/studio/sales", label: "Sales", icon: Receipt },
];

/**
 * The shell reads the pathname, which suspends under dynamic segments like
 * /studio/courses/[id] while the static shell is prerendered, so it sits in Suspense.
 */
export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[50vh] place-items-center text-ink-3">
          <Spinner className="size-6" />
        </div>
      }
    >
      <RequireAuth roles={["instructor", "admin"]}>
        <AppShell title="Instructor studio" links={LINKS}>
          {children}
        </AppShell>
      </RequireAuth>
    </Suspense>
  );
}
