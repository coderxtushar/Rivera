"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";

/** Shown when a list fails to load: says what happened and offers a retry. */
export function QueryError({ title, error, onRetry, retrying }: { title: string; error: unknown; onRetry: () => void; retrying?: boolean }) {
  return (
    <EmptyState
      title={title}
      body={errorMessage(error)}
      action={
        <Button variant="secondary" onClick={onRetry} loading={retrying} icon={<RotateCw className="size-4" />}>
          Try again
        </Button>
      }
    />
  );
}
