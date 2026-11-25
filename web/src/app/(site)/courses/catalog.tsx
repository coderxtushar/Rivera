"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { DepthGauge } from "@/components/brand/brand";
import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { cn, plural } from "@/lib/format";
import { useCategories, useCourses } from "@/lib/public-queries";
import type { Level } from "@/lib/types";

const SORTS = [
  { value: "", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const LEVEL_OPTIONS: Level[] = ["beginner", "intermediate", "advanced"];
const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "true", label: "Free" },
  { value: "false", label: "Paid" },
];

function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = (k: string) => params.get(k) ?? "";
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  return { get, set, params };
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-bold text-ink">{label}</legend>
      {children}
    </fieldset>
  );
}

function Filters({ get, set }: ReturnType<typeof useFilters>) {
  const { data: categories } = useCategories();
  const radio = (name: string, value: string, label: ReactNode) => {
    const active = get(name) === value;
    return (
      <label key={value || "any"} className={cn("flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-sm transition-colors", active ? "bg-ink text-white" : "text-ink-2 hover:bg-ink/5")}>
        <input type="radio" name={name} className="sr-only" checked={active} onChange={() => set({ [name]: value })} />
        {label}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-8">
      <FilterGroup label="Topic">
        <div className="flex flex-col gap-0.5">
          {radio("category", "", "All topics")}
          {categories?.filter((c) => (c.courseCount ?? 0) > 0 || c.slug === get("category")).map((c) =>
            radio(
              "category",
              c.slug,
              <span className="flex w-full justify-between gap-2">
                <span>{c.name}</span>
                <span className="tabular-nums opacity-60">{c.courseCount}</span>
              </span>,
            ),
          )}
        </div>
      </FilterGroup>
      <FilterGroup label="Level">
        <div className="flex flex-col gap-0.5">
          {radio("level", "", "Any level")}
          {LEVEL_OPTIONS.map((l) => radio("level", l, <DepthGauge level={l} tone={get("level") === l ? "light" : "ink"} />))}
        </div>
      </FilterGroup>
      <FilterGroup label="Price">
        <div className="flex flex-col gap-0.5">{PRICE_OPTIONS.map((p) => radio("free", p.value, p.label))}</div>
      </FilterGroup>
      <FilterGroup label="Rating">
        <div className="flex flex-col gap-0.5">
          {radio("minRating", "", "Any rating")}
          {radio("minRating", "4", "4.0 and up")}
          {radio("minRating", "4.5", "4.5 and up")}
        </div>
      </FilterGroup>
    </div>
  );
}

export function Catalog() {
  const filters = useFilters();
  const { get, set } = filters;
  const [q, setQ] = useState(get("q"));
  const [sheet, setSheet] = useState(false);
  const { data: categories } = useCategories();

  // Debounce typing into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== get("q")) set({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = {
    q: get("q") || undefined,
    category: get("category") || undefined,
    level: get("level") || undefined,
    free: get("free") || undefined,
    minRating: get("minRating") || undefined,
    sort: get("sort") || undefined,
    page: get("page") || undefined,
    limit: 12,
  };
  const { data, isPending, isFetching, isError } = useCourses(query);

  const activeCategory = categories?.find((c) => c.slug === get("category"));
  const chips = [
    activeCategory && { key: "category", label: activeCategory.name },
    get("level") && { key: "level", label: get("level")[0].toUpperCase() + get("level").slice(1) },
    get("free") && { key: "free", label: get("free") === "true" ? "Free" : "Paid" },
    get("minRating") && { key: "minRating", label: `${get("minRating")}+ stars` },
    get("q") && { key: "q", label: `“${get("q")}”` },
  ].filter(Boolean) as { key: string; label: string }[];

  const title = activeCategory?.name ?? (get("q") ? "Search results" : "Browse courses");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <header className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="display text-4xl sm:text-5xl" style={{ ["--wdth" as string]: 100 }}>
            {title}
          </h1>
          <p className="mt-2 text-ink-3" aria-live="polite">
            {data ? plural(data.meta.total, "course") : " "}
            {activeCategory?.description ? <span className="hidden sm:inline">. {activeCategory.description}</span> : null}
          </p>
        </div>
        <div className="flex w-full gap-2 lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <label htmlFor="catalog-search" className="sr-only">
              Search courses
            </label>
            <input
              id="catalog-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search courses"
              className="h-11 w-full rounded-control bg-foam pl-10 pr-3 text-ink ring-1 ring-inset ring-line-strong placeholder:text-ink-3/80 focus:outline-none focus:ring-2 focus:ring-channel"
            />
          </div>
          <label htmlFor="catalog-sort" className="sr-only">
            Sort by
          </label>
          <div className="hidden w-52 shrink-0 sm:block">
            <Select id="catalog-sort" value={get("sort")} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" className="lg:hidden" onClick={() => setSheet(true)} icon={<SlidersHorizontal className="size-4" />}>
            Filters
          </Button>
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <Filters {...filters} />
        </aside>

        <section aria-label="Results" className="min-w-0">
          <AnimatePresence initial={false}>
            {chips.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  {chips.map((c) => (
                    <motion.button
                      layout
                      key={c.key}
                      onClick={() => (c.key === "q" ? (setQ(""), set({ q: "" })) : set({ [c.key]: "" }))}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white"
                    >
                      {c.label}
                      <X className="size-3.5" aria-label="Remove filter" />
                    </motion.button>
                  ))}
                  <button
                    onClick={() => {
                      setQ("");
                      set({ q: "", category: "", level: "", free: "", minRating: "" });
                    }}
                    className="px-2 text-sm font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
                  >
                    Clear all
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isError ? (
            <EmptyState title="Courses couldn't load" body="The course service isn't answering. Check your connection and try again in a moment." />
          ) : isPending ? (
            <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : data.data.length === 0 ? (
            <EmptyState
              title="No courses match"
              body="Try a broader search, or remove a filter or two."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    set({ q: "", category: "", level: "", free: "", minRating: "" });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <motion.ul layout className={cn("grid gap-x-8 gap-y-14 transition-opacity sm:grid-cols-2 xl:grid-cols-3", isFetching && "opacity-60")}>
              <AnimatePresence mode="popLayout" initial={false}>
                {data.data.map((c) => (
                  <motion.li
                    key={c._id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  >
                    <CourseCard course={c} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}

          <div className="mt-14">
            <Pagination
              meta={data?.meta}
              onPage={(p) => {
                set({ page: String(p) });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        </section>
      </div>

      <Dialog open={sheet} onClose={() => setSheet(false)} title="Filters" variant="sheet">
        <div className="mb-8">
          <label htmlFor="sheet-sort" className="mb-2.5 block text-sm font-bold">
            Sort by
          </label>
          <Select id="sheet-sort" value={get("sort")} onChange={(e) => set({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <Filters {...filters} />
        <Button className="mt-8 w-full" onClick={() => setSheet(false)}>
          Show {data ? plural(data.meta.total, "course") : "courses"}
        </Button>
      </Dialog>
    </div>
  );
}
