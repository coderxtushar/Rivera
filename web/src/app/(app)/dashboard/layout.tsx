import { LearnerShell } from "./_components/learner-shell";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <LearnerShell>{children}</LearnerShell>;
}
