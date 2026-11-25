"use client";

import { useId, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { Thumb } from "@/components/course/course-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { cn, fullName } from "@/lib/format";
import type { Enrollment, Paged, User } from "@/lib/types";
import { COURSE_STATUS, useDebounced, type AdminCourse } from "./shared";

/** Admin grant: pick a person and a course, then enroll them without payment. */
export function GrantAccessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const qc = useQueryClient();

  const close = () => {
    onClose();
    setUser(null);
    setCourse(null);
  };

  const grant = useMutation({
    mutationFn: () => api<{ data: { enrollment: Enrollment } }>("/admin/enrollments", { method: "POST", body: { userId: user!._id, courseId: course!._id } }),
    onSuccess: (res) => {
      const e = res.data.enrollment;
      const existing = e.source !== "admin_grant" || Date.now() - new Date(e.createdAt).getTime() > 60_000;
      const name = fullName(user) || user?.email;
      if (existing) toast.info(`${name} already had access to ${course?.title}`);
      else toast.success("Access granted");
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      close();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onClose={() => !grant.isPending && close()}
      title="Grant course access"
      description="Enroll someone in a course without payment. They get an email and the course shows up in their learning."
    >
      <div className="space-y-6">
        <Picker<User>
          label="Person"
          placeholder="Search by name or email"
          selected={user}
          onSelect={setUser}
          queryKey="users"
          fetch={(q) => api<Paged<User>>("/admin/users", { query: { q, limit: 6 } }).then((r) => r.data)}
          render={(u) => (
            <>
              <Avatar user={u} size={32} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{fullName(u) || u.email}</span>
                <span className="block truncate text-sm text-ink-3">{u.email}</span>
              </span>
            </>
          )}
        />
        <Picker<AdminCourse>
          label="Course"
          placeholder="Search by course title"
          selected={course}
          onSelect={setCourse}
          queryKey="courses"
          fetch={(q) => api<Paged<AdminCourse>>("/admin/courses", { query: { q, limit: 6 } }).then((r) => r.data)}
          render={(c) => (
            <>
              <Thumb course={c} sizes="64px" className="w-16 shrink-0 rounded-[8px]" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{c.title}</span>
                <span className="block truncate text-sm text-ink-3">
                  {c.status === "published" ? fullName(c.instructor) : `${COURSE_STATUS[c.status].label}, ${fullName(c.instructor)}`}
                </span>
              </span>
            </>
          )}
        />
      </div>

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={close} disabled={grant.isPending}>
          Cancel
        </Button>
        <Button onClick={() => grant.mutate()} disabled={!user || !course} loading={grant.isPending}>
          Grant access
        </Button>
      </div>
    </Dialog>
  );
}

function Picker<T extends { _id: string }>({
  label,
  placeholder,
  selected,
  onSelect,
  queryKey,
  fetch,
  render,
}: {
  label: string;
  placeholder: string;
  selected: T | null;
  onSelect: (v: T | null) => void;
  queryKey: string;
  fetch: (q: string) => Promise<T[]>;
  render: (item: T) => ReactNode;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const results = useQuery({
    queryKey: ["admin", queryKey, { q: search, picker: true }],
    queryFn: () => fetch(search),
    enabled: !selected,
  });

  if (selected) {
    return (
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink-2">{label}</p>
        <div className="flex items-center gap-3 rounded-control bg-white px-3 py-2.5 ring-2 ring-inset ring-channel">
          <span className="flex min-w-0 flex-1 items-center gap-3">{render(selected)}</span>
          <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
            Change<span className="sr-only"> {label.toLowerCase()}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-10" autoComplete="off" aria-controls={`${id}-results`} />
      </div>
      <ul id={`${id}-results`} aria-label={`${label} results`} className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {results.isPending ? (
          [0, 1, 2].map((i) => (
            <li key={i} className="px-3 py-2">
              <Skeleton className="h-8 w-full" />
            </li>
          ))
        ) : results.isError ? (
          <li className="px-3 py-2 text-sm text-[#b23417]">{errorMessage(results.error)}</li>
        ) : results.data.length === 0 ? (
          <li className="px-3 py-2 text-sm text-ink-3">Nothing matches &ldquo;{search}&rdquo;. Check the spelling or try fewer words.</li>
        ) : (
          results.data.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn("group flex w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-ink/5")}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">{render(item)}</span>
                <Check className="size-4 shrink-0 text-channel opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
