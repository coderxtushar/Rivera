import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: { absolute: "Your courses | Rivera", template: "%s | Rivera" } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
