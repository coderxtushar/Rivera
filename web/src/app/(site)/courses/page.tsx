import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseCardSkeleton } from "@/components/course/course-card";
import { Catalog } from "./catalog";

export const metadata: Metadata = {
  title: "Browse courses",
  description: "Search video courses by topic, level and price. Every course has free preview lessons.",
};

export default function CoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-14 px-4 py-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <Catalog />
    </Suspense>
  );
}
