"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Course, Viewer } from "@/lib/types";
import { CurriculumTab, useCurriculum } from "../../_components/editor/curriculum-tab";
import { DetailsTab, detailsChanges, toDraft, type DetailsDraft } from "../../_components/editor/details-tab";
import { PublishTab } from "../../_components/editor/publish-tab";
import { StudentsTab } from "../../_components/editor/students-tab";
import { ErrorState, StatusBadge } from "../../_components/ui";

type Tab = "details" | "curriculum" | "pricing" | "students";
const TABS: Tab[] = ["details", "curriculum", "pricing", "students"];

export default function CourseEditorPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <Editor />
    </Suspense>
  );
}

function Editor() {
  const { id } = useParams<{ id: string }>();
  const course = useQuery({
    queryKey: ["studio", "course", id],
    queryFn: () => api<{ data: { course: Course; viewer: Viewer | null } }>(`/courses/${id}`),
  });

  if (course.isPending) return <EditorSkeleton />;
  if (course.isError) {
    if (course.error instanceof ApiError && course.error.status === 404) {
      return (
        <EmptyState
          title="Course not found"
          body="It may have been deleted, or the link is wrong."
          action={
            <ButtonLink href="/studio/courses" variant="secondary">
              Back to courses
            </ButtonLink>
          }
        />
      );
    }
    return <ErrorState message={errorMessage(course.error)} onRetry={() => course.refetch()} />;
  }
  if (course.data.data.viewer && !course.data.data.viewer.canManage) {
    return (
      <EmptyState
        title="This course belongs to someone else"
        body="You can only edit courses you created."
        action={
          <ButtonLink href="/studio/courses" variant="secondary">
            Back to your courses
          </ButtonLink>
        }
      />
    );
  }
  return <EditorBody key={id} course={course.data.data.course} />;
}

function EditorBody({ course }: { course: Course }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "details";
  const setTab = (t: Tab) => window.history.replaceState(null, "", t === "details" ? pathname : `${pathname}?tab=${t}`);

  // The Details draft lives here so it survives switching tabs.
  const [draft, setDraft] = useState<DetailsDraft>(() => toDraft(course));
  const dirty = Object.keys(detailsChanges(draft, course)).length > 0;
  const curriculum = useCurriculum(course._id);

  // Warn before reloading or closing the tab with unsaved Details edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <PageFade>
      <Link href="/studio/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        All courses
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={course.status} />
            <span className="text-sm text-ink-3">{course.stats.enrollmentCount === 1 ? "1 student" : `${course.stats.enrollmentCount.toLocaleString("en-IN")} students`}</span>
          </div>
          <h1 className="display text-2xl sm:text-3xl" style={{ ["--wdth" as string]: 86 }}>
            {course.title}
          </h1>
        </div>
        <ButtonLink href={`/courses/${course.slug}`} variant="secondary" size="sm" icon={<ExternalLink className="size-4" />} target="_blank" rel="noopener">
          {course.status === "published" ? "View course page" : "Preview"}
        </ButtonLink>
      </header>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            {
              value: "details",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  Details
                  {dirty && (
                    <>
                      <span className="size-1.5 rounded-full bg-buoy" aria-hidden />
                      <span className="sr-only">(unsaved changes)</span>
                    </>
                  )}
                </span>
              ),
            },
            { value: "curriculum", label: "Curriculum", count: curriculum.data?.reduce((n, s) => n + s.lessons.length, 0) },
            { value: "pricing", label: "Pricing and publish" },
            { value: "students", label: "Students", count: course.stats.enrollmentCount || undefined },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "details" && <DetailsTab course={course} draft={draft} setDraft={setDraft} />}
          {tab === "curriculum" && <CurriculumTab courseId={course._id} />}
          {tab === "pricing" && <PublishTab course={course} sections={curriculum.data} unsavedDetails={dirty} onGoTo={setTab} />}
          {tab === "students" && <StudentsTab courseId={course._id} published={course.status === "published"} />}
        </motion.div>
      </AnimatePresence>
    </PageFade>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading course">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-full" />
      <Skeleton className="h-72 rounded-panel" />
      <Skeleton className="h-48 rounded-panel" />
    </div>
  );
}
