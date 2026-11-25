"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Archive, Check, Circle, ExternalLink, Rocket, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, fieldErrors } from "@/lib/api";
import { cn, date, money } from "@/lib/format";
import type { Course, CurriculumSection } from "@/lib/types";
import { CURRENCIES, toMajor, toMinor } from "../lib";
import { ConfirmDialog, Panel, StatusBadge } from "../ui";

type CourseResponse = { data: { course: Course } };

export function PublishTab({
  course,
  sections,
  unsavedDetails,
  onGoTo,
}: {
  course: Course;
  sections: CurriculumSection[] | undefined;
  unsavedDetails: boolean;
  onGoTo: (tab: "details" | "curriculum") => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const courseKey = ["studio", "course", course._id];
  const [serverProblems, setServerProblems] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const apply = (res: CourseResponse) => {
    qc.setQueryData<CourseResponse>(courseKey, (old) => (old ? { ...old, data: { ...old.data, course: { ...old.data.course, ...res.data.course, instructor: old.data.course.instructor, category: old.data.course.category } } } : old));
    qc.invalidateQueries({ queryKey: ["studio", "courses"] });
    qc.invalidateQueries({ queryKey: ["studio", "stats"] });
  };

  const publish = useMutation({
    mutationFn: () => api<CourseResponse>(`/courses/${course._id}/publish`, { method: "POST" }),
    onSuccess: (res) => {
      apply(res);
      setServerProblems(null);
      toast.success(course.status === "archived" ? "Course published again" : "Course published");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "NOT_PUBLISHABLE" && Array.isArray(err.details)) {
        setServerProblems(err.details.map((d) => (typeof d === "string" ? d : d.message)));
        toast.error("A few things are missing before this can go live");
      } else toast.error(errorMessage(err));
    },
  });

  const archive = useMutation({
    mutationFn: () => api<CourseResponse>(`/courses/${course._id}/archive`, { method: "POST" }),
    onSuccess: (res) => {
      apply(res);
      setConfirm(null);
      toast.success("Course archived");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api(`/courses/${course._id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: courseKey });
      qc.invalidateQueries({ queryKey: ["studio", "courses"] });
      qc.invalidateQueries({ queryKey: ["studio", "stats"] });
      toast.success("Course deleted");
      router.replace("/studio/courses");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "COURSE_HAS_STUDENTS") setDeleteBlocked(true);
      else toast.error(errorMessage(err));
    },
  });

  // Readiness as the API checks it, computed locally so it updates as you work.
  const lessonCount = sections ? sections.reduce((n, s) => n + s.lessons.length, 0) : course.stats.lessonCount;
  const sectionCount = sections ? sections.length : course.sections.length;
  const checklist = [
    { done: course.description.trim().length >= 50, label: "A description of at least 50 characters", tab: "details" as const },
    { done: sectionCount > 0, label: "At least one section", tab: "curriculum" as const },
    { done: lessonCount > 0, label: "At least one lesson", tab: "curriculum" as const },
  ];

  const isLive = course.status === "published";

  return (
    <div className="space-y-6">
      <PricingForm key={`${course.price}-${course.currency}`} course={course} onSaved={apply} />

      <Panel title="Status" action={<StatusBadge status={course.status} className="text-sm" />}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={course.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <p className="text-ink-2">
              {course.status === "draft" && "Only you can see this course. Publish it to list it in the catalog and start taking enrollments."}
              {course.status === "published" && (
                <>
                  Live in the catalog{course.publishedAt ? ` since ${date(course.publishedAt)}` : ""}. Students can find and buy it.
                </>
              )}
              {course.status === "archived" && "Hidden from the catalog. Students who enrolled keep access, and nobody new can join. Publish it again to relist it."}
            </p>
          </motion.div>
        </AnimatePresence>

        {!isLive && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-ink-2">{serverProblems ? "Still needed before publishing" : "Before you publish"}</h3>
            <ul className="mt-3 space-y-2">
              {serverProblems
                ? serverProblems.map((p) => {
                    const tab = /description/i.test(p) ? "details" : "curriculum";
                    return (
                      <li key={p} className="flex items-center gap-2.5 text-sm text-ink">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-buoy-wash text-[#b23417]" aria-hidden>
                          <Circle className="size-2.5" fill="currentColor" />
                        </span>
                        {p}
                        <button type="button" onClick={() => onGoTo(tab)} className="ml-auto shrink-0 text-sm font-semibold text-channel hover:underline">
                          {tab === "details" ? "Edit description" : "Open curriculum"}
                        </button>
                      </li>
                    );
                  })
                : checklist.map((c) => (
                    <li key={c.label} className="flex items-center gap-2.5 text-sm">
                      <motion.span
                        initial={false}
                        animate={{ scale: c.done ? [0.7, 1] : 1 }}
                        className={cn("grid size-5 shrink-0 place-items-center rounded-full", c.done ? "bg-reef text-white" : "border border-line-strong text-transparent")}
                        aria-hidden
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </motion.span>
                      <span className={c.done ? "text-ink-3" : "text-ink"}>
                        {c.label}
                        <span className="sr-only">{c.done ? ", done" : ", not done yet"}</span>
                      </span>
                      {!c.done && (
                        <button type="button" onClick={() => onGoTo(c.tab)} className="ml-auto text-sm font-semibold text-channel hover:underline">
                          {c.tab === "details" ? "Edit description" : "Open curriculum"}
                        </button>
                      )}
                    </li>
                  ))}
            </ul>
          </div>
        )}

        {unsavedDetails && (
          <p className="mt-5 rounded-control bg-buoy-wash px-4 py-3 text-sm text-[#b23417]">
            You have unsaved changes on the Details tab. Publishing uses the last saved version.{" "}
            <button type="button" onClick={() => onGoTo("details")} className="font-semibold underline underline-offset-2">
              Review details
            </button>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {!isLive && (
            <Button icon={<Rocket className="size-4" />} loading={publish.isPending} onClick={() => publish.mutate()}>
              {course.status === "archived" ? "Publish again" : "Publish course"}
            </Button>
          )}
          {isLive && (
            <Button variant="secondary" icon={<Archive className="size-4" />} onClick={() => setConfirm("archive")}>
              Archive course
            </Button>
          )}
          <ButtonLink href={`/courses/${course.slug}`} variant="ghost" icon={<ExternalLink className="size-4" />} target="_blank" rel="noopener">
            {isLive ? "View course page" : "Preview course page"}
          </ButtonLink>
        </div>
      </Panel>

      <Panel title="Delete course" description="Removes the course, its lessons, reviews and coupons for good. Only possible while nobody is enrolled.">
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => (setDeleteBlocked(false), setConfirm("delete"))}>
          Delete course
        </Button>
      </Panel>

      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        title="Archive this course?"
        confirmLabel="Archive course"
        tone="primary"
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
        body={<p>It disappears from the catalog and stops taking new students. Everyone already enrolled keeps full access. You can publish it again at any time.</p>}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title={deleteBlocked ? "This course has students" : "Delete this course?"}
        confirmLabel={deleteBlocked ? (course.status === "archived" ? "Keep it archived" : "Archive instead") : "Delete course"}
        tone={deleteBlocked ? "primary" : "danger"}
        loading={deleteBlocked ? archive.isPending : remove.isPending}
        onConfirm={() => (deleteBlocked ? (course.status === "archived" ? setConfirm(null) : archive.mutate()) : remove.mutate())}
        body={
          deleteBlocked ? (
            <p>
              Students are enrolled in <strong className="text-ink">{course.title}</strong>, so it can&apos;t be deleted: they paid for access.{" "}
              {course.status === "archived" ? "It's already archived, so it's hidden from the catalog while they keep learning." : "Archive it to hide it from the catalog while they keep learning."}
            </p>
          ) : (
            <p>
              <strong className="text-ink">{course.title}</strong> and all of its lessons, reviews and coupons will be removed for good. This can&apos;t be undone.
            </p>
          )
        }
      />
    </div>
  );
}

function PricingForm({ course, onSaved }: { course: Course; onSaved: (res: CourseResponse) => void }) {
  const [price, setPrice] = useState(toMajor(course.price));
  const [currency, setCurrency] = useState(course.currency || "INR");
  const [error, setError] = useState<string>();
  const minor = toMinor(price);
  const dirty = minor !== course.price || currency !== course.currency;

  const save = useMutation({
    mutationFn: () => api<CourseResponse>(`/courses/${course._id}`, { method: "PATCH", body: { price: minor, currency } }),
    onSuccess: (res) => {
      onSaved(res);
      toast.success("Price saved");
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      setError(fe.price ?? fe.currency);
      if (!fe.price && !fe.currency) toast.error(errorMessage(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (minor === null) return setError("Enter an amount like 499 or 499.50.");
    setError(undefined);
    if (dirty) save.mutate();
  };

  const options = CURRENCIES.some((c) => c.value === course.currency) ? CURRENCIES : [...CURRENCIES, { value: course.currency, label: course.currency }];

  return (
    <Panel title="Pricing" description="Students pay this amount. Enter 0 to make the course free.">
      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,16rem)_auto] sm:items-start">
        <Field label="Price" error={error} hint={minor !== null && minor > 0 ? `Shows as ${money(minor, currency)}` : minor === 0 ? "Shows as Free" : undefined}>
          {(p) => <Input {...p} value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} />}
        </Field>
        <Field label="Currency">
          {(p) => (
            <Select {...p} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {options.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" disabled={!dirty} loading={save.isPending} className="sm:mt-[1.6875rem]">
          Save price
        </Button>
      </form>
    </Panel>
  );
}
