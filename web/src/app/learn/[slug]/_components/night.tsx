import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/** Pulse block for dark surfaces (the shared Skeleton is tuned for mist). */
export function NightSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-white/8", className)} />;
}

/** Empty / error state for the dark player. */
export function NightState({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center", className)}>
      <svg aria-hidden viewBox="0 0 200 60" className="mb-6 w-40 text-shoal/50">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M0 ${20 + i * 12} C 40 ${8 + i * 12}, 60 ${34 + i * 12}, 100 ${20 + i * 12} S 160 ${8 + i * 12}, 200 ${20 + i * 12}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
      </svg>
      <h1 className="display text-2xl text-white" style={{ ["--wdth" as string]: 88 }}>
        {title}
      </h1>
      {body && <p className="mt-3 text-white/70">{body}</p>}
      {action && <div className="mt-7 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function PlayerSkeleton() {
  return (
    <div aria-busy aria-label="Loading course">
      <div className="flex h-14 items-center gap-4 border-b border-white/10 px-4">
        <NightSkeleton className="size-8 rounded-[9px]" />
        <NightSkeleton className="h-4 w-48" />
        <NightSkeleton className="ml-auto size-9 rounded-full" />
      </div>
      <div className="flex">
        <div className="hidden w-[340px] shrink-0 space-y-3 border-r border-white/10 p-5 lg:block">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <NightSkeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <NightSkeleton className="aspect-video w-full rounded-card" />
          <NightSkeleton className="mt-6 h-8 w-2/3" />
          <NightSkeleton className="mt-3 h-4 w-40" />
        </div>
      </div>
    </div>
  );
}
