"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { CourseCover, DepthGauge } from "@/components/brand/brand";
import { Stars } from "@/components/ui/misc";
import { cn, compact, duration, fullName, instructorOf, money } from "@/lib/format";
import type { Course } from "@/lib/types";

export function Thumb({ course, className, sizes = "(min-width: 1024px) 30vw, 90vw" }: { course: Pick<Course, "_id" | "title" | "thumbnailUrl">; className?: string; sizes?: string }) {
  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden rounded-card bg-night", className)}>
      {course.thumbnailUrl ? (
        <Image src={course.thumbnailUrl} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <CourseCover seed={course._id} title={course.title} />
      )}
    </div>
  );
}

export function Price({ amount, currency, className }: { amount: number; currency: string; className?: string }) {
  return <span className={cn("font-bold tabular-nums", amount === 0 && "text-deep", className)}>{money(amount, currency)}</span>;
}

/**
 * Catalog card. No box around it: the cover carries the weight, the text sits
 * on the page. The cover lifts slightly on hover to show it's a link.
 */
export function CourseCard({ course, className, priority }: { course: Course; className?: string; priority?: boolean }) {
  const instructor = instructorOf(course);
  const { ratingAvg, ratingCount, enrollmentCount, totalDurationSec } = course.stats;
  return (
    <article className={cn("group relative flex flex-col", className)}>
      <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className="relative">
        <Thumb course={course} className="shadow-lift transition-shadow duration-300 group-hover:shadow-float" sizes={priority ? "50vw" : undefined} />
        {course.isFeatured && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-ink">Featured</span>}
      </motion.div>
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <DepthGauge level={course.level} />
          {totalDurationSec > 0 && <span className="text-xs text-ink-3">{duration(totalDurationSec)}</span>}
        </div>
        <h3 className="mt-2 text-lg font-bold leading-snug text-ink">
          <Link href={`/courses/${course.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            <span className="bg-[linear-gradient(var(--color-channel),var(--color-channel))] bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]">
              {course.title}
            </span>
          </Link>
        </h3>
        {instructor && <p className="mt-1 text-sm text-ink-3">{fullName(instructor)}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="flex items-center gap-3 text-sm text-ink-2">
            {ratingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold">{ratingAvg.toFixed(1)}</span>
                <Stars value={ratingAvg} size={12} />
                <span className="text-ink-3">({compact(ratingCount)})</span>
              </span>
            ) : (
              <span className="text-ink-3">New</span>
            )}
            {enrollmentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-ink-3">
                <Users className="size-3.5" aria-hidden />
                <span className="sr-only">Students:</span>
                {compact(enrollmentCount)}
              </span>
            )}
          </div>
          <Price amount={course.price} currency={course.currency} className="text-lg" />
        </div>
      </div>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="aspect-[16/9] animate-pulse rounded-card bg-ink/8" />
      <div className="mt-4 h-3 w-20 animate-pulse rounded bg-ink/8" />
      <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-ink/8" />
      <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-ink/8" />
    </div>
  );
}
