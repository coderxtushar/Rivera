"use client";

import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Thumb } from "@/components/course/course-card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { cn } from "@/lib/format";
import type { Course, Level } from "@/lib/types";
import { ChipInput } from "../chip-input";
import { LEVEL_OPTIONS, useCategories } from "../lib";
import { ListInput } from "../list-input";
import { MediaInput } from "../media-input";
import { Panel } from "../ui";

export interface DetailsDraft {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: Level;
  language: string;
  tags: string[];
  requirements: string[];
  outcomes: string[];
  thumbnailUrl: string;
  promoVideoUrl: string;
}

export function toDraft(c: Course): DetailsDraft {
  return {
    title: c.title,
    subtitle: c.subtitle ?? "",
    description: c.description ?? "",
    category: !c.category ? "" : typeof c.category === "string" ? c.category : c.category._id,
    level: c.level,
    language: c.language ?? "English",
    tags: [...(c.tags ?? [])],
    requirements: [...(c.requirements ?? [])],
    outcomes: [...(c.outcomes ?? [])],
    thumbnailUrl: c.thumbnailUrl ?? "",
    promoVideoUrl: c.promoVideoUrl ?? "",
  };
}

/** What would be sent: trimmed strings, empty list rows dropped, "" category → null. */
function normalise(d: DetailsDraft) {
  const lines = (l: string[]) => l.map((s) => s.trim()).filter(Boolean);
  return {
    title: d.title.trim(),
    subtitle: d.subtitle.trim(),
    description: d.description.trim(),
    category: d.category || null,
    level: d.level,
    language: d.language.trim(),
    tags: d.tags,
    requirements: lines(d.requirements),
    outcomes: lines(d.outcomes),
    thumbnailUrl: d.thumbnailUrl.trim(),
    promoVideoUrl: d.promoVideoUrl.trim(),
  };
}

/** Only the fields that changed, ready for PATCH. Empty object means the form is clean. */
export function detailsChanges(draft: DetailsDraft, course: Course) {
  const now = normalise(draft);
  const before = normalise(toDraft(course));
  const out: Partial<ReturnType<typeof normalise>> = {};
  for (const key of Object.keys(now) as (keyof typeof now)[]) {
    if (JSON.stringify(now[key]) !== JSON.stringify(before[key])) Object.assign(out, { [key]: now[key] });
  }
  return out;
}

/** Previewable image: an https:// link or a file served by this site ("/covers/…"). */
const isHttps = (v: string) => {
  if (/^\/(?!\/)/.test(v)) return true;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

export function DetailsTab({ course, draft, setDraft }: { course: Course; draft: DetailsDraft; setDraft: (d: DetailsDraft) => void }) {
  const qc = useQueryClient();
  const categories = useCategories();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [descMode, setDescMode] = useState<"write" | "preview">("write");
  const changes = detailsChanges(draft, course);
  const dirty = Object.keys(changes).length > 0;

  const set = <K extends keyof DetailsDraft>(key: K, value: DetailsDraft[K]) => {
    setDraft({ ...draft, [key]: value });
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const save = useMutation({
    mutationFn: () => api<{ data: { course: Course } }>(`/courses/${course._id}`, { method: "PATCH", body: changes }),
    onSuccess: (res) => {
      setErrors({});
      setDraft(toDraft(res.data.course));
      qc.setQueryData<{ data: { course: Course } }>(["studio", "course", course._id], (old) =>
        old ? { ...old, data: { ...old.data, course: { ...old.data.course, ...res.data.course, instructor: old.data.course.instructor } } } : old,
      );
      qc.invalidateQueries({ queryKey: ["studio", "courses"] });
      toast.success("Changes saved");
    },
    onError: (err) => {
      const fe: Record<string, string> = {};
      for (const [path, msg] of Object.entries(fieldErrors(err))) fe[path.split(".")[0]] ??= msg;
      setErrors(fe);
      toast.error(Object.keys(fe).length ? "Some fields need a fix before saving" : errorMessage(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.title.trim().length < 5) {
      setErrors((x) => ({ ...x, title: "Use at least 5 characters for the title." }));
      return;
    }
    if (dirty) save.mutate();
  };

  const descLength = draft.description.trim().length;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Panel title="Basics" description="How the course appears in the catalog and search.">
        <div className="space-y-5">
          <Field
            label="Title"
            error={errors.title}
            hint={course.publishedAt ? "The course link stays the same when you rename it." : "The course link follows the title until you first publish."}
          >
            {(p) => <Input {...p} value={draft.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />}
          </Field>
          <Field label="Subtitle" error={errors.subtitle} hint="One line that sells the outcome.">
            {(p) => <Input {...p} value={draft.subtitle} maxLength={200} onChange={(e) => set("subtitle", e.target.value)} />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Category" error={errors.category}>
              {(p) => (
                <Select {...p} value={draft.category} onChange={(e) => set("category", e.target.value)} disabled={categories.isPending}>
                  <option value="">No category</option>
                  {categories.data?.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Level" error={errors.level}>
              {(p) => (
                <Select {...p} value={draft.level} onChange={(e) => set("level", e.target.value as Level)}>
                  {LEVEL_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Language" error={errors.language}>
              {(p) => <Input {...p} value={draft.language} maxLength={40} onChange={(e) => set("language", e.target.value)} />}
            </Field>
          </div>
          <ChipInput label="Tags" value={draft.tags} onChange={(v) => set("tags", v)} error={errors.tags} />
        </div>
      </Panel>

      <Panel
        title="Description"
        description="Markdown works here: headings, lists, links and code."
        action={
          <Tabs
            items={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
            value={descMode}
            onChange={setDescMode}
          />
        }
      >
        {descMode === "write" ? (
          <Field
            label={<span className="sr-only">Description</span>}
            error={errors.description}
            hint={descLength < 50 ? `Publishing needs at least 50 characters. ${descLength} so far.` : `${descLength.toLocaleString("en-IN")} characters`}
          >
            {(p) => <Textarea {...p} value={draft.description} rows={12} maxLength={20000} onChange={(e) => set("description", e.target.value)} className="font-[inherit]" />}
          </Field>
        ) : (
          <div className="min-h-[18rem] rounded-control bg-white px-5 py-4 ring-1 ring-inset ring-line">
            {draft.description.trim() ? (
              <div className="prose-rivera text-ink-2">
                <ReactMarkdown>{draft.description}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-ink-3">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Before and after" description="Short lines work best. Students see these on the course page.">
        <div className="grid gap-8 lg:grid-cols-2">
          <ListInput
            label="Requirements"
            value={draft.requirements}
            onChange={(v) => set("requirements", v)}
            error={errors.requirements}
            addLabel="Add requirement"
            placeholder="e.g. Comfortable with a spreadsheet"
          />
          <ListInput
            label="What students will learn"
            value={draft.outcomes}
            onChange={(v) => set("outcomes", v)}
            error={errors.outcomes}
            addLabel="Add outcome"
            placeholder="e.g. Write joins and window functions"
          />
        </div>
      </Panel>

      <Panel title="Media" description="A 16:9 image at least 1280 by 720 looks sharp everywhere.">
        <div className="space-y-6">
          <MediaInput
            label="Thumbnail"
            kind="thumbnail"
            value={draft.thumbnailUrl}
            onChange={(v) => set("thumbnailUrl", v)}
            error={errors.thumbnailUrl}
            preview={
              <div className="max-w-xs">
                <Thumb course={{ _id: course._id, title: draft.title, thumbnailUrl: isHttps(draft.thumbnailUrl) ? draft.thumbnailUrl : "" }} sizes="320px" />
                {!draft.thumbnailUrl && <p className="mt-2 text-xs text-ink-3">Without a thumbnail, the course gets a generated cover like this one.</p>}
              </div>
            }
          />
          <MediaInput label="Promo video" kind="video" value={draft.promoVideoUrl} onChange={(v) => set("promoVideoUrl", v)} error={errors.promoVideoUrl} hint="A short trailer shown on the course page. YouTube, Vimeo or a direct video link." />
        </div>
      </Panel>

      <div className="sticky bottom-4 z-10">
        <div className={cn("flex flex-wrap items-center justify-end gap-3 rounded-panel border border-line bg-foam/95 px-5 py-3 backdrop-blur transition-shadow", dirty && "shadow-float")}>
          <AnimatePresence initial={false}>
            {dirty && (
              <motion.p key="dirty" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mr-auto text-sm font-medium text-ink-2" role="status">
                You have unsaved changes
              </motion.p>
            )}
          </AnimatePresence>
          <Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => (setDraft(toDraft(course)), setErrors({}))}>
            Discard changes
          </Button>
          <Button type="submit" disabled={!dirty} loading={save.isPending}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
