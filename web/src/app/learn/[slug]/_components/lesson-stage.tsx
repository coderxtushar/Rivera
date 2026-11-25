"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import { ExternalLink, FileText, Paperclip, PlayCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { duration } from "@/lib/format";
import type { Lesson } from "@/lib/types";
import { videoSource } from "@/lib/video";
import { NightSkeleton } from "./night";

const markdown: Components = {
  a: ({ href, title, children }) => {
    const external = Boolean(href && /^https?:\/\//.test(href));
    return (
      <a href={href} title={title} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  },
};

export function VideoFrame({ lesson }: { lesson: Pick<Lesson, "_id" | "title" | "videoUrl"> }) {
  const source = videoSource(lesson.videoUrl);
  return (
    <div className="relative aspect-video overflow-hidden rounded-card bg-black shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
      {source?.kind === "embed" ? (
        <iframe
          key={lesson._id}
          src={source.src}
          title={lesson.title}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : source?.kind === "file" ? (
        <video key={lesson._id} src={source.src} controls preload="metadata" playsInline className="absolute inset-0 size-full bg-black" aria-label={lesson.title}>
          Your browser can&apos;t play this video.{" "}
          <a href={source.src} className="underline">
            Download it instead
          </a>
          .
        </video>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <PlayCircle className="mx-auto size-10 text-white/30" aria-hidden />
            <p className="mt-3 font-semibold text-white/80">This lesson&apos;s video isn&apos;t available yet</p>
            <p className="mt-1 text-sm text-white/55">The instructor hasn&apos;t added it. Try the next lesson and come back later.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function LessonMeta({ lesson, sectionTitle }: { lesson: Pick<Lesson, "type" | "durationSec">; sectionTitle?: string }) {
  const Icon = lesson.type === "article" ? FileText : PlayCircle;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-4" aria-hidden />
        {lesson.type === "article" ? "Article" : "Video"}
      </span>
      {lesson.durationSec > 0 && <span className="tabular-nums">{duration(lesson.durationSec)}</span>}
      {sectionTitle && <span className="min-w-0 truncate">{sectionTitle}</span>}
    </div>
  );
}

/** Markdown body (article, or notes under a video). */
export function LessonContent({
  content,
  loading,
  error,
  onRetry,
  isArticle,
}: {
  content?: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  isArticle: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-8 max-w-[68ch] space-y-3" aria-busy aria-label="Loading lesson">
        <NightSkeleton className="h-4 w-full" />
        <NightSkeleton className="h-4 w-11/12" />
        <NightSkeleton className="h-4 w-4/5" />
        <NightSkeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-card bg-white/5 p-4 text-sm text-white/80 ring-1 ring-inset ring-white/10">
        <p className="flex-1">{errorMessage(error)}</p>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" icon={<RotateCw className="size-4" />} onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (!content?.trim()) {
    return isArticle ? <p className="mt-8 text-white/60">This lesson has no written content yet.</p> : null;
  }
  return (
    <div className={isArticle ? "mt-8" : "mt-10 border-t border-white/10 pt-8"}>
      {!isArticle && <h2 className="mb-4 text-lg font-bold text-white">Lesson notes</h2>}
      <div className="prose-rivera text-white/85 [&_a]:text-shoal [&_blockquote]:border-shoal [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white">
        <ReactMarkdown components={markdown}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

export function Resources({ resources }: { resources?: Lesson["resources"] }) {
  if (!resources?.length) return null;
  return (
    <section aria-labelledby="resources" className="mt-10">
      <h2 id="resources" className="text-lg font-bold text-white">
        Resources
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {resources.map((r) => (
          <li key={r.url + r.title}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-card bg-white/5 px-4 py-3 text-sm ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
            >
              <Paperclip className="size-4 shrink-0 text-shoal" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-semibold text-white">{r.title}</span>
              <ExternalLink className="size-4 shrink-0 text-white/40 group-hover:text-white/80" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
