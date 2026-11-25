"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Category, Course, CourseStats, Level, OrderStatus, Paged, PublicUser } from "@/lib/types";

/* ----------------------------------------------------------------- shapes */

export interface InstructorStats {
  courses: { total: number; published: number };
  students: number;
  rating: { average: number; count: number };
  revenue: { currency: string; gross: number; earnings: number; sales: number }[];
  monthly: { month: string; currency: string; earnings: number; sales: number }[];
  perCourse: {
    course: { _id: string; title: string; slug: string; stats: CourseStats };
    earnings: number;
    sales: number;
    currency: string;
  }[];
}

export interface StudentRow {
  _id: string;
  user: Pick<PublicUser, "_id" | "firstName" | "lastName" | "avatarUrl"> | null;
  source: "free" | "purchase" | "admin_grant";
  pricePaid: number;
  currency: string;
  progress: { percent: number; completedAt?: string; lastAccessedAt?: string };
  createdAt: string;
}

export interface SaleRow {
  _id: string;
  course: string;
  courseTitle?: string;
  amount: number;
  currency: string;
  instructorEarning?: number;
  status: Extract<OrderStatus, "paid" | "refunded">;
  paidAt?: string;
  refundedAt?: string;
  couponCode?: string;
  user: Pick<PublicUser, "_id" | "firstName" | "lastName"> | null;
}

export interface ApiMeta {
  name: string;
  version: string;
  features: { payments: string; email: boolean; uploads: boolean };
}

export type StudioCourse = Omit<Course, "description" | "sections">;

/* ---------------------------------------------------------------- queries */

/** Server capabilities (uploads on/off). Rarely changes, so keep it for the session. */
export function useFeatures() {
  return useQuery({
    queryKey: ["studio", "features"],
    queryFn: () => api<ApiMeta>(""),
    staleTime: Infinity,
    select: (d) => d.features,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["studio", "categories"],
    queryFn: () => api<{ data: Category[] }>("/categories"),
    staleTime: 10 * 60_000,
    select: (d) => d.data,
  });
}

/** The instructor's own courses (first 50), for pickers such as the coupon course select. */
export function useMyCourses() {
  return useQuery({
    queryKey: ["studio", "courses", "all-for-picker"],
    queryFn: () => api<Paged<StudioCourse>>("/instructor/courses", { query: { limit: 50 } }),
    select: (d) => d.data,
  });
}

/* ------------------------------------------------------------------ money */

/** Like `money()`, but a zero amount reads as "₹0" rather than "Free" (earnings, payouts). */
export function amount(minor: number, currency = "INR") {
  if (minor !== 0) return money(minor, currency);
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", { style: "currency", currency, maximumFractionDigits: 0 }).format(0);
  } catch {
    return `0 ${currency}`;
  }
}

/** Compact currency for chart axes: ₹12K, $1.2M. */
export function compactMoney(minor: number, currency = "INR") {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(minor / 100);
  } catch {
    return `${minor / 100} ${currency}`;
  }
}

/** "499.50" → 49950. Returns null for anything that isn't a non-negative amount. */
export function toMinor(major: string): number | null {
  const trimmed = major.trim();
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

/** 49950 → "499.5", 49900 → "499" (for editing in an input). */
export function toMajor(minor: number) {
  return String(minor / 100);
}

export const CURRENCIES = [
  { value: "INR", label: "INR, Indian rupee" },
  { value: "USD", label: "USD, US dollar" },
  { value: "EUR", label: "EUR, Euro" },
  { value: "GBP", label: "GBP, British pound" },
];

export const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/* --------------------------------------------------------------- duration */

/** "12:30" → 750, "45" → 2700 (bare number = minutes), "1:02:03" → 3723. Null when invalid. */
export function parseClock(value: string): number | null {
  const v = value.trim();
  if (!v) return 0;
  if (/^\d+$/.test(v)) return Number(v) * 60;
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (s > 59 || (parts.length === 3 && m > 59)) return null;
  return h * 3600 + m * 60 + s;
}

/** 750 → "12:30". Minutes may exceed 59 ("75:00"). */
export function formatClock(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
