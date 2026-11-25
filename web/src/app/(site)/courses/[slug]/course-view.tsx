"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Award, Check, ChevronDown, Clock, Globe, Heart, Infinity as InfinityIcon, ListVideo, PlayCircle, FileText, Tag, Users } from "lucide-react";
import { DepthGauge } from "@/components/brand/brand";
import { Price, Thumb } from "@/components/course/course-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Avatar, Collapse, EmptyState, Skeleton, Stars } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, compact, date, duration, fullName, instructorOf, money, plural } from "@/lib/format";
import { useCourseDetail, type CourseDetail } from "@/lib/public-queries";
import type { Course, CurriculumSection, Lesson, PageMeta, Quote, Review } from "@/lib/types";
import { videoSource } from "@/lib/video";
import { useCheckout } from "./checkout";

export function CourseViewSkeleton() {
  return (
    <div>
      <div className="bg-night px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-12 w-3/4 bg-white/10" />
          <Skeleton className="h-5 w-1/2 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export function CourseView({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth();
  const { data, isPending, error } = useCourseDetail(slug, authLoading ? undefined : user?._id);

  if (isPending) return <CourseViewSkeleton />;
  if (error || !data) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <EmptyState
          title={missing ? "This course isn't available" : "The course couldn't load"}
          body={missing ? "It may have been archived by its instructor, or the link is mistyped." : errorMessage(error)}
          action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
        />
      </div>
    );
  }
  return <CourseLoaded detail={data} />;
}

function CourseLoaded({ detail }: { detail: CourseDetail }) {
  const { course, curriculum } = detail;
  const instructor = instructorOf(course);
  const category = typeof course.category === "object" ? course.category : null;
  const { stats } = course;

  return (
    <>
      {/* Header band: deep water */}
      <section className="relative overflow-hidden bg-night text-white">
        <svg aria-hidden viewBox="0 0 1200 400" preserveAspectRatio="none" className="absolute inset-0 size-full text-white/[0.05]">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M-20 ${60 + i * 40} C 300 ${10 + i * 40}, 600 ${120 + i * 40}, 900 ${50 + i * 40} S 1220 ${20 + i * 40}, 1220 ${60 + i * 40}`} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8 lg:pb-20 lg:pt-14">
          <div className="max-w-3xl">
            <nav aria-label="Breadcrumb" className="flex flex-wrap gap-x-2 text-sm text-white/60">
              <Link href="/courses" className="hover:text-white">
                Courses
              </Link>
              {category && (
                <>
                  <span aria-hidden>/</span>
                  <Link href={`/courses?category=${category.slug}`} className="hover:text-white">
                    {category.name}
                  </Link>
                </>
              )}
            </nav>
            {course.status !== "published" && (
              <p className="mt-4 inline-block rounded-full bg-buoy px-3 py-1 text-xs font-bold text-white">
                {course.status === "draft" ? "Draft: only you can see this page" : "Archived: hidden from the catalog"}
              </p>
            )}
            <h1 className="display mt-4 text-4xl sm:text-5xl" style={{ ["--wdth" as string]: 96 }}>
              {course.title}
            </h1>
            {course.subtitle && <p className="mt-4 max-w-2xl text-lg text-white/75">{course.subtitle}</p>}

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              {stats.ratingCount > 0 ? (
                <a href="#reviews" className="flex items-center gap-2 hover:underline">
                  <span className="font-bold text-[#f8c15c]">{stats.ratingAvg.toFixed(1)}</span>
                  <Stars value={stats.ratingAvg} />
                  <span className="text-white/60">{plural(stats.ratingCount, "review")}</span>
                </a>
              ) : (
                <span className="text-white/60">No reviews yet</span>
              )}
              <span className="flex items-center gap-1.5 text-white/75">
                <Users className="size-4" aria-hidden />
                {plural(stats.enrollmentCount, "student")}
              </span>
              <DepthGauge level={course.level} tone="light" />
              <span className="flex items-center gap-1.5 text-white/75">
                <Globe className="size-4" aria-hidden />
                {course.language}
              </span>
            </div>

            {instructor && (
              <Link href={`/instructors/${instructor._id}`} className="mt-7 inline-flex items-center gap-3 rounded-full py-1 pl-1 pr-4 transition-colors hover:bg-white/8">
                <Avatar user={instructor} size={40} />
                <span>
                  <span className="block text-sm text-white/60">Taught by</span>
                  <span className="block font-semibold">{fullName(instructor)}</span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        {/* Purchase panel: overlaps the header band on desktop and stays in view */}
        <aside className="order-first -mt-6 lg:order-last lg:-mt-72">
          <div className="lg:sticky lg:top-24">
            <PurchasePanel detail={detail} />
          </div>
        </aside>

        <div className="min-w-0 space-y-16 py-4 lg:py-14">
          {course.outcomes.length > 0 && (
            <section aria-labelledby="learn-h">
              <h2 id="learn-h" className="display text-2xl" style={{ ["--wdth" as string]: 90 }}>
                What you&apos;ll learn
              </h2>
              <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-3 text-ink-2">
                    <Check className="mt-0.5 size-5 shrink-0 text-reef" aria-hidden />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Curriculum course={course} curriculum={curriculum} />

          {course.requirements.length > 0 && (
            <section aria-labelledby="req-h">
              <h2 id="req-h" className="display text-2xl" style={{ ["--wdth" as string]: 90 }}>
                Before you start
              </h2>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-ink-2 marker:text-reef">
                {course.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {course.description && (
            <section aria-labelledby="desc-h">
              <h2 id="desc-h" className="display text-2xl" style={{ ["--wdth" as string]: 90 }}>
                About this course
              </h2>
              <div className="prose-rivera mt-5 text-ink-2">
                <ReactMarkdown>{course.description}</ReactMarkdown>
              </div>
            </section>
          )}

          {instructor && (
            <section aria-labelledby="inst-h" className="rounded-panel bg-foam p-6 ring-1 ring-line sm:p-8">
              <h2 id="inst-h" className="text-sm font-bold text-ink-3">
                Your instructor
              </h2>
              <div className="mt-4 flex items-start gap-4">
                <Avatar user={instructor} size={64} />
                <div>
                  <Link href={`/instructors/${instructor._id}`} className="display text-xl hover:text-channel" style={{ ["--wdth" as string]: 92 }}>
                    {fullName(instructor)}
                  </Link>
                  {instructor.headline && <p className="text-ink-2">{instructor.headline}</p>}
                </div>
              </div>
              {instructor.bio && <p className="mt-4 max-w-2xl leading-relaxed text-ink-2">{instructor.bio}</p>}
            </section>
          )}

          <Reviews course={course} />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ purchase */

function PurchasePanel({ detail }: { detail: CourseDetail }) {
  const { course, viewer } = detail;
  const { user } = useAuth();
  const qc = useQueryClient();
  const { start, busy, mockDialog } = useCheckout(course);
  const [couponOpen, setCouponOpen] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [promo, setPromo] = useState(false);

  const applyCoupon = useMutation({
    mutationFn: () => api<{ data: Quote }>("/payments/quote", { method: "POST", body: { courseId: course._id, couponCode: code.trim() } }),
    onSuccess: (r) => {
      setQuote(r.data);
      toast.success(`Coupon applied: you save ${money(r.data.discount, r.data.currency)}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const wish = useMutation({
    mutationFn: (on: boolean) => api(`/users/me/wishlist/${course._id}`, { method: on ? "PUT" : "DELETE" }),
    onMutate: async (on) => {
      const key = ["course", course.slug, user?._id];
      qc.setQueryData<CourseDetail>(key, (d) => (d?.viewer ? { ...d, viewer: { ...d.viewer, isWishlisted: on } } : d));
    },
    onSuccess: (_r, on) => toast.success(on ? "Saved to your wishlist" : "Removed from your wishlist"),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["course", course.slug] }),
  });

  const promoSrc = videoSource(course.promoVideoUrl);
  const enrolled = viewer?.isEnrolled;
  const canManage = viewer?.canManage;
  const nextUrl = `/signin?next=${encodeURIComponent(`/courses/${course.slug}`)}`;
  const amount = quote?.amount ?? course.price;

  return (
    <div className="overflow-hidden rounded-panel bg-foam shadow-float ring-1 ring-line">
      <div className="relative">
        <Thumb course={course} className="rounded-none" sizes="380px" />
        {promoSrc && (
          <button onClick={() => setPromo(true)} className="group absolute inset-0 grid place-items-center bg-night/30 transition-colors hover:bg-night/45">
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-lift transition-transform group-hover:scale-105">
              <PlayCircle className="size-5 text-channel" /> Watch the trailer
            </span>
          </button>
        )}
      </div>

      <div className="p-6">
        {enrolled ? (
          <>
            <p className="text-sm font-semibold text-deep">You&apos;re enrolled</p>
            {viewer?.progress && (
              <div className="mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-3">Progress</span>
                  <span className="font-bold tabular-nums">{viewer.progress.percent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-reef" style={{ width: `${viewer.progress.percent}%` }} />
                </div>
              </div>
            )}
            <ButtonLink href={`/learn/${course.slug}`} size="lg" className="mt-5 w-full">
              {viewer?.progress?.percent ? "Continue learning" : "Start learning"}
            </ButtonLink>
          </>
        ) : canManage ? (
          <>
            <Price amount={course.price} currency={course.currency} className="display text-3xl" />
            <p className="mt-2 text-sm text-ink-3">This is your course.</p>
            <ButtonLink href={`/studio/courses/${course._id}`} size="lg" className="mt-5 w-full">
              Edit in studio
            </ButtonLink>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={amount} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="display text-4xl" style={{ ["--wdth" as string]: 90 }}>
                  {money(amount, course.currency)}
                </motion.span>
              </AnimatePresence>
              {quote && quote.discount > 0 && <span className="text-ink-3 line-through">{money(quote.originalAmount, course.currency)}</span>}
            </div>
            {quote?.coupon && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-buoy-wash px-2.5 py-0.5 text-xs font-bold text-[#b23417]">
                <Tag className="size-3" /> {quote.coupon.code} applied
              </p>
            )}

            {user ? (
              <Button size="lg" className="mt-5 w-full" loading={busy} onClick={() => start(quote?.coupon?.code)}>
                {course.price === 0 ? "Enroll for free" : amount === 0 ? "Enroll with coupon" : "Buy now"}
              </Button>
            ) : (
              <ButtonLink href={nextUrl} size="lg" className="mt-5 w-full">
                {course.price === 0 ? "Sign in to enroll for free" : "Sign in to buy"}
              </ButtonLink>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              {user && course.price > 0 && (
                <button onClick={() => setCouponOpen((v) => !v)} aria-expanded={couponOpen} className="text-sm font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
                  Have a coupon?
                </button>
              )}
              {user && viewer && (
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => wish.mutate(!viewer.isWishlisted)}
                  aria-pressed={viewer.isWishlisted}
                  className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-ink-2 hover:bg-ink/5"
                >
                  <motion.span key={String(viewer.isWishlisted)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 15 }}>
                    <Heart className={cn("size-4", viewer.isWishlisted && "fill-buoy text-buoy")} />
                  </motion.span>
                  {viewer.isWishlisted ? "Saved" : "Save"}
                </motion.button>
              )}
            </div>
            <Collapse open={couponOpen}>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) applyCoupon.mutate();
                }}
              >
                <label htmlFor="coupon" className="sr-only">
                  Coupon code
                </label>
                <Input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="uppercase" />
                <Button type="submit" variant="secondary" loading={applyCoupon.isPending}>
                  Apply
                </Button>
              </form>
            </Collapse>
          </>
        )}

        <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm text-ink-2">
          <li className="flex items-center gap-3">
            <ListVideo className="size-4 text-ink-3" /> {plural(course.stats.lessonCount, "lesson")}
          </li>
          <li className="flex items-center gap-3">
            <Clock className="size-4 text-ink-3" /> {duration(course.stats.totalDurationSec)} of content
          </li>
          <li className="flex items-center gap-3">
            <InfinityIcon className="size-4 text-ink-3" /> Yours to keep after you enroll
          </li>
          <li className="flex items-center gap-3">
            <Award className="size-4 text-ink-3" /> Certificate when you finish
          </li>
        </ul>
      </div>

      {promoSrc && (
        <Dialog open={promo} onClose={() => setPromo(false)} title={course.title} className="max-w-3xl">
          <VideoFrame src={promoSrc} title={`Trailer for ${course.title}`} />
        </Dialog>
      )}
      {mockDialog}
    </div>
  );
}

function VideoFrame({ src, title }: { src: NonNullable<ReturnType<typeof videoSource>>; title: string }) {
  return (
    <div className="aspect-video overflow-hidden rounded-card bg-night">
      {src.kind === "embed" ? (
        <iframe src={src.src} title={title} className="size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <video src={src.src} controls className="size-full" />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- curriculum */

function Curriculum({ course, curriculum }: { course: Course; curriculum: CurriculumSection[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(curriculum.slice(0, 1).map((s) => s._id)));
  const [preview, setPreview] = useState<Lesson | null>(null);
  const allOpen = open.size === curriculum.length;
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="content-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="content-h" className="display text-2xl" style={{ ["--wdth" as string]: 90 }}>
            Course content
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            {plural(curriculum.length, "section")}, {plural(course.stats.lessonCount, "lesson")}, {duration(course.stats.totalDurationSec)} in total
          </p>
        </div>
        {curriculum.length > 1 && (
          <button onClick={() => setOpen(allOpen ? new Set() : new Set(curriculum.map((s) => s._id)))} className="text-sm font-semibold text-channel hover:underline">
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      <div className="mt-6 divide-y divide-line overflow-hidden rounded-panel ring-1 ring-line">
        {curriculum.map((s) => {
          const isOpen = open.has(s._id);
          const secDuration = s.lessons.reduce((a, l) => a + l.durationSec, 0);
          return (
            <div key={s._id} className="bg-foam">
              <button onClick={() => toggle(s._id)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white">
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="text-ink-3">
                  <ChevronDown className="size-5" />
                </motion.span>
                <span className="flex-1 font-bold">{s.title}</span>
                <span className="text-sm text-ink-3">
                  {plural(s.lessons.length, "lesson")}
                  <span className="hidden sm:inline">, {duration(secDuration)}</span>
                </span>
              </button>
              <Collapse open={isOpen}>
                <ul className="border-t border-line bg-white/50 py-1">
                  {s.lessons.map((l) => (
                    <li key={l._id} className="flex items-center gap-3 px-5 py-2.5 pl-14 text-sm">
                      {l.type === "article" ? <FileText className="size-4 text-ink-3" aria-hidden /> : <PlayCircle className="size-4 text-ink-3" aria-hidden />}
                      <span className="flex-1 text-ink-2">{l.title}</span>
                      {l.isPreview && (
                        <button onClick={() => setPreview(l)} className="rounded-full bg-channel-wash px-2.5 py-0.5 text-xs font-bold text-channel-deep hover:bg-channel hover:text-white">
                          Preview
                        </button>
                      )}
                      <span className="w-12 text-right tabular-nums text-ink-3">{l.durationSec ? duration(l.durationSec) : ""}</span>
                    </li>
                  ))}
                  {s.lessons.length === 0 && <li className="px-5 py-3 pl-14 text-sm text-ink-3">Lessons coming soon</li>}
                </ul>
              </Collapse>
            </div>
          );
        })}
      </div>
      <PreviewDialog course={course} lesson={preview} onClose={() => setPreview(null)} />
    </section>
  );
}

function PreviewDialog({ course, lesson, onClose }: { course: Course; lesson: Lesson | null; onClose: () => void }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["preview", course._id, lesson?._id],
    queryFn: () => api<{ data: { lesson: Lesson } }>(`/courses/${course._id}/lessons/${lesson!._id}`).then((r) => r.data.lesson),
    enabled: Boolean(lesson),
  });
  const src = videoSource(data?.videoUrl);
  return (
    <Dialog open={Boolean(lesson)} onClose={onClose} title={lesson?.title ?? ""} description="Free preview" className="max-w-3xl">
      {isPending ? (
        <Skeleton className="aspect-video w-full" />
      ) : error ? (
        <p className="text-ink-3">{errorMessage(error)}</p>
      ) : (
        <div className="space-y-5">
          {src && <VideoFrame src={src} title={data?.title ?? "Lesson"} />}
          {data?.content && (
            <div className="prose-rivera text-ink-2">
              <ReactMarkdown>{data.content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------- reviews */

function Reviews({ course }: { course: Course }) {
  const [page, setPage] = useState(1);
  const { data, isPending } = useQuery({
    queryKey: ["public", "reviews", course._id, page],
    queryFn: () =>
      api<{ data: Review[]; meta: PageMeta & { ratingAvg: number; ratingCount: number; distribution: Record<string, number> } }>(`/courses/${course._id}/reviews`, {
        query: { page, limit: 6 },
      }),
  });
  const [items, setItems] = useState<Review[]>([]);
  const [seen, setSeen] = useState(0);
  if (data && seen !== page) {
    setItems((prev) => (page === 1 ? data.data : [...prev, ...data.data.filter((r) => !prev.some((p) => p._id === r._id))]));
    setSeen(page);
  }

  const meta = data?.meta;
  return (
    <section id="reviews" aria-labelledby="rev-h" className="scroll-mt-24">
      <h2 id="rev-h" className="display text-2xl" style={{ ["--wdth" as string]: 90 }}>
        What students say
      </h2>
      {isPending && !meta ? (
        <Skeleton className="mt-6 h-32 w-full" />
      ) : !meta?.ratingCount ? (
        <p className="mt-4 text-ink-3">No reviews yet. Students can review a course once they&apos;ve enrolled.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
            <div>
              <p className="display text-6xl leading-none" style={{ ["--wdth" as string]: 80 }}>
                {meta.ratingAvg.toFixed(1)}
              </p>
              <Stars value={meta.ratingAvg} size={16} className="mt-2" />
              <p className="mt-1 text-sm text-ink-3">{plural(meta.ratingCount, "review")}</p>
            </div>
            <ul className="space-y-1.5" aria-label="Rating distribution">
              {[5, 4, 3, 2, 1].map((r) => {
                const count = meta.distribution[r] ?? 0;
                const pct = meta.ratingCount ? (count / meta.ratingCount) * 100 : 0;
                return (
                  <li key={r} className="flex items-center gap-3 text-sm">
                    <span className="w-14 text-ink-3">{r} stars</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                      <motion.div className="h-full rounded-full bg-[#f2a20c]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-ink-3">{compact(count)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {items.map((r) => {
              const author = typeof r.user === "object" ? r.user : null;
              return (
                <li key={r._id} className="border-t border-line pt-5">
                  <div className="flex items-center gap-3">
                    <Avatar user={author} size={36} />
                    <div>
                      <p className="font-semibold">{fullName(author) || "Student"}</p>
                      <p className="flex items-center gap-2 text-xs text-ink-3">
                        <Stars value={r.rating} size={11} />
                        {date(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  {r.comment && <p className="mt-3 leading-relaxed text-ink-2">{r.comment}</p>}
                  {r.instructorReply?.text && (
                    <div className="mt-3 border-l-2 border-reef pl-4 text-sm">
                      <p className="font-semibold text-deep">Instructor reply</p>
                      <p className="mt-1 text-ink-2">{r.instructorReply.text}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {meta.page < meta.totalPages && (
            <Button variant="secondary" className="mt-8" onClick={() => setPage((p) => p + 1)}>
              Show more reviews
            </Button>
          )}
        </>
      )}
    </section>
  );
}
