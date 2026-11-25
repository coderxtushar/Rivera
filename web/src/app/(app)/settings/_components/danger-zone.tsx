"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { SettingsPanel } from "./panel";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError(undefined);
    setBlocked(undefined);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter your password to confirm");
      return;
    }
    setDeleting(true);
    setError(undefined);
    try {
      await api("/users/me", { method: "DELETE", body: { password } });
      // The server already cleared the session cookies. A full reload drops every cached
      // query and lands on the home page without the sign-in gate redirecting first.
      window.location.replace("/");
    } catch (err) {
      setDeleting(false);
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") setError("That password isn't right");
      else if (err instanceof ApiError && err.code === "HAS_ENROLLED_STUDENTS") setBlocked(err.message);
      else toast.error(errorMessage(err));
    }
  };

  return (
    <SettingsPanel id="danger" title="Delete account" tone="danger" description="This can't be undone.">
      <p className="text-sm text-ink-2">
        Deleting your account removes your progress, certificates and reviews, and you lose access to every course you bought. Your receipts are kept for
        accounting.
      </p>
      <div className="mt-5">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>

      <Dialog open={open} onClose={close} title="Delete your account?" description="Enter your password to confirm. This can't be undone.">
        {blocked ? (
          <div className="space-y-5">
            <div role="alert" className="flex gap-3 rounded-card bg-buoy-wash p-4 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#b23417]" aria-hidden />
              <p>{blocked}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={close}>
                Keep my account
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <Field label="Password" error={error}>
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(undefined);
                  }}
                />
              )}
            </Field>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={deleting}>
                Delete account
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </SettingsPanel>
  );
}
