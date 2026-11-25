import { cacheLife } from "next/cache";

/** Server-side reads of public API data (for metadata/SEO). Cached for a few minutes; never throws. */
const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");

export async function getPublic<T>(path: string): Promise<T | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
