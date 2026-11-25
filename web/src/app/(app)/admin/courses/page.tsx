"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Thumb } from "@/components/course/course-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Badge, PageTitle, Pagination } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { cn, fullName } from "@/lib/format";
import type { CourseStatus, Paged } from "@/lib/types";
import { COURSE_STATUS, ConfirmDialog, FilterBar, PAGE_SIZE, SearchField, useDebounced, type AdminCourse } from "../_components/shared";
import { Cell, DataTable, RangeNote, Row, SkeletonRows, TableEmpty, TableError } from "../_components/table";

type Patch = { isFeatured?: boolean; status?: "published" | "archived" };

const COLUMNS = [
  { label: "Course" },
  { label: "Instructor" },
  { label: "Status" },
  { label: "Students", className: "text-right" },
  { label: "Rating" },
  { label: "Featured", className: "text-center" },
  { label: "Actions", srOnly: true, className: "text-right" },
];

export default function AdminCoursesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CourseStatus | "">("");
  const [page, setPage] = useState(1);
  const [archiving, setArchiving] = useState<AdminCourse | null>(null);
  const search = useDebounced(q.trim());
  const qc = useQueryClient();

  const key = ["admin", "courses", { q: search, status, page }] as const;
  const list = useQuery({
    queryKey: key,
    queryFn: () => api<Paged<AdminCourse>>("/admin/courses", { query: { q: search, status, page, limit: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: ({ course, patch }: { course: AdminCourse; patch: Patch; done: string }) =>
      api<{ data: { course: AdminCourse } }>(`/admin/courses/${course._id}`, { method: "PATCH", body: patch }),
    onMutate: async ({ course, patch }) => {
      // Featuring is optimistic so the star answers immediately.
      if (patch.isFeatured === undefined) return;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Paged<AdminCourse>>(key);
      qc.setQueryData<Paged<AdminCourse>>(key, (old) =>
        old ? { ...old, data: old.data.map((c) => (c._id === course._id ? { ...c, isFeatured: patch.isFeatured! } : c)) } : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(errorMessage(err));
    },
    onSuccess: (_res, { done }) => {
      toast.success(done);
      setArchiving(null);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
  const statusBusyId = update.isPending && update.variables?.patch.status ? update.variables.course._id : undefined;

  const rows = list.data?.data ?? [];
  const filtered = Boolean(search || status);

  return (
    <PageFade>
      <PageTitle title="Courses" sub="Every course on Rivera, in any state. Feature the best ones on the home page and take down courses that shouldn't be listed." />

      <FilterBar>
        <SearchField
          label="Search"
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Course title"
        />
        <Field label="Status">
          {(p) => (
            <Select
              {...p}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CourseStatus | "");
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          )}
        </Field>
      </FilterBar>

      <div className={cn("transition-opacity", list.isPlaceholderData && "opacity-60")}>
        <DataTable caption="Courses" columns={COLUMNS}>
          {list.isPending ? (
            <SkeletonRows columns={COLUMNS.length} />
          ) : list.isError ? (
            <TableError error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            filtered ? (
              <TableEmpty
                title="No courses match"
                body="Try another title or status."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQ("");
                      setStatus("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <TableEmpty title="No courses yet" body="Courses show up here as soon as an instructor starts a draft." />
            )
          ) : (
            rows.map((c) => {
              const st = COURSE_STATUS[c.status];
              const busy = statusBusyId === c._id;
              return (
                <Row key={c._id}>
                  <Cell lead>
                    <div className="flex min-w-0 items-center gap-3">
                      <Thumb course={c} sizes="96px" className="w-24 shrink-0 rounded-[10px]" />
                      <div className="min-w-0">
                        <Link href={`/courses/${c.slug}`} className="line-clamp-2 font-semibold text-ink hover:text-channel hover:underline">
                          {c.title}
                        </Link>
                        {c.subtitle && <p className="line-clamp-1 text-ink-3">{c.subtitle}</p>}
                      </div>
                    </div>
                  </Cell>
                  <Cell label="Instructor">
                    {c.instructor ? (
                      <span className="min-w-0 text-right md:text-left">
                        <span className="block text-ink">{fullName(c.instructor)}</span>
                        <span className="block break-all text-ink-3">{c.instructor.email}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">Deleted account</span>
                    )}
                  </Cell>
                  <Cell label="Status">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Cell>
                  <Cell label="Students" className="tabular-nums md:text-right">
                    {c.stats.enrollmentCount.toLocaleString("en-IN")}
                  </Cell>
                  <Cell label="Rating" className="whitespace-nowrap">
                    {c.stats.ratingCount ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Star className="size-4 text-[#f2a20c]" fill="currentColor" strokeWidth={0} aria-hidden />
                        <span className="font-semibold tabular-nums">{c.stats.ratingAvg.toFixed(1)}</span>
                        <span className="text-ink-3 tabular-nums">({c.stats.ratingCount.toLocaleString("en-IN")})</span>
                        <span className="sr-only">ratings</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">No ratings</span>
                    )}
                  </Cell>
                  <Cell label="Featured" className="md:text-center">
                    <FeatureToggle
                      featured={c.isFeatured}
                      title={c.title}
                      onToggle={() =>
                        update.mutate({ course: c, patch: { isFeatured: !c.isFeatured }, done: c.isFeatured ? "Course unfeatured" : "Course featured" })
                      }
                    />
                  </Cell>
                  <Cell actions>
                    <span className="flex flex-wrap gap-2 md:justify-end">
                      {c.status === "published" && (
                        <Button size="sm" variant="ghost" className="text-[#b23417]!" disabled={busy} onClick={() => setArchiving(c)}>
                          Archive course
                        </Button>
                      )}
                      {c.status === "archived" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy}
                          onClick={() => update.mutate({ course: c, patch: { status: "published" }, done: "Course republished" })}
                        >
                          Republish course
                        </Button>
                      )}
                      <ButtonLink href={`/courses/${c.slug}`} size="sm" variant="ghost">
                        View page<span className="sr-only"> for {c.title}</span>
                      </ButtonLink>
                    </span>
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </div>

      <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <RangeNote meta={list.data?.meta} />
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => !update.isPending && setArchiving(null)}
        title="Archive this course?"
        description={archiving?.title}
        confirmLabel="Archive course"
        danger
        loading={update.isPending}
        onConfirm={() => archiving && update.mutate({ course: archiving, patch: { status: "archived" }, done: "Course archived" })}
      >
        <p>It comes off the catalog and search, and nobody new can enroll. Students who already enrolled keep their access. You can republish it at any time.</p>
      </ConfirmDialog>
    </PageFade>
  );
}

/** Star toggle; it pops when switched on so the change registers. */
function FeatureToggle({ featured, title, onToggle }: { featured: boolean; title: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={featured}
      aria-label={featured ? `Unfeature ${title}` : `Feature ${title}`}
      title={featured ? "Remove from featured" : "Feature on the home page"}
      className="-m-1 grid size-10 place-items-center rounded-full hover:bg-ink/6"
    >
      <motion.span
        initial={false}
        animate={featured ? { scale: [1, 1.4, 1], rotate: [0, -18, 0] } : { scale: [1, 0.8, 1], rotate: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid place-items-center"
      >
        <Star className={cn("size-5 transition-colors", featured ? "text-[#f2a20c]" : "text-ink-3")} fill={featured ? "currentColor" : "none"} strokeWidth={featured ? 0 : 1.8} />
      </motion.span>
    </button>
  );
}
