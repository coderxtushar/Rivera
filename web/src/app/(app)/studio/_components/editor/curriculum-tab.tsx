"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, Check, Eye, FileText, GripVertical, Pencil, PlayCircle, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { cn, duration } from "@/lib/format";
import type { CurriculumSection, Lesson } from "@/lib/types";
import { formatClock } from "../lib";
import { ConfirmDialog, ErrorState } from "../ui";
import { LessonSheet, type LessonSheetState } from "./lesson-sheet";

type Confirm = { kind: "section"; section: CurriculumSection } | { kind: "lesson"; lesson: Lesson } | null;

const KEYBOARD_HINT_ID = "reorder-hint";

function moveId(ids: string[], from: number, to: number) {
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function curriculumKey(courseId: string): QueryKey {
  return ["studio", "curriculum", courseId];
}

export function useCurriculum(courseId: string) {
  return useQuery({
    queryKey: curriculumKey(courseId),
    queryFn: async () => (await api<{ data: { curriculum: CurriculumSection[] } }>(`/courses/${courseId}/curriculum`)).data.curriculum,
  });
}

export function CurriculumTab({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const key = curriculumKey(courseId);
  const curriculum = useCurriculum(courseId);
  const sections = curriculum.data ?? [];

  const [sheet, setSheet] = useState<LessonSheetState>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [announcement, setAnnouncement] = useState("");

  const setSections = (update: (s: CurriculumSection[]) => CurriculumSection[]) => qc.setQueryData<CurriculumSection[]>(key, (old) => (old ? update(old) : old));
  const current = () => qc.getQueryData<CurriculumSection[]>(key) ?? [];
  const refreshCourse = () => qc.invalidateQueries({ queryKey: ["studio", "course", courseId] });
  const resync = (err: unknown) => {
    toast.error(`The new order wasn't saved. ${errorMessage(err)}`);
    qc.invalidateQueries({ queryKey: key });
  };

  /* -------------------------------------------------------- persistence */

  const saveSectionOrder = useMutation({
    mutationFn: (sectionIds: string[]) => api(`/courses/${courseId}/sections/order`, { method: "PUT", body: { sectionIds } }),
    onError: resync,
  });
  const saveLessonOrder = useMutation({
    mutationFn: ({ sectionId, lessonIds }: { sectionId: string; lessonIds: string[] }) =>
      api(`/courses/${courseId}/sections/${sectionId}/lessons/order`, { method: "PUT", body: { lessonIds } }),
    onError: resync,
  });

  const persistSections = () => {
    const ids = current().map((s) => s._id);
    if (ids.length) saveSectionOrder.mutate(ids);
  };
  const persistLessons = (sectionId: string) => {
    const ids = current()
      .find((s) => s._id === sectionId)
      ?.lessons.map((l) => l._id);
    if (ids?.length) saveLessonOrder.mutate({ sectionId, lessonIds: ids });
  };

  /*
   * Pointer drags save once, on drop. Reorder's built-in keyboard moves (Space,
   * arrows) have no drop callback, so those save after a short pause instead.
   */
  const dragging = useRef(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  const schedule = (id: string, fn: () => void) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(fn, 700));
  };

  const reorderSections = (ids: string[]) => {
    setSections((s) => ids.map((id) => s.find((x) => x._id === id)!).filter(Boolean));
    if (!dragging.current) schedule("sections", persistSections);
  };
  const reorderLessons = (sectionId: string, ids: string[]) => {
    setSections((s) => s.map((sec) => (sec._id === sectionId ? { ...sec, lessons: ids.map((id) => sec.lessons.find((l) => l._id === id)!).filter(Boolean) } : sec)));
    if (!dragging.current) schedule(sectionId, () => persistLessons(sectionId));
  };

  const moveSection = (index: number, delta: number) => {
    const ids = current().map((s) => s._id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    const next = moveId(ids, index, to);
    setSections((s) => next.map((id) => s.find((x) => x._id === id)!));
    saveSectionOrder.mutate(next);
    const title = current().find((s) => s._id === ids[index])?.title;
    setAnnouncement(`Moved section ${title} to position ${to + 1} of ${ids.length}`);
  };

  const moveLesson = (sectionId: string, index: number, delta: number) => {
    const sec = current().find((s) => s._id === sectionId);
    if (!sec) return;
    const ids = sec.lessons.map((l) => l._id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    const next = moveId(ids, index, to);
    setSections((s) => s.map((x) => (x._id === sectionId ? { ...x, lessons: next.map((id) => x.lessons.find((l) => l._id === id)!) } : x)));
    saveLessonOrder.mutate({ sectionId, lessonIds: next });
    setAnnouncement(`Moved lesson ${sec.lessons[index].title} to position ${to + 1} of ${ids.length}`);
  };

  const dragStart = () => (dragging.current = true);
  const sectionDragEnd = (before: string[]) => {
    dragging.current = false;
    if (current().map((s) => s._id).join() !== before.join()) persistSections();
  };
  const lessonDragEnd = (sectionId: string, before: string[]) => {
    dragging.current = false;
    const after = current().find((s) => s._id === sectionId)?.lessons.map((l) => l._id) ?? [];
    if (after.join() !== before.join()) persistLessons(sectionId);
  };

  /* ------------------------------------------------------------ editing */

  const addSection = useMutation({
    mutationFn: (title: string) => api<{ data: { section: CurriculumSection } }>(`/courses/${courseId}/sections`, { method: "POST", body: { title } }),
    onSuccess: (res) => {
      setSections((s) => [...s, { ...res.data.section, lessons: [] }]);
      refreshCourse();
      toast.success("Section added");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const renameSection = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api(`/courses/${courseId}/sections/${id}`, { method: "PATCH", body: { title } }),
    onSuccess: (_r, v) => {
      setSections((s) => s.map((x) => (x._id === v.id ? { ...x, title: v.title } : x)));
      toast.success("Section renamed");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (c: NonNullable<Confirm>) =>
      c.kind === "section" ? api(`/courses/${courseId}/sections/${c.section._id}`, { method: "DELETE" }) : api(`/courses/${courseId}/lessons/${c.lesson._id}`, { method: "DELETE" }),
    onSuccess: (_r, c) => {
      if (c.kind === "section") setSections((s) => s.filter((x) => x._id !== c.section._id));
      else setSections((s) => s.map((x) => ({ ...x, lessons: x.lessons.filter((l) => l._id !== c.lesson._id) })));
      refreshCourse();
      toast.success(c.kind === "section" ? "Section deleted" : "Lesson deleted");
      setConfirm(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  /* ------------------------------------------------------------- render */

  if (curriculum.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading curriculum">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-panel" />
        ))}
      </div>
    );
  }
  if (curriculum.isError) return <ErrorState message={errorMessage(curriculum.error)} onRetry={() => curriculum.refetch()} />;

  const lessonCount = sections.reduce((n, s) => n + s.lessons.length, 0);
  const totalSec = sections.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.durationSec, 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {sections.length ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Sections</dt>
              <dd className="font-semibold tabular-nums text-ink-2">{sections.length}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Lessons</dt>
              <dd className="font-semibold tabular-nums text-ink-2">{lessonCount}</dd>
            </div>
            {totalSec > 0 && (
              <div className="flex gap-1.5">
                <dt className="text-ink-3">Total length</dt>
                <dd className="font-semibold tabular-nums text-ink-2">{duration(totalSec)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-ink-3">Group lessons into sections, then drag them into the order students should follow.</p>
        )}
        {sections.length > 0 && (
          <p id={KEYBOARD_HINT_ID} className="text-xs text-ink-3">
            Drag by the handle, or use the arrow buttons.
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {sections.length === 0 ? (
        <EmptyState title="No sections yet" body="Sections are the chapters of your course. Add the first one below, then fill it with lessons." />
      ) : (
        <Reorder.Group as="ol" axis="y" values={sections.map((s) => s._id)} onReorder={reorderSections} className="space-y-4">
          {sections.map((section, i) => (
            <SectionItem
              key={section._id}
              section={section}
              index={i}
              count={sections.length}
              onMove={(d) => moveSection(i, d)}
              onRename={(title) => renameSection.mutateAsync({ id: section._id, title })}
              onDelete={() => setConfirm({ kind: "section", section })}
              onAddLesson={() => setSheet({ mode: "create", sectionId: section._id })}
              onEditLesson={(lesson) => setSheet({ mode: "edit", lesson })}
              onDeleteLesson={(lesson) => setConfirm({ kind: "lesson", lesson })}
              onMoveLesson={(li, d) => moveLesson(section._id, li, d)}
              onReorderLessons={(ids) => reorderLessons(section._id, ids)}
              onDragStart={dragStart}
              onSectionDragEnd={sectionDragEnd}
              onLessonDragEnd={(before) => lessonDragEnd(section._id, before)}
              sectionIds={sections.map((s) => s._id)}
            />
          ))}
        </Reorder.Group>
      )}

      <AddSection onAdd={(title) => addSection.mutateAsync(title)} pending={addSection.isPending} first={sections.length === 0} />

      <LessonSheet state={sheet} onClose={() => setSheet(null)} courseId={courseId} sections={sections} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "section" ? "Delete this section?" : "Delete this lesson?"}
        confirmLabel={confirm?.kind === "section" ? "Delete section" : "Delete lesson"}
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm)}
        body={
          confirm?.kind === "section" ? (
            <p>
              <strong className="text-ink">{confirm.section.title}</strong>{" "}
              {confirm.section.lessons.length
                ? `and its ${confirm.section.lessons.length === 1 ? "lesson" : `${confirm.section.lessons.length} lessons`} will be removed for good. Students lose their progress on those lessons.`
                : "will be removed. It has no lessons."}
            </p>
          ) : confirm?.kind === "lesson" ? (
            <p>
              <strong className="text-ink">{confirm.lesson.title}</strong> will be removed for good, along with students&apos; progress on it.
            </p>
          ) : null
        }
      />
    </div>
  );
}

/* ================================================================ section */

function SectionItem({
  section,
  index,
  count,
  sectionIds,
  onMove,
  onRename,
  onDelete,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onMoveLesson,
  onReorderLessons,
  onDragStart,
  onSectionDragEnd,
  onLessonDragEnd,
}: {
  section: CurriculumSection;
  index: number;
  count: number;
  sectionIds: string[];
  onMove: (delta: number) => void;
  onRename: (title: string) => Promise<unknown>;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (l: Lesson) => void;
  onDeleteLesson: (l: Lesson) => void;
  onMoveLesson: (index: number, delta: number) => void;
  onReorderLessons: (ids: string[]) => void;
  onDragStart: () => void;
  onSectionDragEnd: (before: string[]) => void;
  onLessonDragEnd: (before: string[]) => void;
}) {
  const controls = useDragControls();
  const before = useRef<string[]>([]);
  const lessonsBefore = useRef<string[]>([]);
  const [renaming, setRenaming] = useState(false);
  const total = section.lessons.reduce((n, l) => n + l.durationSec, 0);

  const startDrag = (e: PointerEvent) => {
    before.current = sectionIds;
    controls.start(e);
  };

  return (
    <Reorder.Item
      as="li"
      value={section._id}
      dragListener={false}
      dragControls={controls}
      layout="position"
      onDragStart={onDragStart}
      onDragEnd={() => onSectionDragEnd(before.current)}
      whileDrag={{ scale: 1.01, boxShadow: "0 24px 60px -20px rgb(13 36 51 / 0.35)" }}
      aria-describedby={KEYBOARD_HINT_ID}
      className="relative list-none rounded-panel border border-line bg-foam focus-visible:outline-2 focus-visible:outline-channel"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
        <span
          onPointerDown={startDrag}
          className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-control text-ink-3 hover:bg-ink/6 hover:text-ink active:cursor-grabbing"
          title="Drag to reorder"
          aria-hidden
        >
          <GripVertical className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <RenameForm initial={section.title} onCancel={() => setRenaming(false)} onSave={(t) => onRename(t).then(() => setRenaming(false))} />
          ) : (
            <>
              <p className="text-xs font-semibold text-ink-3">Section {index + 1}</p>
              <h3 className="truncate font-bold text-ink">{section.title}</h3>
            </>
          )}
        </div>
        {!renaming && (
          <div className="flex items-center gap-0.5">
            <span className="mr-2 hidden text-sm text-ink-3 sm:inline">
              {section.lessons.length === 1 ? "1 lesson" : `${section.lessons.length} lessons`}
              {total > 0 && `, ${duration(total)}`}
            </span>
            <IconButton label={`Move section ${section.title} up`} onClick={() => onMove(-1)} disabled={index === 0} icon={ArrowUp} />
            <IconButton label={`Move section ${section.title} down`} onClick={() => onMove(1)} disabled={index === count - 1} icon={ArrowDown} />
            <IconButton label={`Rename section ${section.title}`} onClick={() => setRenaming(true)} icon={Pencil} />
            <IconButton label={`Delete section ${section.title}`} onClick={onDelete} icon={Trash2} danger />
          </div>
        )}
      </header>

      {section.lessons.length > 0 ? (
        <Reorder.Group as="ol" axis="y" values={section.lessons.map((l) => l._id)} onReorder={onReorderLessons} className="divide-y divide-line">
          {section.lessons.map((lesson, li) => (
            <LessonItem
              key={lesson._id}
              lesson={lesson}
              index={li}
              count={section.lessons.length}
              onMove={(d) => onMoveLesson(li, d)}
              onEdit={() => onEditLesson(lesson)}
              onDelete={() => onDeleteLesson(lesson)}
              onDragStart={() => {
                lessonsBefore.current = section.lessons.map((l) => l._id);
                onDragStart();
              }}
              onDragEnd={() => onLessonDragEnd(lessonsBefore.current)}
            />
          ))}
        </Reorder.Group>
      ) : (
        <p className="px-4 py-5 text-sm text-ink-3 sm:px-5">No lessons in this section yet.</p>
      )}

      <div className="border-t border-line px-2 py-2 sm:px-3">
        <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={onAddLesson}>
          Add lesson
        </Button>
      </div>
    </Reorder.Item>
  );
}

/* ================================================================= lesson */

function LessonItem({
  lesson,
  index,
  count,
  onMove,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  lesson: Lesson;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const Icon = lesson.type === "video" ? PlayCircle : FileText;
  const missingVideo = lesson.type === "video" && !lesson.videoUrl;

  return (
    <Reorder.Item
      as="li"
      value={lesson._id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.015, boxShadow: "0 12px 32px -12px rgb(13 36 51 / 0.3)", borderRadius: 12 }}
      aria-describedby={KEYBOARD_HINT_ID}
      className="relative flex list-none items-center gap-2 bg-foam px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-channel sm:px-4"
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-control text-ink-3 hover:bg-ink/6 hover:text-ink active:cursor-grabbing"
        title="Drag to reorder"
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>
      <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="block max-w-full truncate text-left font-medium text-ink hover:text-channel">
          <span className="sr-only">{lesson.type === "video" ? "Video lesson: " : "Article lesson: "}</span>
          {lesson.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          {lesson.durationSec > 0 && <span className="tabular-nums">{formatClock(lesson.durationSec)}</span>}
          {lesson.isPreview && (
            <Badge tone="current" className="py-0">
              <Eye className="size-3" aria-hidden />
              Free preview
            </Badge>
          )}
          {missingVideo && (
            <Badge tone="buoy" className="py-0">
              No video yet
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label={`Move lesson ${lesson.title} up`} onClick={() => onMove(-1)} disabled={index === 0} icon={ArrowUp} small />
        <IconButton label={`Move lesson ${lesson.title} down`} onClick={() => onMove(1)} disabled={index === count - 1} icon={ArrowDown} small />
        <IconButton label={`Edit lesson ${lesson.title}`} onClick={onEdit} icon={Pencil} small className="hidden sm:grid" />
        <IconButton label={`Delete lesson ${lesson.title}`} onClick={onDelete} icon={Trash2} danger small />
      </div>
    </Reorder.Item>
  );
}

/* ================================================================ helpers */

function IconButton({
  label,
  onClick,
  icon: Icon,
  disabled,
  danger,
  small,
  className,
}: {
  label: string;
  onClick: () => void;
  icon: typeof ArrowUp;
  disabled?: boolean;
  danger?: boolean;
  small?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-control text-ink-3 transition-colors disabled:pointer-events-none disabled:opacity-30",
        small ? "size-8" : "size-9",
        danger ? "hover:bg-buoy-wash hover:text-[#b23417]" : "hover:bg-ink/6 hover:text-ink",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function RenameForm({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => Promise<unknown>; onCancel: () => void }) {
  const [title, setTitle] = useState(initial);
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || t === initial) return onCancel();
    setSaving(true);
    try {
      await onSave(t);
    } catch {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onCancel())}
        maxLength={120}
        aria-label="Section title"
        autoFocus
        className="h-9"
      />
      <Button type="submit" size="sm" loading={saving} icon={<Check className="size-4" />} aria-label="Save section title" />
      <button type="button" onClick={onCancel} className="grid size-8 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-ink/6 hover:text-ink" aria-label="Cancel renaming">
        <X className="size-4" />
      </button>
    </form>
  );
}

function AddSection({ onAdd, pending, first }: { onAdd: (title: string) => Promise<unknown>; pending: boolean; first: boolean }) {
  const [open, setOpen] = useState(first);
  const [title, setTitle] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await onAdd(title.trim());
      setTitle("");
    } catch {
      /* toast already shown */
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open || first ? (
        <motion.form
          key="form"
          onSubmit={submit}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex flex-col gap-3 rounded-panel border border-dashed border-line-strong p-4 sm:flex-row sm:items-end"
        >
          <Field label={first ? "First section" : "New section"} className="flex-1">
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Getting set up" />}
          </Field>
          <div className="flex gap-2">
            {!first && (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={pending} disabled={!title.trim()} icon={<Plus className="size-4" />}>
              Add section
            </Button>
          </div>
        </motion.form>
      ) : (
        <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            Add section
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
