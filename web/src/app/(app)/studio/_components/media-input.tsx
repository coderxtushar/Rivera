"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useFeatures } from "./lib";

export type UploadKind = "thumbnail" | "video" | "resource";

const ACCEPT: Record<UploadKind, string> = {
  thumbnail: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/webm,video/quicktime",
  resource: ".pdf,.zip,.txt,.md,.png,.jpg,.jpeg",
};

/** Signed direct upload to the media host: sign with the API, then POST the file there. */
export async function uploadFile(kind: UploadKind, file: File, onProgress: (pct: number) => void): Promise<string> {
  const sig = await api<{ data: { uploadUrl: string; fields: Record<string, string | number> } }>("/uploads/signature", {
    method: "POST",
    body: { kind },
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(sig.data.fields)) form.append(k, String(v));
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.data.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: { secure_url?: string; error?: { message?: string } } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) resolve(body.secure_url);
      else reject(new Error(body?.error?.message ? `Upload failed: ${body.error.message}` : "Upload failed. Check the file type and try again."));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(form);
  });
}

/**
 * A URL field. When the server has uploads configured it also offers
 * "Upload file", which fills the URL in for you.
 */
export function MediaInput({
  label,
  hint,
  error,
  kind,
  value,
  onChange,
  placeholder,
  preview,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  kind: UploadKind;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  preview?: ReactNode;
}) {
  const features = useFeatures();
  const canUpload = features.data?.uploads === true;
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    try {
      const url = await uploadFile(kind, file, setProgress);
      onChange(url);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <Field label={label} hint={hint ?? (canUpload ? "Paste a link, or upload a file and the link fills in." : undefined)} error={error}>
        {(p) => (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input {...p} type="text" inputMode="url" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "https://"} className="min-w-0 flex-1" />
            {canUpload && (
              <>
                <input ref={fileRef} type="file" accept={ACCEPT[kind]} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
                <Button variant="secondary" icon={<Upload className="size-4" />} loading={progress !== null} onClick={() => fileRef.current?.click()} className="shrink-0">
                  {progress !== null ? `Uploading ${progress}%` : "Upload file"}
                </Button>
              </>
            )}
          </div>
        )}
      </Field>
      <AnimatePresence initial={false}>
        {progress !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ProgressBar value={progress} tone="current" />
          </motion.div>
        )}
      </AnimatePresence>
      {preview}
    </div>
  );
}
