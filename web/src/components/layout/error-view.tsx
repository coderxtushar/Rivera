"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { Logo } from "@/components/brand/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/format";

/** Server errors carry a `digest` that matches the server log entry. */
function errorDigest(error: unknown): string | undefined {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string") return error.digest;
  return undefined;
}

/**
 * Shared fallback for `error.tsx` boundaries. "page" fills the screen (no site
 * header around it); "inline" sits inside a layout that already has one.
 */
export function ErrorView({ error, retry, variant = "inline" }: { error: unknown; retry: () => void; variant?: "page" | "inline" }) {
  const [retrying, setRetrying] = useState(false);
  const digest = errorDigest(error);
  const devMessage = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  const tryAgain = () => {
    setRetrying(true);
    retry();
    // If it fails again the boundary re-renders this view; re-enable the button.
    setTimeout(() => setRetrying(false), 1500);
  };

  return (
    <section
      role="alert"
      className={cn("grid place-items-center px-6 text-center", variant === "page" ? "min-h-dvh" : "min-h-[70vh] py-20")}
    >
      <title>Something went wrong | Rivera</title>
      <div className="max-w-md">
        {variant === "page" && <Logo className="mb-10" />}
        <p aria-hidden className="display text-[7rem] leading-none text-ink/10" style={{ ["--wdth" as string]: 150 }}>
          500
        </p>
        <h1 className="display -mt-6 text-3xl">Something went off course</h1>
        <p className="mx-auto mt-3 max-w-sm text-ink-3">
          This page hit an error while loading. Try again, or head back to the courses. Your purchases and progress are safe.
        </p>

        {devMessage && (
          <pre className="mx-auto mt-5 max-w-sm overflow-x-auto whitespace-pre-wrap rounded-control bg-ink/5 p-3 text-left text-xs text-ink-2">
            {devMessage}
          </pre>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={tryAgain} loading={retrying} icon={<RotateCw className="size-4" />}>
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
        </div>

        <p className="mt-8 text-sm text-ink-3">
          Keeps happening?{" "}
          <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">
            Contact us
          </Link>
          {digest ? (
            <>
              {" "}and quote error code <code className="rounded bg-ink/6 px-1.5 py-0.5 text-ink-2">{digest}</code>.
            </>
          ) : (
            "."
          )}
        </p>
      </div>
    </section>
  );
}
