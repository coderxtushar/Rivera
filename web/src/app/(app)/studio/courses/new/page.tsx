"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageTitle } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import type { Course, Level } from "@/lib/types";
import { CURRENCIES, LEVEL_OPTIONS, toMinor, useCategories } from "../../_components/lib";
import { Panel } from "../../_components/ui";

export default function NewCoursePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const categories = useCategories();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [level, setLevel] = useState<Level>("all");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ data: { course: Course } }>("/courses", { method: "POST", body }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["studio", "courses"] });
      qc.invalidateQueries({ queryKey: ["studio", "stats"] });
      toast.success("Course created");
      router.push(`/studio/courses/${res.data.course._id}`);
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(errorMessage(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 5) next.title = "Use at least 5 characters for the title.";
    const minor = toMinor(price);
    if (minor === null) next.price = "Enter an amount like 499 or 499.50.";
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate({ title: title.trim(), price: minor ?? 0, currency, level, ...(category ? { category } : {}) });
  };

  return (
    <PageFade>
      <Link href="/studio/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        All courses
      </Link>
      <PageTitle title="Create a course" sub="Start with the essentials. Everything here can change later, and the course stays a private draft until you publish it." />
      <Panel className="max-w-2xl">
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field label="Title" hint="What students will learn, in a few words. You can change it until the course is published." error={errors.title}>
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Practical SQL for analysts" autoFocus />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <Field label="Price" hint="Leave empty or enter 0 for a free course." error={errors.price}>
              {(p) => <Input {...p} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0" />}
            </Field>
            <Field label="Currency" error={errors.currency}>
              {(p) => (
                <Select {...p} value={currency} onChange={(e) => setCurrency(e.target.value)} className="sm:w-48">
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Level" error={errors.level}>
              {(p) => (
                <Select {...p} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                  {LEVEL_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Category" error={errors.category} hint={categories.isError ? "Categories didn't load. You can pick one later." : undefined}>
              {(p) => (
                <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)} disabled={categories.isPending}>
                  <option value="">{categories.isPending ? "Loading categories" : "No category yet"}</option>
                  {categories.data?.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => router.push("/studio/courses")}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create course
            </Button>
          </div>
        </form>
      </Panel>
    </PageFade>
  );
}
