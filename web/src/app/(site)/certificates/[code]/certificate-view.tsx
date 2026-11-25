"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BadgeCheck, Link2, Printer } from "lucide-react";
import { Logo } from "@/components/brand/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import type { Certificate } from "@/lib/types";

export function CertificateView({ code }: { code: string }) {
  const { data: cert, isPending, isError } = useQuery({
    queryKey: ["public", "certificate", code],
    queryFn: () => api<{ data: { certificate: Certificate } }>(`/certificates/${encodeURIComponent(code)}`).then((r) => r.data.certificate),
    retry: false,
  });

  if (isPending) return <Skeleton className="mx-auto my-16 aspect-[1.414] max-w-4xl" />;
  if (isError || !cert) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <EmptyState
          title="No certificate with this code"
          body={`We couldn't verify ${code.toUpperCase()}. Check the code for typos; certificates also disappear if a purchase is refunded.`}
          action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
        />
      </div>
    );
  }

  const courseSlug = typeof cert.course === "object" ? cert.course.slug : undefined;
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="flex items-center gap-2 font-semibold text-deep">
          <BadgeCheck className="size-5" /> Verified certificate
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Link2 className="size-4" />} onClick={copy}>
            Copy link
          </Button>
          <Button variant="secondary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 16, rotateX: 6 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-[1.414] overflow-hidden rounded-panel bg-foam shadow-float ring-1 ring-line print:rounded-none print:shadow-none"
        style={{ transformPerspective: 1200 }}
      >
        {/* Contour border: the certificate sits on a chart */}
        <svg aria-hidden viewBox="0 0 1414 1000" preserveAspectRatio="none" className="absolute inset-0 size-full">
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={22 + i * 9} y={22 + i * 9} width={1414 - 44 - i * 18} height={1000 - 44 - i * 18} rx={28 - i * 2} fill="none" className={i === 2 ? "stroke-channel" : "stroke-reef/35"} strokeWidth={i === 2 ? 2 : 1} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`c${i}`} d={`M900 ${1000 - i * 26} C 1050 ${880 - i * 30}, 1200 ${960 - i * 22}, 1414 ${820 - i * 30}`} fill="none" className="stroke-shoal/50" strokeWidth="1.2" />
          ))}
        </svg>

        <div className="relative flex h-full flex-col px-[8%] py-[7%]">
          <Logo />
          <div className="my-auto">
            <p className="text-sm font-semibold text-ink-3 sm:text-base">Certificate of completion</p>
            <h1 className="display mt-3 text-[clamp(1.8rem,5.6vw,4.2rem)] leading-[0.95]" style={{ ["--wdth" as string]: 118 }}>
              {cert.studentName}
            </h1>
            <p className="mt-4 max-w-[46ch] text-sm text-ink-2 sm:text-lg">
              has completed every lesson of <strong className="text-ink">{cert.courseTitle}</strong>
              {cert.instructorName ? <>, taught by {cert.instructorName}</> : null}.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs sm:text-sm">
            <div>
              <dt className="text-ink-3">Issued</dt>
              <dd className="font-semibold">{date(cert.issuedAt, { day: "numeric", month: "long", year: "numeric" })}</dd>
            </div>
            <div className="text-right">
              <dt className="text-ink-3">Verification code</dt>
              <dd className="font-semibold tabular-nums">{cert.code}</dd>
            </div>
          </dl>
        </div>
      </motion.article>

      {courseSlug && (
        <p className="mt-8 text-center text-ink-3 print:hidden">
          Want to take this course too?{" "}
          <a href={`/courses/${courseSlug}`} className="font-semibold text-channel underline underline-offset-4">
            See the course
          </a>
        </p>
      )}
    </div>
  );
}
