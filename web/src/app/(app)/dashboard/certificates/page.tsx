"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Thumb } from "@/components/course/course-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import type { Certificate } from "@/lib/types";
import { QueryError } from "../_components/query-error";

export default function CertificatesPage() {
  const certificates = useQuery({
    queryKey: ["dashboard", "certificates"],
    queryFn: () => api<{ data: Certificate[] }>("/users/me/certificates"),
  });
  const items = certificates.data?.data ?? [];

  return (
    <PageFade>
      <PageTitle title="Certificates" sub="Finish every lesson in a course to earn one. Each has a public link anyone can use to check it." />

      {certificates.isPending ? (
        <div className="grid gap-6 sm:grid-cols-2" aria-busy aria-label="Loading certificates">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36 rounded-panel" />
          ))}
        </div>
      ) : certificates.isError ? (
        <QueryError
          title="We couldn't load your certificates"
          error={certificates.error}
          onRetry={() => certificates.refetch()}
          retrying={certificates.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          body="Complete all the lessons in a course and your certificate appears here."
          action={<ButtonLink href="/dashboard">Go to my learning</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {items.map((cert) => {
            const course = typeof cert.course === "object" && cert.course ? cert.course : null;
            return (
              <li key={cert.code}>
                <Link
                  href={`/certificates/${cert.code}`}
                  className="group flex h-full gap-4 rounded-panel border border-line bg-foam p-4 transition-colors hover:border-line-strong sm:p-5"
                >
                  <div className="relative w-28 shrink-0 sm:w-32">
                    {course ? (
                      <Thumb course={course} className="rounded-[12px]" sizes="128px" />
                    ) : (
                      <div className="grid aspect-[16/9] place-items-center rounded-[12px] bg-deep text-shoal">
                        <Award className="size-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold leading-snug text-ink group-hover:text-channel">{cert.courseTitle}</h2>
                    {cert.instructorName && <p className="mt-1 text-sm text-ink-3">Taught by {cert.instructorName}</p>}
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-ink-3">Issued</dt>
                      <dd className="tabular-nums text-ink-2">
                        <time dateTime={cert.issuedAt}>{date(cert.issuedAt)}</time>
                      </dd>
                      <dt className="text-ink-3">Code</dt>
                      <dd className="truncate font-mono text-xs leading-5 text-ink-2">{cert.code}</dd>
                    </dl>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageFade>
  );
}
