"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { AuthHeading } from "../form-kit";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mismatch = confirm.length > 0 && confirm !== password;

  if (!token) {
    return (
      <>
        <AuthHeading title="This link is incomplete" sub="Open the reset link from your email again, or ask for a new one." />
        <ButtonLink href="/forgot-password">Send a new link</ButtonLink>
      </>
    );
  }

  if (done) {
    return (
      <>
        <CheckCircle2 className="size-10 text-reef" />
        <AuthHeading title="Password updated" sub="You've been signed out everywhere. Sign in with your new password." />
        <ButtonLink href="/signin" size="lg">
          Sign in
        </ButtonLink>
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(undefined);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password }, noRefresh: true });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthHeading title="Choose a new password" sub="Use at least 8 characters." />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="New password">
          {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label="Confirm new password" error={mismatch ? "The passwords don't match" : error}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <Button type="submit" size="lg" loading={busy} disabled={password.length < 8 || mismatch || !confirm}>
          Update password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
