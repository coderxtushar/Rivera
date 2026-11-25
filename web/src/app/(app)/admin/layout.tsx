"use client";

import type { ReactNode } from "react";
import { BookOpen, FolderTree, Gauge, Receipt, Users } from "lucide-react";
import { AppShell, RequireAuth, type ShellLink } from "@/components/layout/app-shell";

const links: ShellLink[] = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={["admin"]}>
      <AppShell title="Admin" links={links}>
        {children}
      </AppShell>
    </RequireAuth>
  );
}
