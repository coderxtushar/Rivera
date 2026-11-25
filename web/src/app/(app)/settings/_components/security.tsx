"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, MailCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Badge, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, fieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, relativeTime } from "@/lib/format";
import type { User } from "@/lib/types";
import { SettingsPanel } from "./panel";

/* ------------------------------------------------------------ email */

export function EmailStatus({ user }: { user: User }) {
  const { refresh } = useAuth();
  const resend = useMutation({
    mutationFn: () => api("/auth/resend-verification", { method: "POST" }),
    onSuccess: () => toast.success(`Verification email sent to ${user.email}`),
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ALREADY_VERIFIED") {
        refresh();
        toast.info("Your email is already verified");
      } else toast.error(errorMessage(err));
    },
  });

  return (
    <SettingsPanel id="email" title="Email" description="Where we send receipts, certificates and password resets.">
      <div className="flex flex-wrap items-center gap-3">
        <span className="break-all font-semibold text-ink">{user.email}</span>
        {user.isEmailVerified ? <Badge tone="reef">Verified</Badge> : <Badge tone="buoy">Not verified</Badge>}
      </div>
      {!user.isEmailVerified && (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-ink-3">Verify your email to enroll in free courses and publish your own. The link in the email expires after a while, so send a new one if you need it.</p>
          <Button variant="secondary" size="sm" loading={resend.isPending} disabled={resend.isSuccess} icon={<MailCheck className="size-4" />} onClick={() => resend.mutate()}>
            {resend.isSuccess ? "Email sent" : "Resend verification email"}
          </Button>
        </div>
      )}
    </SettingsPanel>
  );
}

/* --------------------------------------------------------- password */

export function ChangePassword() {
  const qc = useQueryClient();
  const empty = { currentPassword: "", newPassword: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.currentPassword) local.currentPassword = "Enter your current password";
    if (form.newPassword.length < 8) local.newPassword = "Use at least 8 characters";
    if (form.confirm !== form.newPassword) local.confirm = "The two new passwords don't match";
    setErrors(local);
    if (Object.keys(local).length) return;

    setSaving(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["settings", "sessions"] });
      toast.success("Password changed. Other devices have been signed out.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") setErrors({ currentPassword: "That isn't your current password" });
      else {
        const fe = fieldErrors(err);
        setErrors(fe);
        if (!Object.keys(fe).length) toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel id="password" title="Password" description="Changing it signs you out everywhere else, but keeps you signed in here.">
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Field label="Current password" error={errors.currentPassword}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" hint="At least 8 characters" error={errors.newPassword}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} />}
          </Field>
          <Field label="Repeat new password" error={errors.confirm}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />}
          </Field>
        </div>
        <div>
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </SettingsPanel>
  );
}

/* --------------------------------------------------------- sessions */

interface Session {
  _id: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  expiresAt: string;
}

/** A readable "Chrome on macOS" from a user-agent string. */
function describe(ua = "") {
  const browser =
    /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const mobile = /Mobile|iPhone|Android/.test(ua);
  const label = browser && os ? `${browser} on ${os}` : browser || os || (ua ? ua.slice(0, 60) : "Unknown device");
  return { label, mobile };
}

export function Sessions() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const sessions = useQuery({ queryKey: ["settings", "sessions"], queryFn: () => api<{ data: Session[] }>("/users/me/sessions") });

  const signOutAll = useMutation({
    mutationFn: () => api("/auth/signout-all", { method: "POST" }),
    onSuccess: async () => {
      await signOut();
      toast.success("Signed out of all devices");
      router.replace("/signin");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = sessions.data?.data ?? [];

  return (
    <SettingsPanel id="sessions" title="Where you're signed in" description="Each browser or app you've signed in from in the last 30 days.">
      {sessions.isPending ? (
        <div className="space-y-2" aria-busy aria-label="Loading sessions">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : sessions.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-ink-2">{errorMessage(sessions.error)}</p>
          <Button variant="quiet" onClick={() => sessions.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-3">We couldn&apos;t find any active sign-ins.</p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-white/60">
          {items.map((s) => {
            const d = describe(s.userAgent);
            const Icon = d.mobile ? Smartphone : Laptop;
            return (
              <li key={s._id} className="flex items-start gap-3 px-4 py-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink" title={s.userAgent}>
                    {d.label}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-ink-3">
                    <span>
                      Signed in <time dateTime={s.createdAt} title={date(s.createdAt)}>{relativeTime(s.createdAt)}</time>
                    </span>
                    {s.ip && <span className="tabular-nums">IP {s.ip}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5">
        <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={() => setConfirming(true)}>
          Sign out of all devices
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Sign out of all devices?"
        description="Every browser and app, including this one, will need to sign in again."
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={signOutAll.isPending} onClick={() => signOutAll.mutate()}>
            Sign out of all devices
          </Button>
        </div>
      </Dialog>
    </SettingsPanel>
  );
}
