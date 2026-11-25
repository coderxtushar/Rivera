"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { StarInput } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, fieldErrors } from "@/lib/api";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewDialog({
  open,
  onClose,
  courseId,
  slug,
  courseTitle,
  onReviewed,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  slug: string;
  courseTitle: string;
  onReviewed: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [already, setAlready] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setError("Choose a star rating");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await api(`/courses/${courseId}/reviews`, { method: "POST", body: { rating, comment: comment.trim() } });
      toast.success("Review posted. Thank you!");
      onReviewed();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_REVIEWED") {
        setAlready(true);
        onReviewed();
      } else {
        const fe = fieldErrors(err);
        if (fe.comment || fe.rating) setError(fe.comment || fe.rating);
        else toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Leave a review" description={`How was ${courseTitle}? Your review helps other learners choose.`}>
      {already ? (
        <div className="space-y-5">
          <p role="status" className="text-ink-2">
            You&apos;ve already reviewed this course. You can change your review from the{" "}
            <Link href={`/courses/${slug}`} className="font-semibold text-channel underline underline-offset-4">
              course page
            </Link>
            .
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-2">Your rating</legend>
            <div className="flex flex-wrap items-center gap-3">
              <StarInput
                value={rating}
                onChange={(v) => {
                  setRating(v);
                  setError(undefined);
                }}
              />
              <span className="text-sm font-semibold text-ink-2" aria-live="polite">
                {LABELS[rating]}
              </span>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-[#c23a1e]">
                {error}
              </p>
            )}
          </fieldset>
          <Field label="Your review" hint="Optional. What did you learn, and who would you recommend it to?">
            {(p) => <Textarea {...p} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={3000} rows={5} />}
          </Field>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Post review
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
