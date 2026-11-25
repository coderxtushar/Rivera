"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ListTree, PanelLeftClose, PanelLeftOpen, RotateCw, Star, X } from "lucide-react";
import { Logo } from "@/components/brand/brand";
import { RequireAuth } from "@/components/layout/app-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ProgressRing } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/format";
import type { Certificate, Course, CurriculumSection, Lesson, Progress, Viewer } from "@/lib/types";
import { Celebration } from "./celebration";
import { CompleteButton } from "./complete-button";
import { CurriculumList } from "./curriculum-list";
import { LessonContent, LessonMeta, Resources, VideoFrame } from "./lesson-stage";
import { NightState, PlayerSkeleton } from "./night";
import { ReviewDialog } from "./review-dialog";

type CourseData = { data: { course: Course; curriculum: CurriculumSection[]; viewer: Viewer | null } };
type CurriculumData = { data: { curriculum: CurriculumSection[]; progress: Progress | null } };
type LessonData = { data: { lesson: Lesson } };
type CompleteData = { data: { progress: Progress; certificate: Certificate | null } };

type FlatLesson = Lesson & { sectionTitle: string };

const EASE = [0.22, 1, 0.36, 1] as const;
/** Long enough to see the check land before the next lesson loads. */
const ADVANCE_DELAY = 1100;

export function Player() {
  return (
    <RequireAuth>
      <PlayerData />
    </RequireAuth>
  );
}

function PlayerData() {
  const { slug } = useParams<{ slug: string }>();
  const key = encodeURIComponent(slug);

  // Ids accept slugs, so the course and its curriculum load in parallel.
  const courseQ = useQuery({ queryKey: ["learn", slug], queryFn: () => api<CourseData>(`/courses/${key}`) });
  const curQ = useQuery({ queryKey: ["learn", slug, "curriculum"], queryFn: () => api<CurriculumData>(`/courses/${key}/curriculum`) });

  if (courseQ.isPending || (curQ.isPending && !courseQ.isError)) return <PlayerSkeleton />;

  const failure = courseQ.error ?? curQ.error;
  if (failure) {
    const err = failure instanceof ApiError ? failure : null;
    if (err?.status === 404) {
      return (
        <Frame>
          <NightState
            title="We couldn't find this course"
            body="It may have been renamed or removed. Your courses are all listed in My learning."
            action={<ButtonLink href="/dashboard" variant="light">Go to my learning</ButtonLink>}
          />
        </Frame>
      );
    }
    if (err?.code === "NOT_ENROLLED") {
      return (
        <Frame title={courseQ.data?.data.course.title}>
          <NightState
            title="Enroll to start learning"
            body="You need to enroll in this course before you can watch its lessons. Free preview lessons are on the course page."
            action={
              <ButtonLink href={`/courses/${slug}`} variant="light">
                View course
              </ButtonLink>
            }
          />
        </Frame>
      );
    }
    return (
      <Frame title={courseQ.data?.data.course.title}>
        <NightState
          title="This course didn't load"
          body={errorMessage(failure)}
          action={
            <Button
              variant="light"
              icon={<RotateCw className="size-4" />}
              loading={courseQ.isFetching || curQ.isFetching}
              onClick={() => {
                if (courseQ.isError) courseQ.refetch();
                if (curQ.isError) curQ.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      </Frame>
    );
  }

  const course = courseQ.data!.data.course;
  const { curriculum, progress } = curQ.data!.data;
  if (!curriculum.some((s) => s.lessons.length)) {
    return (
      <Frame title={course.title}>
        <NightState
          title="No lessons yet"
          body="The instructor is still adding lessons to this course. We'll email you when there's something to watch."
          action={<ButtonLink href="/dashboard" variant="light">Go to my learning</ButtonLink>}
        />
      </Frame>
    );
  }

  return <PlayerView slug={slug} course={course} sections={curriculum} progress={progress} />;
}

/** Top bar only, for full-page states. */
function Frame({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <>
      <TopBar title={title} />
      <main id="main">{children}</main>
    </>
  );
}

function TopBar({
  title,
  percent,
  children,
}: {
  title?: string;
  percent?: number | null;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-white/10 bg-night/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      <Logo tone="light" className="shrink-0 [&>span]:hidden sm:[&>span]:inline" />
      <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
      {children}
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90 sm:text-base">{title}</p>
      {typeof percent === "number" && (
        <span className="flex items-center gap-2" title={`${percent}% of the course complete`}>
          <span className="sr-only">Course progress</span>
          <ProgressRing value={percent} size={38} stroke={3.5} className="text-shoal" />
        </span>
      )}
      <Link
        href="/dashboard"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-5" aria-hidden />
        <span className="hidden sm:inline">Exit</span>
        <span className="sr-only sm:hidden">Exit to my learning</span>
      </Link>
    </header>
  );
}

function withCompletion(old: CurriculumData, lessonId: string, done: boolean, total: number): CurriculumData {
  const prev = old.data.progress;
  if (!prev) return old;
  const set = new Set(prev.completedLessons);
  if (done) set.add(lessonId);
  else set.delete(lessonId);
  const completedLessons = [...set];
  const percent = total ? Math.min(100, Math.round((completedLessons.length / total) * 100)) : 0;
  return { data: { ...old.data, progress: { ...prev, completedLessons, percent, lastLesson: lessonId } } };
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "VIDEO", "AUDIO", "IFRAME"].includes(target.tagName);
}

function PlayerView({ slug, course, sections, progress }: { slug: string; course: Course; sections: CurriculumSection[]; progress: Progress | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const key = encodeURIComponent(slug);
  const curKey = useMemo(() => ["learn", slug, "curriculum"], [slug]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [finished, setFinished] = useState<Certificate | null>(null);
  const [announce, setAnnounce] = useState("");
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flat = useMemo<FlatLesson[]>(() => sections.flatMap((s) => s.lessons.map((l) => ({ ...l, sectionTitle: s.title }))), [sections]);
  const completed = useMemo(() => new Set(progress?.completedLessons ?? []), [progress]);
  const enrolled = progress !== null;

  const requested = search.get("lesson");
  const has = (id?: string | null): id is string => Boolean(id && flat.some((l) => l._id === id));
  const currentId = has(requested) ? requested : has(progress?.lastLesson) ? progress!.lastLesson! : flat[0]._id;
  const index = flat.findIndex((l) => l._id === currentId);
  const outline = flat[index];
  const prev = flat[index - 1];
  const next = flat[index + 1];

  // Full lesson (article body). Fetching it also records "last watched" on the server.
  const lessonQ = useQuery({
    queryKey: ["learn", slug, "lesson", currentId],
    queryFn: () => api<LessonData>(`/courses/${key}/lessons/${currentId}`),
  });
  const lesson: FlatLesson = { ...outline, ...lessonQ.data?.data.lesson };
  const isArticle = lesson.type === "article";
  const done = completed.has(currentId);

  const goTo = useCallback((id: string) => router.replace(`/learn/${slug}?lesson=${id}`, { scroll: false }), [router, slug]);

  useEffect(() => {
    document.title = `${lesson.title} | ${course.title}`;
  }, [lesson.title, course.title]);

  // New lesson: back to the top, and drop any pending auto-advance.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    return () => clearTimeout(advanceTimer.current);
  }, [currentId]);

  const anyDialog = sheetOpen || reviewOpen || Boolean(finished);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyDialog || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isTyping(e.target)) return;
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        goTo(prev._id);
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        goTo(next._id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyDialog, prev, next, goTo]);

  const toggle = useMutation({
    mutationKey: ["learn", slug, "complete"],
    mutationFn: ({ lessonId, done: d }: { lessonId: string; done: boolean }) =>
      api<CompleteData>(`/courses/${key}/lessons/${lessonId}/complete`, { method: d ? "POST" : "DELETE" }),
    onMutate: async ({ lessonId, done: d }) => {
      await qc.cancelQueries({ queryKey: curKey });
      const before = qc.getQueryData<CurriculumData>(curKey);
      qc.setQueryData<CurriculumData>(curKey, (old) => old && withCompletion(old, lessonId, d, flat.length));
      return { before };
    },
    onError: (err, _vars, ctx) => {
      clearTimeout(advanceTimer.current);
      if (ctx?.before) qc.setQueryData(curKey, ctx.before);
      toast.error(errorMessage(err));
    },
    onSuccess: (res, { done: d }, ctx) => {
      // With clicks still in flight, keep the optimistic state; the last response settles it.
      if (qc.isMutating({ mutationKey: ["learn", slug, "complete"] }) <= 1) {
        qc.setQueryData<CurriculumData>(curKey, (old) => old && { data: { ...old.data, progress: res.data.progress } });
      }
      const wasFinished = (ctx?.before?.data.progress?.percent ?? 0) >= 100;
      if (d && res.data.certificate && !wasFinished) {
        clearTimeout(advanceTimer.current);
        setFinished(res.data.certificate);
        qc.invalidateQueries({ queryKey: ["dashboard", "certificates"] });
      }
      qc.invalidateQueries({ queryKey: ["dashboard", "enrollments"] });
    },
  });

  const onToggle = () => {
    const nextDone = !done;
    clearTimeout(advanceTimer.current);
    toggle.mutate({ lessonId: currentId, done: nextDone });
    setAnnounce(nextDone ? `${lesson.title} marked complete` : `${lesson.title} marked not complete`);
    if (nextDone && next) advanceTimer.current = setTimeout(() => goTo(next._id), ADVANCE_DELAY);
  };

  const percent = progress?.percent ?? null;
  const canReview = enrolled && !reviewed;

  const completeButton = enrolled ? <CompleteButton key={currentId} done={done} onToggle={onToggle} /> : null;

  return (
    <>
      <TopBar title={course.title} percent={percent}>
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-expanded={sidebarOpen}
          aria-controls="player-sidebar"
          className="hidden size-10 shrink-0 place-items-center rounded-control text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:grid"
        >
          {sidebarOpen ? <PanelLeftClose className="size-5" aria-hidden /> : <PanelLeftOpen className="size-5" aria-hidden />}
          <span className="sr-only">{sidebarOpen ? "Hide course content" : "Show course content"}</span>
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="grid size-10 shrink-0 place-items-center rounded-control text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <ListTree className="size-5" aria-hidden />
          <span className="sr-only">Course content</span>
        </button>
      </TopBar>

      <div className="flex">
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              id="player-sidebar"
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 overflow-hidden border-r border-white/10 bg-night-2/60 lg:block"
            >
              <div className="h-full w-[340px] overflow-y-auto overscroll-contain p-3 scrollbar-none">
                <CurriculumList slug={slug} sections={sections} completed={completed} currentId={currentId} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main id="main" className="min-w-0 flex-1">
          <div className={cn("mx-auto w-full px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8", isArticle ? "max-w-3xl" : "max-w-5xl")}>
            {!isArticle && <VideoFrame lesson={lesson} />}

            <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between", isArticle ? "mt-2" : "mt-7")}>
              <div className="min-w-0">
                <h1 className="display text-2xl text-white sm:text-3xl" style={{ ["--wdth" as string]: 86 }}>
                  {lesson.title}
                </h1>
                <LessonMeta lesson={lesson} sectionTitle={lesson.sectionTitle} />
              </div>
              {!isArticle && completeButton}
            </div>

            {!enrolled && (
              <p className="mt-5 rounded-card bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-inset ring-white/10">
                You&apos;re viewing this course as its instructor, so progress isn&apos;t tracked.
              </p>
            )}

            <LessonContent
              content={lessonQ.data?.data.lesson.content}
              loading={lessonQ.isPending}
              error={lessonQ.error}
              onRetry={() => lessonQ.refetch()}
              isArticle={isArticle}
            />

            {isArticle && completeButton && <div className="mt-10">{completeButton}</div>}

            <Resources resources={lesson.resources} />

            <nav aria-label="Lesson navigation" className="mt-12 grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-2">
              {prev ? <StepLink slug={slug} lesson={prev} dir="prev" /> : <span className="hidden sm:block" />}
              {next ? (
                <StepLink slug={slug} lesson={next} dir="next" />
              ) : enrolled && canReview ? (
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="flex items-center justify-end gap-3 rounded-card bg-white/5 px-4 py-4 text-right ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-white/55">Last lesson</span>
                    <span className="mt-0.5 block font-semibold text-white">Leave a review</span>
                  </span>
                  <Star className="size-5 shrink-0 text-shoal" aria-hidden />
                </button>
              ) : null}
            </nav>
            <p className="mt-4 hidden text-center text-xs text-white/45 sm:block">
              Use the <kbd className="rounded border border-white/20 px-1 font-sans">←</kbd> and{" "}
              <kbd className="rounded border border-white/20 px-1 font-sans">→</kbd> keys to move between lessons.
            </p>

            {canReview && next && (
              <div className="mt-8 flex justify-center">
                <Button variant="ghost" size="sm" className="text-white/75 hover:bg-white/10 hover:text-white" icon={<Star className="size-4" />} onClick={() => setReviewOpen(true)}>
                  Leave a review
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="Course content" description={percent !== null ? `${percent}% complete` : undefined} variant="sheet">
        <div className="-mx-3">
          <CurriculumList slug={slug} sections={sections} completed={completed} currentId={currentId} tone="light" onNavigate={() => setSheetOpen(false)} />
        </div>
      </Dialog>

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        courseId={course._id}
        slug={slug}
        courseTitle={course.title}
        onReviewed={() => setReviewed(true)}
      />

      <Celebration
        open={Boolean(finished)}
        courseTitle={course.title}
        certificateCode={finished?.code}
        canReview={canReview}
        onReview={() => {
          setFinished(null);
          setReviewOpen(true);
        }}
        onClose={() => setFinished(null)}
      />
    </>
  );
}

function StepLink({ slug, lesson, dir }: { slug: string; lesson: FlatLesson; dir: "prev" | "next" }) {
  const nextDir = dir === "next";
  const Icon = nextDir ? ChevronRight : ChevronLeft;
  return (
    <Link
      href={`/learn/${slug}?lesson=${lesson._id}`}
      replace
      scroll={false}
      rel={nextDir ? "next" : "prev"}
      className={cn(
        "group flex items-center gap-3 rounded-card bg-white/5 px-4 py-4 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10",
        nextDir && "flex-row-reverse text-right sm:col-start-2",
      )}
    >
      <Icon className="size-5 shrink-0 text-white/50 transition-transform duration-300 group-hover:text-white" aria-hidden />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white/55">{nextDir ? "Next lesson" : "Previous lesson"}</span>
        <span className="mt-0.5 line-clamp-2 block font-semibold text-white">{lesson.title}</span>
      </span>
    </Link>
  );
}
