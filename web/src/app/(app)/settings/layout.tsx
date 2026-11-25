import type { Metadata } from "next";
import { LearnerShell } from "../dashboard/_components/learner-shell";

export const metadata: Metadata = { title: { absolute: "Settings | Rivera", template: "%s | Rivera" } };

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <LearnerShell>{children}</LearnerShell>;
}
