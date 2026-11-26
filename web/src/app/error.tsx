"use client";

import { ErrorView } from "@/components/layout/error-view";

/** Catch-all for errors outside the site and app areas (sign-in pages, course player). */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} variant="page" />;
}
