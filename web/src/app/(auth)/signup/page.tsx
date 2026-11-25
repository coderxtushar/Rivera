"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage, fieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { AuthHeading, AuthSwitch, safeNext } from "../form-kit";

/** Three-band strength meter, styled as depth: longer + more varied = deeper. */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d|[^A-Za-z]/.test(pw)) s += 1;
  return s;
}

function SignUpForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/courses");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const level = strength(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await signUp(form);
      toast.success("Account created. We've emailed you a link to verify your address.");
      router.replace(next);
    } catch (err) {
      const fe = fieldErrors(err);
      if (err instanceof ApiError && err.code === "EMAIL_TAKEN") fe.email = "An account already uses this email. Sign in instead.";
      setErrors(Object.keys(fe).length ? fe : { form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthHeading title="Create your account" sub="Free to join. You only pay for the courses you choose." />
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName}>
            {(p) => <Input {...p} autoComplete="given-name" required value={form.firstName} onChange={set("firstName")} />}
          </Field>
          <Field label="Last name" error={errors.lastName}>
            {(p) => <Input {...p} autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />}
          </Field>
        </div>
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" required value={form.email} onChange={set("email")} />}
        </Field>
        <Field label="Password" hint="At least 8 characters. Longer is stronger." error={errors.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />}
        </Field>
        {form.password && (
          <div className="-mt-2 flex items-center gap-2" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className={cn("h-1 flex-1 rounded-full", i < level ? (level === 3 ? "bg-deep" : "bg-reef") : "bg-ink/10")} layout />
            ))}
            <span className="w-16 text-right text-xs font-semibold text-ink-3">{["Too short", "Okay", "Good", "Strong"][level]}</span>
          </div>
        )}
        {errors.form && (
          <p role="alert" className="text-sm font-medium text-[#c23a1e]">
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy} disabled={!form.firstName || !form.email || form.password.length < 8}>
          Create account
        </Button>
      </form>
      <AuthSwitch text="Already have an account?" href={`/signin${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} label="Sign in" />
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
