import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/** One settings group: heading and short explanation on the left, controls on the right (stacked on mobile). */
export function SettingsPanel({
  id,
  title,
  description,
  children,
  tone = "default",
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid gap-6 rounded-panel border p-5 sm:p-7 xl:grid-cols-[220px_1fr] xl:gap-10",
        tone === "danger" ? "border-buoy/40 bg-buoy-wash/40" : "border-line bg-foam",
      )}
    >
      <div>
        <h2 id={id} className="display text-xl" style={{ ["--wdth" as string]: 90 }}>
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-ink-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
