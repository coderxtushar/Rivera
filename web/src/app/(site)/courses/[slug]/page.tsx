import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublic } from "@/lib/server-api";
import type { Course } from "@/lib/types";
import { CourseView, CourseViewSkeleton } from "./course-view";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublic<{ data: { course: Course } }>(`/courses/${encodeURIComponent(slug)}`);
  const course = res?.data.course;
  if (!course) return { title: "Course" };
  return {
    title: course.title,
    description: course.subtitle || course.description.slice(0, 160),
    openGraph: { title: course.title, description: course.subtitle, images: course.thumbnailUrl ? [course.thumbnailUrl] : undefined },
  };
}

async function CourseFromParams({ params }: { params: PageProps<"/courses/[slug]">["params"] }) {
  const { slug } = await params;
  return <CourseView slug={slug} />;
}

export default function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  return (
    <Suspense fallback={<CourseViewSkeleton />}>
      <CourseFromParams params={params} />
    </Suspense>
  );
}
