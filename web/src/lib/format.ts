import type { Course, Level, PublicUser } from "./types";

/** Join class names, skipping any falsy value (false, null, undefined, 0, ""). */
export function cn(...parts: unknown[]) {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

/** Amounts are in minor units (paise/cents). */
export function money(amount: number, currency = "INR") {
  if (amount === 0) return "Free";
  const major = amount / 100;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(major) ? 0 : 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/** 4210 → "1h 10m", 300 → "5m", 45 → "45s" */
export function duration(sec: number) {
  if (!sec) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (m) return `${m}m`;
  return `${sec}s`;
}

export function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function date(value?: string | Date | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", opts).format(new Date(value));
}

export function relativeTime(value?: string) {
  if (!value) return "";
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "year";
  let div = 31557600;
  for (let i = 0; i < steps.length; i += 1) {
    if (diff < steps[i][0]) {
      unit = steps[i][1];
      div = i === 0 ? 1 : steps[i - 1][0];
      break;
    }
  }
  return rtf.format(-Math.round(diff / div), unit);
}

export function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

export function fullName(u?: Partial<Pick<PublicUser, "firstName" | "lastName">> | string | null) {
  if (!u || typeof u === "string") return "";
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}

export function initials(u?: Partial<Pick<PublicUser, "firstName" | "lastName">> | null) {
  return `${u?.firstName?.[0] ?? ""}${u?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export const LEVELS: Record<Level, { label: string; depth: number }> = {
  beginner: { label: "Beginner", depth: 1 },
  intermediate: { label: "Intermediate", depth: 2 },
  advanced: { label: "Advanced", depth: 3 },
  all: { label: "All levels", depth: 0 },
};

export function instructorOf(course: Pick<Course, "instructor">): PublicUser | null {
  return typeof course.instructor === "object" ? course.instructor : null;
}

/** Stable 0–359 hue from any string — used for generated course covers. */
export function hueFrom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}
