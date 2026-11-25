import { LearnerShell } from "../dashboard/_components/learner-shell";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <LearnerShell>{children}</LearnerShell>;
}
