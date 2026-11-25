/**
 * Browser API client. Calls go to this site's own /api/v1 (proxied to the
 * Rivera API by next.config.ts), so the httpOnly auth cookies just work.
 * An expired access token is refreshed once, transparently, then retried.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { path: string; message: string }[] | string[];

  constructor(status: number, code: string, message: string, details?: ApiError["details"]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Skip the automatic refresh-and-retry (used by auth endpoints themselves). */
  noRefresh?: boolean;
  signal?: AbortSignal;
}

const BASE = "/api/v1";

export function toQueryString(query?: Query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that hit an expired token. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

async function raw<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}${toQueryString(opts.query)}`, {
    method: opts.method || "GET",
    credentials: "include",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (res.ok) return json as T;

  const err = json?.error;
  throw new ApiError(
    res.status,
    err?.code || (res.status === 502 || res.status === 504 ? "API_UNREACHABLE" : "UNKNOWN"),
    err?.message || (res.status >= 500 ? "The server is not responding. Try again in a moment." : "Request failed"),
    err?.details,
  );
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await raw<T>(path, opts);
  } catch (err) {
    const expired = err instanceof ApiError && err.status === 401 && (err.code === "TOKEN_EXPIRED" || err.code === "UNAUTHORIZED");
    if (!expired || opts.noRefresh) throw err;
    if (!(await refreshSession())) throw err;
    return raw<T>(path, opts);
  }
}

/** Human message for any thrown error, including field-level validation details. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details) && err.details.length) {
      const first = err.details[0];
      return typeof first === "string" ? first : `${first.path ? `${first.path}: ` : ""}${first.message}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

/** Field errors keyed by path, for showing under form inputs. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return {};
  const out: Record<string, string> = {};
  for (const d of err.details) if (typeof d !== "string" && d.path) out[d.path] ??= d.message;
  return out;
}
