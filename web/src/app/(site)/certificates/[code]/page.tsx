import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublic } from "@/lib/server-api";
import type { Certificate } from "@/lib/types";
import { CertificateView } from "./certificate-view";

export async function generateMetadata({ params }: PageProps<"/certificates/[code]">): Promise<Metadata> {
  const { code } = await params;
  const res = await getPublic<{ data: { certificate: Certificate } }>(`/certificates/${encodeURIComponent(code)}`);
  const c = res?.data.certificate;
  if (!c) return { title: "Certificate" };
  return {
    title: `${c.studentName} completed ${c.courseTitle}`,
    description: `Verified Rivera certificate ${c.code}, issued to ${c.studentName}.`,
  };
}

async function FromParams({ params }: { params: PageProps<"/certificates/[code]">["params"] }) {
  const { code } = await params;
  return <CertificateView code={code} />;
}

export default function CertificatePage({ params }: PageProps<"/certificates/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <FromParams params={params} />
    </Suspense>
  );
}
