"use client";

import Link from "next/link";
import { CourseCard, CourseCardSkeleton, Thumb, Price } from "@/components/course/course-card";
import { DepthGauge } from "@/components/brand/brand";
import { ButtonLink } from "@/components/ui/button";
import { Stars } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { duration, fullName, instructorOf, plural } from "@/lib/format";
import { useCourses } from "@/lib/public-queries";
import type { Course } from "@/lib/types";

function SectionHead({ title, sub, link }: { title: string; sub?: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="display text-3xl sm:text-4xl" style={{ ["--wdth" as string]: 96 }}>
          {title}
        </h2>
        {sub && <p className="mt-2 max-w-xl text-ink-3">{sub}</p>}
      </div>
      {link && (
        <Link href={link.href} className="text-sm font-semibold text-channel underline decoration-channel/30 underline-offset-4 hover:decoration-channel">
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** The lead course gets a wide, editorial treatment; the rest sit beside it. */
function LeadCourse({ course }: { course: Course }) {
  const instructor = instructorOf(course);
  return (
    <article className="group relative grid gap-6 lg:col-span-2 lg:grid-cols-[1.35fr_1fr] lg:items-end">
      <Thumb course={course} className="shadow-lift transition-shadow duration-300 group-hover:shadow-float" sizes="(min-width:1024px) 45vw, 90vw" />
      <div className="pb-1">
        <DepthGauge level={course.level} />
        <h3 className="display mt-3 text-3xl leading-tight" style={{ ["--wdth" as string]: 92 }}>
          <Link href={`/courses/${course.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>
        {course.subtitle && <p className="mt-3 text-ink-2">{course.subtitle}</p>}
        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-ink-3">Instructor</dt>
            <dd className="mt-0.5 font-semibold">{fullName(instructor)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Length</dt>
            <dd className="mt-0.5 font-semibold">{duration(course.stats.totalDurationSec)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Price</dt>
            <dd className="mt-0.5">
              <Price amount={course.price} currency={course.currency} />
            </dd>
          </div>
        </dl>
        {course.stats.ratingCount > 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Stars value={course.stats.ratingAvg} />
            <span className="font-semibold">{course.stats.ratingAvg.toFixed(1)}</span>
            <span className="text-ink-3">from {plural(course.stats.ratingCount, "review")}</span>
          </p>
        )}
      </div>
    </article>
  );
}

export function FeaturedCourses() {
  const featured = useCourses({ featured: "true", limit: 4 });
  const popular = useCourses({ sort: "popular", limit: 4 }, { enabled: featured.isSuccess && featured.data.data.length === 0 });
  const list = featured.data?.data.length ? featured.data.data : popular.data?.data;
  const loading = featured.isPending || (popular.isFetching && !list);

  if (!loading && !list?.length) return null;
  const [lead, ...rest] = list ?? [];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHead title="Good places to start" sub="Picked for clear teaching and well-structured lessons." link={{ href: "/courses?sort=popular", label: "See popular courses" }} />
      {loading ? (
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {lead && <LeadCourse course={lead} />}
          {rest.slice(0, 3).map((c) => (
            <CourseCard key={c._id} course={c} />
          ))}
        </div>
      )}
    </section>
  );
}

export function NewCourses() {
  const { data, isPending } = useCourses({ sort: "newest", limit: 6 });
  if (!isPending && !data?.data.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHead
        title="Just published"
        sub={data ? `${plural(data.meta.total, "course")} to choose from, and more every week.` : undefined}
        link={{ href: "/courses", label: "Browse all courses" }}
      />
      <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {isPending ? [0, 1, 2].map((i) => <CourseCardSkeleton key={i} />) : data?.data.map((c) => <CourseCard key={c._id} course={c} />)}
      </div>
    </section>
  );
}

/** The learner journey is a real sequence, so it's numbered and drawn as a channel with markers. */
const STEPS = [
  { title: "Watch the free lessons", body: "Every course marks its preview lessons. Watch them before you decide." },
  { title: "Enroll once", body: "Pay once, or nothing for free courses. No subscription, and the course stays in your library." },
  { title: "Learn at your pace", body: "Rivera remembers where you stopped and tracks every lesson you finish." },
  { title: "Earn a certificate", body: "Finish every lesson and get a certificate anyone can verify with its code." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHead title="How learning works here" />
      <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
        <svg aria-hidden viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute left-0 right-0 top-[18px] hidden h-10 w-full md:block">
          <path d="M0 20 C 120 0, 200 40, 330 20 S 560 0, 660 20 S 880 40, 1000 20" fill="none" className="stroke-reef/50" strokeWidth="2" strokeDasharray="6 8" vectorEffect="non-scaling-stroke" />
        </svg>
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="relative grid size-10 place-items-center rounded-full bg-ink font-bold text-white ring-8 ring-mist">{i + 1}</span>
            <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
            <p className="mt-2 text-ink-3">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TeachBand() {
  const { user } = useAuth();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";
  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-panel bg-night px-6 py-16 text-white sm:px-12 lg:py-20">
        <svg aria-hidden viewBox="0 0 600 400" className="absolute -right-24 -top-10 h-[130%] text-white/[0.07]">
          {Array.from({ length: 11 }, (_, i) => (
            <ellipse key={i} cx="380" cy="200" rx={40 + i * 26} ry={24 + i * 17} fill="none" stroke="currentColor" strokeWidth="1.5" transform={`rotate(${-12 + i} 380 200)`} />
          ))}
        </svg>
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <h2 className="display text-4xl sm:text-5xl" style={{ ["--wdth" as string]: 112 }}>
              Teach what you know
            </h2>
            <p className="mt-4 max-w-lg text-lg text-white/70">
              Build a course with sections and lessons, set your own price, run coupons, and watch your earnings month by month.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 lg:items-end">
            <ButtonLink href={isInstructor ? "/studio" : "/teach"} variant="light" size="lg">
              {isInstructor ? "Open instructor studio" : "Start teaching"}
            </ButtonLink>
            <p className="text-sm text-white/50">Free to start. You only pay a share when you sell.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
