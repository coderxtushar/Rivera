import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { BUSINESS } from "../_components/legal";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  const rows = [
    BUSINESS.email && { icon: Mail, label: "Email", value: <a href={`mailto:${BUSINESS.email}`} className="text-channel underline underline-offset-4">{BUSINESS.email}</a> },
    BUSINESS.phone && { icon: Phone, label: "Phone", value: <a href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}>{BUSINESS.phone}</a> },
    BUSINESS.address && { icon: MapPin, label: "Address", value: <span className="whitespace-pre-line">{BUSINESS.address}</span> },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: React.ReactNode }[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="display text-4xl sm:text-5xl" style={{ ["--wdth" as string]: 100 }}>
        Contact us
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-2">
        Questions about a course, a payment or a refund? Get in touch with {BUSINESS.name} and we&apos;ll reply within 2 working days.
      </p>
      {rows.length > 0 ? (
        <dl className="mt-10 divide-y divide-line rounded-panel bg-foam ring-1 ring-line">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4 px-6 py-5">
              <Icon className="mt-0.5 size-5 text-ink-3" aria-hidden />
              <dt className="w-20 font-semibold">{label}</dt>
              <dd className="text-ink-2">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-10 text-ink-3">Contact details haven&apos;t been published yet.</p>
      )}
    </div>
  );
}
