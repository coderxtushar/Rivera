"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Award, Play } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Thumb } from "@/components/course/course-card";
import { DepthGauge } from "@/components/brand/brand";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, Pagination, PageTitle, ProgressBar, ProgressRing, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { fullName, instructorOf, relativeTime } from "@/lib/format";
import type { Certificate, Enrollment, Paged } from "@/lib/types";
import { QueryError } from "./_components/query-error";

const LIMIT = 12;

const fetchEnrollments = (page: number) => api<Paged<Enrollment>>("/users/me/enrollments", { query: { page, limit: LIMIT } });

function courseIdOf(c: Certificate["course"]) {
  return typeof c === "object" && c ? c._id : c;
}

/** The enrollment to feature: the most recently opened course that isn't finished yet. */
function pickHero(items: Enrollment[]) {
  return items.find((e) => e.progress.percent < 100) ?? items[0];
}

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const first = useQuery({ queryKey: ["dashboard", "enrollments", 1], queryFn: () => fetchEnrollments(1) });
  const current = useQuery({
    queryKey: ["dashboard", "enrollments", page],
    queryFn: () => fetchEnrollments(page),
    placeholderData: keepPreviousData,
  });
  const certificates = useQuery({
    queryKey: ["dashboard", "certificates"],
    queryFn: () => api<{ data: Certificate[] }>("/users/me/certificates"),
  });

  const certByCourse = new Map((certificates.data?.data ?? []).map((c) => [courseIdOf(c.course), c.code]));
  const valid = (list?: Enrollment[]) => (list ?? []).filter((e) => e.course && typeof e.course === "object");
  const firstItems = valid(first.data?.data);
  const hero = firstItems.length ? pickHero(firstItems) : undefined;
  const items = valid(current.data?.data).filter((e) => e._id !== hero?._id);
  const total = current.data?.meta.total ?? 0;

  return (
    <PageFade>
      <PageTitle title="My learning" sub={total > 0 ? `You're enrolled in ${total === 1 ? "1 course" : `${total} courses`}.` : undefined} />

      {first.isPending ? (
        <DashboardSkeleton />
      ) : first.isError ? (
        <QueryError title="We couldn't load your courses" error={first.error} onRetry={() => first.refetch()} retrying={first.isFetching} />
      ) : !hero ? (
        <EmptyState
          title="Your learning starts here"
          body="Pick a course, try its free lessons, and it will show up here with your progress."
          action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
        />
      ) : (
        <>
          <Hero enrollment={hero} certificateCode={certByCourse.get(hero.course._id)} />

          {(items.length > 0 || page > 1) && (
            <section aria-labelledby="all-courses" className="mt-14">
              <h2 id="all-courses" className="display text-2xl" style={{ ["--wdth" as string]: 88 }}>
                Your courses
              </h2>
              {current.isError ? (
                <div className="mt-6">
                  <QueryError title="We couldn't load this page" error={current.error} onRetry={() => current.refetch()} retrying={current.isFetching} />
                </div>
              ) : (
                <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3" aria-busy={current.isPlaceholderData || undefined}>
                  {items.map((e) => (
                    <li key={e._id}>
                      <EnrollmentCard enrollment={e} certificateCode={certByCourse.get(e.course._id)} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-10">
                <Pagination meta={current.data?.meta} onPage={setPage} />
              </div>
            </section>
          )}
        </>
      )}
    </PageFade>
  );
}

function lessonsLine(e: Enrollment) {
  const done = e.progress.completedLessons?.length ?? 0;
  const total = e.course.stats?.lessonCount ?? 0;
  return total ? `${done} of ${total} lessons` : null;
}

function Hero({ enrollment, certificateCode }: { enrollment: Enrollment; certificateCode?: string }) {
  const { course, progress } = enrollment;
  const instructor = instructorOf(course);
  const done = progress.percent >= 100;
  const started = Boolean(progress.lastLesson) || progress.percent > 0;
  const lessons = lessonsLine(enrollment);

  return (
    <section aria-labelledby="continue">
      <h2 id="continue" className="display mb-5 text-2xl" style={{ ["--wdth" as string]: 88 }}>
        {done ? "Recently finished" : started ? "Continue learning" : "Ready to start"}
      </h2>
      <div className="grid rounded-panel bg-night p-4 text-white sm:p-6 items-center gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-8">
        <Link href={`/learn/${course.slug}`} tabIndex={-1} aria-hidden className="block">
          <Thumb course={course} sizes="(min-width: 768px) 40vw, 90vw" />
        </Link>
        <div className="min-w-0 md:py-2 md:pr-2">
          <h3 className="display text-2xl text-white sm:text-3xl" style={{ ["--wdth" as string]: 84 }}>
            {course.title}
          </h3>
          {instructor && <p className="mt-2 text-sm text-white/70">{fullName(instructor)}</p>}

          <div className="mt-6 flex items-center gap-4">
            <ProgressRing value={progress.percent} size={56} stroke={5} className="text-shoal" />
            <div className="min-w-0 text-sm">
              {lessons && <p className="font-semibold text-white">{lessons}</p>}
              {progress.lastAccessedAt && <p className="text-white/65">Last opened {relativeTime(progress.lastAccessedAt)}</p>}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href={`/learn/${course.slug}`} variant="light" icon={<Play className="size-4" fill="currentColor" />}>
              {done ? "Review lessons" : started ? "Resume lesson" : "Start first lesson"}
            </ButtonLink>
            {done && certificateCode && (
              <Link href={`/certificates/${certificateCode}`} className="inline-flex items-center gap-2 text-sm font-semibold text-shoal underline-offset-4 hover:underline">
                <Award className="size-4" aria-hidden />
                View certificate
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EnrollmentCard({ enrollment, certificateCode }: { enrollment: Enrollment; certificateCode?: string }) {
  const { course, progress } = enrollment;
  const instructor = instructorOf(course);
  const done = progress.percent >= 100;
  const lessons = lessonsLine(enrollment);

  return (
    <article className="group relative flex h-full flex-col">
      <Thumb course={course} className="shadow-lift transition-shadow duration-300 group-hover:shadow-float" />
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <DepthGauge level={course.level} />
          {done && <Badge tone="reef">Completed</Badge>}
        </div>
        <h3 className="mt-2 text-lg font-bold leading-snug">
          <Link href={`/learn/${course.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:underline focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>
        {instructor && <p className="mt-1 text-sm text-ink-3">{fullName(instructor)}</p>}
        <div className="mt-auto pt-4">
          {done ? (
            certificateCode ? (
              <Link
                href={`/certificates/${certificateCode}`}
                className="relative z-10 inline-flex items-center gap-2 text-sm font-semibold text-channel underline-offset-4 hover:underline"
              >
                <Award className="size-4" aria-hidden />
                View certificate
              </Link>
            ) : (
              <p className="text-sm text-ink-3">All lessons complete</p>
            )
          ) : (
            <>
              <ProgressBar value={progress.percent} />
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold tabular-nums text-ink-2">{progress.percent}% complete</span>
                {lessons && <span className="tabular-nums text-ink-3">{lessons}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy aria-label="Loading your courses">
      <div className="grid gap-6 rounded-panel bg-ink/8 p-4 sm:p-6 md:grid-cols-2">
        <Skeleton className="aspect-[16/9] rounded-card" />
        <div className="space-y-3 py-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-11 w-40" />
        </div>
      </div>
      <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="aspect-[16/9] rounded-card" />
            <Skeleton className="mt-4 h-5 w-4/5" />
            <Skeleton className="mt-3 h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
