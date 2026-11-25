"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { AuthHeading, AuthSwitch } from "../form-kit";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email }, noRefresh: true });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <MailCheck className="size-10 text-reef" />
          <AuthHeading title="Check your inbox" sub={<>If an account exists for <strong className="text-ink">{email}</strong>, a reset link is on its way. It works for one hour.</>} />
          <Button variant="secondary" onClick={() => setSent(false)}>
            Use a different email
          </Button>
          <AuthSwitch text="Remembered it?" href="/signin" label="Sign in" />
        </motion.div>
      ) : (
        <motion.div key="form" exit={{ opacity: 0, y: -10 }}>
          <AuthHeading title="Reset your password" sub="Enter the email you signed up with and we'll send you a reset link." />
          <form onSubmit={submit} className="flex flex-col gap-5">
            <Field label="Email" error={error}>
              {(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Button type="submit" size="lg" loading={busy} disabled={!email}>
              Send reset link
            </Button>
          </form>
          <AuthSwitch text="Remembered it?" href="/signin" label="Sign in" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
