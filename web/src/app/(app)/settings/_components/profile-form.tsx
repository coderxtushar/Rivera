"use client";

import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Avatar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { SettingsPanel } from "./panel";

type ProfileFields = Pick<User, "firstName" | "lastName" | "headline" | "bio" | "website" | "avatarUrl">;

const pick = (u: User): ProfileFields => ({
  firstName: u.firstName ?? "",
  lastName: u.lastName ?? "",
  headline: u.headline ?? "",
  bio: u.bio ?? "",
  website: u.website ?? "",
  avatarUrl: u.avatarUrl ?? "",
});

interface ApiInfo {
  features?: { uploads?: boolean };
}

export function ProfileForm({ user }: { user: User }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState<ProfileFields>(() => pick(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const info = useQuery({ queryKey: ["public", "api-info"], queryFn: () => api<ApiInfo>(""), staleTime: Infinity });
  const canUpload = Boolean(info.data?.features?.uploads);

  const set = (key: keyof ProfileFields) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const dirty = (Object.keys(form) as (keyof ProfileFields)[]).some((k) => form[k].trim() !== (pick(user)[k] ?? "").trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      setErrors({ firstName: "Enter your first name" });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await api("/users/me", { method: "PATCH", body: form });
      await refresh();
      toast.success("Changes saved");
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const sig = await api<{ data: { uploadUrl: string; fields: Record<string, string | number> } }>("/uploads/signature", {
        method: "POST",
        body: { kind: "avatar" },
      });
      const body = new FormData();
      for (const [k, v] of Object.entries(sig.data.fields)) body.append(k, String(v));
      body.append("file", file);
      const res = await fetch(sig.data.uploadUrl, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.secure_url) throw new Error(json?.error?.message || "The photo didn't upload. Try a JPG, PNG or WebP image.");
      setForm((f) => ({ ...f, avatarUrl: json.secure_url }));
      toast.info("Photo uploaded. Save changes to use it.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <SettingsPanel id="profile" title="Profile" description="Your name appears on certificates and reviews. Instructors also show their headline and bio on course pages.">
      <form onSubmit={submit} noValidate className="grid gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={{ ...form, avatarUrl: /^https:\/\//.test(form.avatarUrl) ? form.avatarUrl : "" }} size={64} />
          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <Button variant="secondary" size="sm" loading={uploading} icon={<ImageUp className="size-4" />} onClick={() => fileRef.current?.click()}>
                Upload photo
              </Button>
            </>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName}>
            {(p) => <Input {...p} value={form.firstName} onChange={set("firstName")} autoComplete="given-name" maxLength={60} required />}
          </Field>
          <Field label="Last name" error={errors.lastName}>
            {(p) => <Input {...p} value={form.lastName} onChange={set("lastName")} autoComplete="family-name" maxLength={60} />}
          </Field>
        </div>
        <Field label="Headline" hint="One line about you, like “Product designer at a fintech startup”." error={errors.headline}>
          {(p) => <Input {...p} value={form.headline} onChange={set("headline")} maxLength={120} />}
        </Field>
        <Field label="Bio" error={errors.bio}>
          {(p) => <Textarea {...p} value={form.bio} onChange={set("bio")} maxLength={2000} rows={4} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website" hint="Starts with https://" error={errors.website}>
            {(p) => <Input {...p} type="url" inputMode="url" value={form.website} onChange={set("website")} placeholder="https://" autoComplete="url" />}
          </Field>
          <Field label="Photo URL" hint={canUpload ? "Or upload a photo above." : "A link to a square image."} error={errors.avatarUrl}>
            {(p) => <Input {...p} type="url" inputMode="url" value={form.avatarUrl} onChange={set("avatarUrl")} placeholder="https://" />}
          </Field>
        </div>
        <div>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </SettingsPanel>
  );
}
