"use client";

import { ErrorView } from "@/components/layout/error-view";

/** Errors on public pages: shown inside the site layout, so the header stays usable. */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
