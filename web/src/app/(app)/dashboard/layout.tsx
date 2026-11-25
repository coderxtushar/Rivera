import type { Metadata } from "next";
import { LearnerShell } from "./_components/learner-shell";

export const metadata: Metadata = { title: { absolute: "My learning | Rivera", template: "%s | Rivera" } };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <LearnerShell>{children}</LearnerShell>;
}
