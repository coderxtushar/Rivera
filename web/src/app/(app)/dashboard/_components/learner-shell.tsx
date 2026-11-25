"use client";

import type { ReactNode } from "react";
import { Award, BookOpen, Heart, Receipt, Settings } from "lucide-react";
import { AppShell, RequireAuth, type ShellLink } from "@/components/layout/app-shell";

const LINKS: ShellLink[] = [
  { href: "/dashboard", label: "My learning", icon: BookOpen, exact: true },
  { href: "/dashboard/wishlist", label: "Wishlist", icon: Heart },
  { href: "/dashboard/purchases", label: "Purchases", icon: Receipt },
  { href: "/dashboard/certificates", label: "Certificates", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Signed-in learner area: dashboard pages and settings share one side nav. */
export function LearnerShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell title="My learning" links={LINKS}>
        {children}
      </AppShell>
    </RequireAuth>
  );
}
