import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "./_components/admin-shell";

export const metadata: Metadata = { title: { absolute: "Admin | Rivera", template: "%s | Rivera" } };

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
