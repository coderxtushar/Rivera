"use client";

import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { CourseCard } from "@/components/course/course-card";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { compact, fullName } from "@/lib/format";
import type { Course, PublicUser } from "@/lib/types";

interface Profile {
  user: PublicUser;
  courses: Course[];
  stats: { courses: number; students: number; reviews: number };
}

export function InstructorView({ id }: { id: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["public", "profile", id],
    queryFn: () => api<{ data: Profile }>(`/users/${encodeURIComponent(id)}/profile`).then((r) => r.data),
    retry: false,
  });

  if (isPending) return <Skeleton className="mx-auto my-16 h-64 max-w-5xl" />;
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <EmptyState title="Profile not found" body="This instructor may have closed their account." action={<ButtonLink href="/courses">Browse courses</ButtonLink>} />
      </div>
    );
  }

  const { user, courses, stats } = data;
  // Course cards expect a populated instructor; the profile endpoint returns ids.
  const cards = courses.map((c) => ({ ...c, instructor: user }));
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="grid gap-10 border-b border-line pb-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar user={user} size={112} className="ring-4 ring-foam" />
          <div>
            <h1 className="display text-4xl sm:text-5xl" style={{ ["--wdth" as string]: 104 }}>
              {fullName(user)}
            </h1>
            {user.headline && <p className="mt-2 text-lg text-ink-2">{user.headline}</p>}
            {user.website && (
              <a href={user.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-channel hover:underline">
                <Globe className="size-4" /> {user.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <dl className="flex gap-10">
          {[
            ["Courses", stats.courses],
            ["Students", stats.students],
            ["Reviews", stats.reviews],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-ink-3">{label}</dt>
              <dd className="display text-3xl tabular-nums" style={{ ["--wdth" as string]: 80 }}>
                {compact(value as number)}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {user.bio && <p className="mt-10 max-w-3xl text-lg leading-relaxed text-ink-2">{user.bio}</p>}

      <section className="mt-14">
        <h2 className="display text-2xl" style={{ ["--wdth" as string]: 90 }}>
          Courses by {user.firstName}
        </h2>
        {cards.length ? (
          <div className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <CourseCard key={c._id} course={c} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-ink-3">No published courses yet.</p>
        )}
      </section>
    </div>
  );
}
