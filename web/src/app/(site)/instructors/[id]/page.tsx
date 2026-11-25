import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublic } from "@/lib/server-api";
import type { PublicUser } from "@/lib/types";
import { InstructorView } from "./instructor-view";

export async function generateMetadata({ params }: PageProps<"/instructors/[id]">): Promise<Metadata> {
  const { id } = await params;
  const res = await getPublic<{ data: { user: PublicUser } }>(`/users/${encodeURIComponent(id)}/profile`);
  const u = res?.data.user;
  return u ? { title: `${u.firstName} ${u.lastName}`.trim(), description: u.headline || u.bio?.slice(0, 160) } : { title: "Instructor" };
}

async function FromParams({ params }: { params: PageProps<"/instructors/[id]">["params"] }) {
  const { id } = await params;
  return <InstructorView id={id} />;
}

export default function InstructorPage({ params }: PageProps<"/instructors/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <FromParams params={params} />
    </Suspense>
  );
}
