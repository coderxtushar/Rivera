"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import type { CurriculumSection, Lesson } from "@/lib/types";
import { formatClock, parseClock, useFeatures } from "../lib";
import { MediaInput, uploadFile } from "../media-input";

export type LessonSheetState = { mode: "create"; sectionId: string } | { mode: "edit"; lesson: Lesson } | null;

interface ResourceDraft {
  key: number;
  title: string;
  url: string;
}

interface LessonDraft {
  title: string;
  type: "video" | "article";
  videoUrl: string;
  duration: string;
  isPreview: boolean;
  content: string;
  resources: ResourceDraft[];
  sectionId: string;
}

let resourceKey = 0;
const nextKey = () => (resourceKey += 1);

function initialDraft(state: NonNullable<LessonSheetState>, full?: Lesson): LessonDraft {
  if (state.mode === "create") {
    return { title: "", type: "video", videoUrl: "", duration: "", isPreview: false, content: "", resources: [], sectionId: state.sectionId };
  }
  const l = full ?? state.lesson;
  return {
    title: l.title,
    type: l.type,
    videoUrl: l.videoUrl ?? "",
    duration: formatClock(l.durationSec),
    isPreview: l.isPreview,
    content: l.content ?? "",
    resources: (l.resources ?? []).map((r) => ({ key: nextKey(), title: r.title, url: r.url })),
    sectionId: l.section,
  };
}

/** Add or edit a lesson in a side sheet. */
export function LessonSheet({
  state,
  onClose,
  courseId,
  sections,
}: {
  state: LessonSheetState;
  onClose: () => void;
  courseId: string;
  sections: CurriculumSection[];
}) {
  const editing = state?.mode === "edit" ? state.lesson : null;
  // The curriculum leaves out article bodies, so fetch the full lesson to edit it.
  const full = useQuery({
    queryKey: ["studio", "lesson", courseId, editing?._id],
    queryFn: () => api<{ data: { lesson: Lesson } }>(`/courses/${courseId}/lessons/${editing!._id}`),
    enabled: Boolean(editing),
    select: (d) => d.data.lesson,
    staleTime: 0,
  });

  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      variant="sheet"
      title={state?.mode === "edit" ? "Edit lesson" : "Add lesson"}
      description={state?.mode === "edit" ? state.lesson.title : `In ${sections.find((s) => state?.mode === "create" && s._id === state.sectionId)?.title ?? "this section"}`}
    >
      {state &&
        (editing && full.isPending ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-11" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-11" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <LessonForm
            key={editing ? `${editing._id}-${full.dataUpdatedAt}` : `new-${state.mode === "create" ? state.sectionId : ""}`}
            state={state}
            initial={initialDraft(state, full.data)}
            loadError={editing && full.isError ? errorMessage(full.error) : null}
            courseId={courseId}
            sections={sections}
            onDone={onClose}
          />
        ))}
    </Dialog>
  );
}

function LessonForm({
  state,
  initial,
  loadError,
  courseId,
  sections,
  onDone,
}: {
  state: NonNullable<LessonSheetState>;
  initial: LessonDraft;
  loadError: string | null;
  courseId: string;
  sections: CurriculumSection[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<LessonDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof LessonDraft>(k: K, v: LessonDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      state.mode === "create"
        ? api<{ data: { lesson: Lesson } }>(`/courses/${courseId}/sections/${state.sectionId}/lessons`, { method: "POST", body })
        : api<{ data: { lesson: Lesson } }>(`/courses/${courseId}/lessons/${state.lesson._id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio", "curriculum", courseId] });
      qc.invalidateQueries({ queryKey: ["studio", "course", courseId] });
      if (state.mode === "edit") qc.removeQueries({ queryKey: ["studio", "lesson", courseId, state.lesson._id] });
      toast.success(state.mode === "create" ? "Lesson added" : "Lesson saved");
      onDone();
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      setErrors(fe);
      toast.error(Object.keys(fe).length ? "Some fields need a fix before saving" : errorMessage(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!d.title.trim()) next.title = "Give the lesson a title.";
    const durationSec = parseClock(d.duration);
    if (durationSec === null) next.durationSec = "Use minutes and seconds, like 12:30.";
    else if (durationSec > 24 * 3600) next.durationSec = "Keep lessons under 24 hours.";
    const resources = d.resources.filter((r) => r.title.trim() || r.url.trim());
    resources.forEach((r) => {
      const i = d.resources.indexOf(r);
      if (!r.title.trim()) next[`resources.${i}.title`] = "Name this resource.";
      try {
        new URL(r.url.trim());
      } catch {
        next[`resources.${i}.url`] = "Enter a full link starting with https://";
      }
    });
    setErrors(next);
    if (Object.keys(next).length) return;

    const body: Record<string, unknown> = {
      title: d.title.trim(),
      type: d.type,
      videoUrl: d.type === "video" ? d.videoUrl.trim() : "",
      content: d.content,
      durationSec: durationSec ?? 0,
      isPreview: d.isPreview,
      resources: resources.map((r) => ({ title: r.title.trim(), url: r.url.trim() })),
    };
    if (state.mode === "edit" && d.sectionId !== state.lesson.section) body.sectionId = d.sectionId;
    save.mutate(body);
  };

  const isVideo = d.type === "video";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {loadError && <p className="rounded-control bg-buoy-wash px-4 py-3 text-sm text-[#b23417]">The full lesson didn&apos;t load ({loadError}). Saving now may clear its article text.</p>}

      <Field label="Title" error={errors.title}>
        {(p) => <Input {...p} value={d.title} maxLength={160} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Joining two tables" />}
      </Field>

      <div className="flex flex-col gap-1.5" role="group" aria-labelledby="lesson-type-label">
        <span className="text-sm font-semibold text-ink-2" id="lesson-type-label">
          Type
        </span>
        <Tabs
          items={[
            { value: "video", label: "Video" },
            { value: "article", label: "Article" },
          ]}
          value={d.type}
          onChange={(v) => set("type", v)}
          className="self-start"
        />
      </div>

      {isVideo && (
        <MediaInput label="Video" kind="video" value={d.videoUrl} onChange={(v) => set("videoUrl", v)} error={errors.videoUrl} hint="YouTube, Vimeo or a direct video link." />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={isVideo ? "Length" : "Reading time"} hint="Minutes and seconds, like 12:30" error={errors.durationSec}>
          {(p) => <Input {...p} value={d.duration} inputMode="numeric" placeholder="0:00" onChange={(e) => set("duration", e.target.value)} />}
        </Field>
        {state.mode === "edit" && sections.length > 1 && (
          <Field label="Section" hint="Moving a lesson puts it at the end of that section.">
            {(p) => (
              <Select {...p} value={d.sectionId} onChange={(e) => set("sectionId", e.target.value)}>
                {sections.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      <div className="rounded-control bg-mist/60 px-4 py-3">
        <Switch checked={d.isPreview} onChange={(v) => set("isPreview", v)} label="Free preview" />
        <p className="mt-1 pl-[3.25rem] text-xs text-ink-3">Anyone can open this lesson from the course page, without buying.</p>
      </div>

      <Field
        label={isVideo ? "Notes under the video" : "Article"}
        hint={isVideo ? "Optional. Markdown works here." : "Markdown works here: headings, lists, links and code."}
        error={errors.content}
      >
        {(p) => <Textarea {...p} value={d.content} rows={isVideo ? 5 : 14} maxLength={100000} onChange={(e) => set("content", e.target.value)} />}
      </Field>

      <Resources draft={d.resources} onChange={(r) => set("resources", r)} errors={errors} />

      <div className="sticky bottom-0 -mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-line bg-foam px-6 py-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {state.mode === "create" ? "Add lesson" : "Save lesson"}
        </Button>
      </div>
    </form>
  );
}

function Resources({ draft, onChange, errors }: { draft: ResourceDraft[]; onChange: (r: ResourceDraft[]) => void; errors: Record<string, string> }) {
  const features = useFeatures();
  const canUpload = features.data?.uploads === true;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(0);
    try {
      const url = await uploadFile("resource", file, setUploading);
      onChange([...draft, { key: nextKey(), title: file.name.replace(/\.[^.]+$/, ""), url }]);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-ink-2">Resources</legend>
      {draft.length === 0 && <p className="text-sm text-ink-3">Slides, starter files or links students can keep.</p>}
      <ul className="flex flex-col gap-3">
        {draft.map((r, i) => (
          <li key={r.key} className="rounded-control border border-line p-3">
            <div className="flex items-start gap-2">
              <Paperclip className="mt-3.5 size-4 shrink-0 text-ink-3" aria-hidden />
              <div className="grid min-w-0 flex-1 gap-2">
                <Field label={<span className="sr-only">Resource {i + 1} name</span>} error={errors[`resources.${i}.title`]}>
                  {(p) => <Input {...p} value={r.title} placeholder="Name" maxLength={120} onChange={(e) => onChange(draft.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))} />}
                </Field>
                <Field label={<span className="sr-only">Resource {i + 1} link</span>} error={errors[`resources.${i}.url`]}>
                  {(p) => <Input {...p} type="url" value={r.url} placeholder="https://" onChange={(e) => onChange(draft.map((x) => (x.key === r.key ? { ...x, url: e.target.value } : x)))} />}
                </Field>
              </div>
              <button type="button" onClick={() => onChange(draft.filter((x) => x.key !== r.key))} className="grid size-11 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-ink/6 hover:text-ink" aria-label={`Remove resource ${i + 1}`}>
                <X className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} disabled={draft.length >= 20} onClick={() => onChange([...draft, { key: nextKey(), title: "", url: "" }])} className="-ml-3">
          Add link
        </Button>
        {canUpload && (
          <>
            <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden accept=".pdf,.zip,.txt,.md,.png,.jpg,.jpeg" onChange={(e) => upload(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" icon={<Upload className="size-4" />} loading={uploading !== null} disabled={draft.length >= 20} onClick={() => fileRef.current?.click()}>
              {uploading !== null ? `Uploading ${uploading}%` : "Upload file"}
            </Button>
          </>
        )}
      </div>
    </fieldset>
  );
}
