"use client";

import { ErrorView } from "@/components/layout/error-view";

/** Errors in signed-in areas (dashboard, studio, admin, settings), shown under the header. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
