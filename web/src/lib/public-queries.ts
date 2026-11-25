"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Category, Course, CurriculumSection, Paged, Viewer } from "./types";

export interface ServerInfo {
  name: string;
  version: string;
  features: { payments: "mock" | "razorpay" | "stripe"; email: boolean; uploads: boolean };
}

export function useServerInfo() {
  return useQuery({ queryKey: ["public", "info"], queryFn: () => api<ServerInfo>(""), staleTime: Infinity });
}

export function useCategories() {
  return useQuery({
    queryKey: ["public", "categories"],
    queryFn: () => api<{ data: Category[] }>("/categories").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export type CourseQuery = Record<string, string | number | undefined>;

export function useCourses(query: CourseQuery, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["public", "courses", query],
    queryFn: () => api<Paged<Course>>("/courses", { query }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export interface CourseDetail {
  course: Course;
  curriculum: CurriculumSection[];
  viewer: Viewer | null;
}

/** Course page data. Keyed by the signed-in user too, because `viewer` depends on who's asking. */
export function useCourseDetail(slug: string, userId?: string) {
  return useQuery({
    queryKey: ["course", slug, userId ?? "anon"],
    queryFn: () => api<{ data: CourseDetail }>(`/courses/${encodeURIComponent(slug)}`).then((r) => r.data),
  });
}
