"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Star, Users } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Price, Thumb } from "@/components/course/course-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageTitle, Pagination } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api";
import { cn, compact, date } from "@/lib/format";
import type { CourseStatus, Paged } from "@/lib/types";
import type { StudioCourse } from "../_components/lib";
import { ErrorState, RowsSkeleton, StatusBadge } from "../_components/ui";

type Filter = "all" | CourseStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const EMPTY: Record<Filter, { title: string; body: string }> = {
  all: { title: "No courses yet", body: "Create a course to start building lessons. It stays a private draft until you publish it." },
  draft: { title: "No drafts", body: "Every course you're still working on shows up here." },
  published: { title: "Nothing published yet", body: "Publish a draft once it has a description, a section and a lesson." },
  archived: { title: "No archived courses", body: "Archived courses are hidden from the catalog, but enrolled students keep access." },
};

const createAction = (
  <ButtonLink href="/studio/courses/new" icon={<Plus className="size-4" />}>
    Create course
  </ButtonLink>
);

export default function StudioCoursesPage() {
  return (
    <PageFade>
      <PageTitle title="Courses" sub="Drafts, live courses and archived ones. Open a course to edit it." action={createAction} />
      <Suspense fallback={<RowsSkeleton />}>
        <CourseList />
      </Suspense>
    </PageFade>
  );
}

function CourseList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("status");
  const filter: Filter = FILTERS.some((f) => f.value === raw) ? (raw as Filter) : "all";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const setQuery = (next: { status?: Filter; page?: number }) => {
    const q = new URLSearchParams();
    const status = next.status ?? filter;
    const p = next.page ?? 1;
    if (status !== "all") q.set("status", status);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const courses = useQuery({
    queryKey: ["studio", "courses", { status: filter, page }],
    queryFn: () => api<Paged<StudioCourse>>("/instructor/courses", { query: { status: filter === "all" ? undefined : filter, page, limit: 12 } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <Tabs items={FILTERS} value={filter} onChange={(v) => setQuery({ status: v })} />
      </div>

      {courses.isPending ? (
        <RowsSkeleton />
      ) : courses.isError ? (
        <ErrorState message={errorMessage(courses.error)} onRetry={() => courses.refetch()} />
      ) : courses.data.data.length === 0 ? (
        <EmptyState title={EMPTY[filter].title} body={EMPTY[filter].body} action={filter === "all" || filter === "draft" ? createAction : undefined} />
      ) : (
        <>
          <ul className={cn("divide-y divide-line overflow-hidden rounded-panel border border-line bg-foam transition-opacity", courses.isPlaceholderData && "opacity-60")}>
            {courses.data.data.map((c) => (
              <CourseRow key={c._id} course={c} />
            ))}
          </ul>
          <Pagination meta={courses.data.meta} onPage={(p) => setQuery({ page: p })} />
        </>
      )}
    </div>
  );
}

function CourseRow({ course }: { course: StudioCourse }) {
  const { enrollmentCount, ratingAvg, ratingCount } = course.stats;
  return (
    <li className="group relative flex items-center gap-4 p-4 transition-colors hover:bg-white sm:p-5">
      <Thumb course={course} className="w-24 shrink-0 rounded-control sm:w-32" sizes="128px" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={course.status} />
          <span className="text-xs text-ink-3">Updated {date(course.updatedAt)}</span>
        </div>
        <h2 className="mt-1.5 truncate font-bold text-ink">
          <Link href={`/studio/courses/${course._id}`} className="after:absolute after:inset-0 after:content-[''] group-hover:text-channel">
            {course.title}
          </Link>
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            {enrollmentCount === 1 ? "1 student" : `${compact(enrollmentCount)} students`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-3.5" aria-hidden />
            {ratingCount ? (
              <>
                {ratingAvg.toFixed(1)}
                <span className="sr-only">out of 5 from {ratingCount} ratings</span>
              </>
            ) : (
              "No ratings"
            )}
          </span>
          <Price amount={course.price} currency={course.currency} className="text-ink-2 sm:hidden" />
        </div>
      </div>
      <Price amount={course.price} currency={course.currency} className="hidden shrink-0 text-lg sm:block" />
    </li>
  );
}
