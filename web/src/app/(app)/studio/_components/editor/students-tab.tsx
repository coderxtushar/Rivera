"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { Avatar, Badge, EmptyState, Pagination, ProgressBar } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { cn, date, fullName, relativeTime } from "@/lib/format";
import type { Paged } from "@/lib/types";
import type { StudentRow } from "../lib";
import { ErrorState, RowsSkeleton } from "../ui";

export function StudentsTab({ courseId, published }: { courseId: string; published: boolean }) {
  const [page, setPage] = useState(1);
  const students = useQuery({
    queryKey: ["studio", "students", courseId, page],
    queryFn: () => api<Paged<StudentRow>>(`/courses/${courseId}/students`, { query: { page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });

  if (students.isPending) return <RowsSkeleton rows={4} />;
  if (students.isError) return <ErrorState message={errorMessage(students.error)} onRetry={() => students.refetch()} />;
  if (students.data.data.length === 0) {
    return (
      <EmptyState
        title="No students yet"
        body={published ? "When someone enrolls, they show up here with their progress." : "Publish the course to start taking enrollments. Students and their progress show up here."}
      />
    );
  }

  const { meta } = students.data;
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-3">{meta.total === 1 ? "1 student enrolled" : `${meta.total.toLocaleString("en-IN")} students enrolled`}</p>
      <ul className={cn("divide-y divide-line rounded-panel border border-line bg-foam transition-opacity", students.isPlaceholderData && "opacity-60")}>
        {students.data.data.map((s) => {
          const name = fullName(s.user) || "Deleted account";
          const pct = Math.round(s.progress?.percent ?? 0);
          return (
            <li key={s._id} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,14rem)_auto] sm:px-5">
              <Avatar user={s.user} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{name}</p>
                <p className="text-sm text-ink-3">
                  Joined <time dateTime={s.createdAt}>{date(s.createdAt)}</time>
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-3">{s.progress?.lastAccessedAt ? `Active ${relativeTime(s.progress.lastAccessedAt)}` : "Not started"}</span>
                  <span className="font-semibold tabular-nums text-ink-2">{pct}%</span>
                </div>
                <ProgressBar value={pct} className="mt-1.5" />
                <span className="sr-only">{`${name} has completed ${pct}% of the course`}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
                {s.progress?.completedAt ? (
                  <Badge tone="reef">
                    <CircleCheck className="size-3.5" aria-hidden />
                    Completed {date(s.progress.completedAt, { day: "numeric", month: "short" })}
                  </Badge>
                ) : (
                  <Badge>In progress</Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}
