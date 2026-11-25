"use client";

import { PageFade } from "@/components/layout/app-shell";
import { PageTitle } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { DangerZone } from "./_components/danger-zone";
import { ProfileForm } from "./_components/profile-form";
import { ChangePassword, EmailStatus, Sessions } from "./_components/security";

export default function SettingsPage() {
  const { user } = useAuth();
  // RequireAuth in the layout guarantees a user before this renders.
  if (!user) return null;

  return (
    <PageFade>
      <PageTitle title="Settings" sub="Your profile, sign-in and account." />
      <div className="space-y-6">
        <ProfileForm key={user._id} user={user} />
        <EmailStatus user={user} />
        <ChangePassword />
        <Sessions />
        <DangerZone />
      </div>
    </PageFade>
  );
}
