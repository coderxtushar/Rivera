import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StudioShell } from "./_components/studio-shell";

export const metadata: Metadata = { title: { absolute: "Instructor studio | Rivera", template: "%s | Rivera" } };

export default function Layout({ children }: { children: ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
