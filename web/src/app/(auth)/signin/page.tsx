"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuthHeading, AuthSwitch, safeNext } from "../form-kit";

function SignInForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const user = await signIn(email, password);
      toast.success(`Welcome back, ${user.firstName}`);
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "INVALID_CREDENTIALS"
          ? "That email and password don't match. Check both, or reset your password."
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthHeading title="Sign in" sub="Continue your courses and manage your account." />
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password" error={error}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Link href="/forgot-password" className="-mt-2 self-end text-sm font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
          Forgot your password?
        </Link>
        <Button type="submit" size="lg" loading={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
      <AuthSwitch text="New to Rivera?" href={`/signup${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} label="Create an account" />
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
