"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { plural } from "@/lib/format";
import type { Category } from "@/lib/types";
import { ConfirmDialog, SectionHeading } from "../_components/shared";

const KEY = ["admin", "categories"] as const;
type Draft = { name: string; description: string };

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const list = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ data: Category[] }>("/categories").then((r) => r.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["public", "categories"] });
  };

  const remove = useMutation({
    mutationFn: (c: Category) => api(`/categories/${c._id}`, { method: "DELETE" }),
    onSuccess: (_r, c) => {
      toast.success("Category deleted");
      setDeleting(null);
      qc.setQueryData<Category[]>(KEY, (old) => old?.filter((x) => x._id !== c._id));
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const categories = list.data ?? [];

  return (
    <PageFade>
      <PageTitle title="Categories" sub="Instructors file courses under these, and learners browse the catalog by them." />

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="all-categories">
          <SectionHeading aside={list.data && <p className="text-sm text-ink-3 tabular-nums">{plural(categories.length, "category", "categories")}</p>}>
            <span id="all-categories">All categories</span>
          </SectionHeading>

          {list.isPending ? (
            <ul className="divide-y divide-line rounded-panel border border-line bg-foam" aria-busy="true" aria-label="Loading categories">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="space-y-2 px-5 py-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-72 max-w-full" />
                </li>
              ))}
            </ul>
          ) : list.isError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-buoy-wash px-5 py-4 text-[#8a2a14]">
              <p className="flex-1">Couldn&apos;t load categories. {errorMessage(list.error)}</p>
              <Button size="sm" variant="secondary" onClick={() => list.refetch()}>
                Try again
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <EmptyState title="No categories yet" body="Add the first one so instructors can file their courses and learners can browse by topic." />
          ) : (
            <ul className="divide-y divide-line rounded-panel border border-line bg-foam">
              <AnimatePresence initial={false}>
                {categories.map((c) => (
                  <motion.li
                    key={c._id}
                    layout="position"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    {editingId === c._id ? (
                      <EditRow category={c} onDone={() => setEditingId(null)} onSaved={refresh} />
                    ) : (
                      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4">
                        <div className="min-w-0 flex-1 basis-60">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <Link href={`/courses?category=${c.slug}`} className="font-semibold text-ink hover:text-channel hover:underline">
                              {c.name}
                            </Link>
                            <span className="font-mono text-xs text-ink-3">/{c.slug}</span>
                          </div>
                          {c.description ? <p className="mt-1 text-sm text-ink-2">{c.description}</p> : <p className="mt-1 text-sm text-ink-3">No description</p>}
                        </div>
                        <p className="text-sm text-ink-3 tabular-nums sm:pt-0.5">{plural(c.courseCount ?? 0, "published course")}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditingId(c._id)}>
                            Edit<span className="sr-only"> {c.name}</span>
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[#b23417]!" icon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(c)}>
                            Delete<span className="sr-only"> {c.name}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        <CreateCategory onCreated={refresh} />
      </div>

      <DeleteDialog category={deleting} loading={remove.isPending} onClose={() => !remove.isPending && setDeleting(null)} onConfirm={(c) => remove.mutate(c)} />
    </PageFade>
  );
}

function CreateCategory({ onCreated }: { onCreated: () => void }) {
  const [draft, setDraft] = useState<Draft>({ name: "", description: "" });
  const create = useMutation({
    mutationFn: (d: Draft) =>
      api<{ data: { category: Category } }>("/categories", { method: "POST", body: { name: d.name.trim(), description: d.description.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Category added");
      setDraft({ name: "", description: "" });
      onCreated();
    },
    onError: (err) => {
      if (!Object.keys(fieldErrors(err)).length) toast.error(errorMessage(err));
    },
  });
  const errors = fieldErrors(create.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(draft);
  };

  return (
    <section aria-labelledby="add-category" className="xl:sticky xl:top-24 xl:self-start">
      <SectionHeading>
        <span id="add-category">Add a category</span>
      </SectionHeading>
      <form onSubmit={submit} className="space-y-4 rounded-panel border border-line bg-foam p-5">
        <Field label="Name" error={errors.name} hint="2 to 60 characters. The web address is made from it.">
          {(p) => <Input {...p} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required minLength={2} maxLength={60} placeholder="Data science" />}
        </Field>
        <Field label="Description" error={errors.description} hint="Optional. Shown on the category's catalog page.">
          {(p) => (
            <Textarea {...p} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} className="min-h-24" />
          )}
        </Field>
        <Button type="submit" className="w-full" icon={<Plus className="size-4" />} loading={create.isPending} disabled={draft.name.trim().length < 2}>
          Add category
        </Button>
      </form>
    </section>
  );
}

function EditRow({ category, onDone, onSaved }: { category: Category; onDone: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>({ name: category.name, description: category.description ?? "" });
  const save = useMutation({
    mutationFn: (d: Draft) =>
      api<{ data: { category: Category } }>(`/categories/${category._id}`, { method: "PATCH", body: { name: d.name.trim(), description: d.description.trim() } }),
    onSuccess: () => {
      toast.success("Changes saved");
      onSaved();
      onDone();
    },
    onError: (err) => {
      if (!Object.keys(fieldErrors(err)).length) toast.error(errorMessage(err));
    },
  });
  const errors = fieldErrors(save.error);
  const unchanged = draft.name.trim() === category.name && draft.description.trim() === (category.description ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (unchanged) return onDone();
        save.mutate(draft);
      }}
      onKeyDown={(e) => e.key === "Escape" && !save.isPending && onDone()}
      className="space-y-4 bg-white px-5 py-4"
      aria-label={`Edit ${category.name}`}
    >
      <Field label="Name" error={errors.name} hint={draft.name.trim() !== category.name ? "Renaming changes the category's web address." : undefined}>
        {(p) => <Input {...p} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required minLength={2} maxLength={60} />}
      </Field>
      <Field label="Description" error={errors.description}>
        {(p) => <Textarea {...p} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} className="min-h-20" />}
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={save.isPending} disabled={draft.name.trim().length < 2}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function DeleteDialog({ category, loading, onClose, onConfirm }: { category: Category | null; loading: boolean; onClose: () => void; onConfirm: (c: Category) => void }) {
  // Keep the last category on screen while the dialog animates out.
  const [last, setLast] = useState<Category | null>(category);
  if (category && category !== last) setLast(category);
  const c = category ?? last;
  if (!c) return null;
  const count = c.courseCount ?? 0;

  return (
    <ConfirmDialog open={Boolean(category)} onClose={onClose} title={`Delete ${c.name}?`} confirmLabel="Delete category" danger loading={loading} onConfirm={() => onConfirm(c)}>
      <p>
        {count > 0
          ? `${plural(count, "published course")} ${count === 1 ? "is" : "are"} filed under it. Those courses, and any drafts in it, will have no category until their instructors pick a new one.`
          : "No published courses use it. Any drafts filed under it will have no category until their instructors pick a new one."}
      </p>
      <p>Its catalog page stops working. This can&apos;t be undone.</p>
    </ConfirmDialog>
  );
}
