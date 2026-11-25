"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Layers, Tag, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const POINTS = [
  { icon: Layers, title: "Build it your way", body: "Sections and lessons you can drag into order. Video, written lessons, downloadable resources, and free previews." },
  { icon: Tag, title: "Set your price", body: "Charge what your course is worth or make it free. Create coupon codes for launches and communities." },
  { icon: Users, title: "Know your students", body: "See who enrolled, how far each student has got, and reply to their reviews in public." },
  { icon: BarChart3, title: "Watch it grow", body: "Earnings by month and by course, with every sale listed." },
];

export default function TeachPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const become = async () => {
    setBusy(true);
    try {
      const res = await api<{ data: { user: { role: string; instructorStatus: string } } }>("/users/me/become-instructor", { method: "POST", body: {} });
      await refresh();
      if (res.data.user.role === "instructor") {
        toast.success("You're an instructor now. Create your first course.");
        router.push("/studio/courses/new");
      } else {
        toast.info("Application sent. We'll review it shortly.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cta = !user ? (
    <ButtonLink href="/signup?next=/teach" size="lg">
      Create an account to start
    </ButtonLink>
  ) : user.role === "instructor" || user.role === "admin" ? (
    <ButtonLink href="/studio" size="lg">
      Open instructor studio
    </ButtonLink>
  ) : user.instructorStatus === "pending" ? (
    <p className="rounded-card bg-foam px-5 py-4 font-semibold text-ink-2 ring-1 ring-line">Your application is being reviewed. We&apos;ll email you when it&apos;s approved.</p>
  ) : (
    <Button size="lg" loading={busy} onClick={become}>
      Become an instructor
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <section className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <h1 className="display text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[0.95]" style={{ ["--wdth" as string]: 118 }}>
          Turn what you know into a course people finish
        </h1>
        <div>
          <p className="text-lg text-ink-2">
            Rivera gives independent instructors the whole toolkit: a course builder, checkout, coupons, progress tracking, certificates and an earnings dashboard. It&apos;s free to start; Rivera takes a share only when you sell.
          </p>
          <div className="mt-8">{cta}</div>
        </div>
      </section>

      <section className="mt-24 grid gap-x-10 gap-y-12 border-t border-line pt-14 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <Icon className="size-6 text-channel" />
            <h2 className="mt-4 text-lg font-bold">{title}</h2>
            <p className="mt-2 text-ink-3">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
