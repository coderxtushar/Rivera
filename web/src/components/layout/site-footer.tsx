import Link from "next/link";
import { Logo } from "@/components/brand/brand";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "Browse courses" },
      { href: "/courses?free=true", label: "Free courses" },
      { href: "/courses?sort=rating", label: "Top rated" },
      { href: "/dashboard", label: "My learning" },
    ],
  },
  {
    title: "Teach",
    links: [
      { href: "/teach", label: "Teach on Rivera" },
      { href: "/studio", label: "Instructor studio" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/settings", label: "Settings" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-night text-white/75">
      <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-24 w-full text-white/[0.06]">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M0 ${30 + i * 18} C 360 ${0 + i * 18}, 720 ${70 + i * 18}, 1080 ${30 + i * 18} S 1440 ${10 + i * 18}, 1440 ${30 + i * 18}`} fill="none" stroke="currentColor" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-10 pt-24 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Video courses from independent instructors. Watch the free lessons first, pay once, keep access for good.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-bold text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-shoal">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative mx-auto max-w-7xl border-t border-white/10 px-4 py-6 text-xs text-white/45 sm:px-6 lg:px-8">
        Rivera. Prices include applicable taxes.
      </div>
    </footer>
  );
}
