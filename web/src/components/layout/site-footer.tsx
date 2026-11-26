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
    title: "Help",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/refunds", label: "Refunds and cancellations" },
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
];

/** Shown in the footer's bottom bar. Update the year when you want a newer one. */
const COPYRIGHT = {
  year: 2026,
  owner: "Tushar Gautam",
  githubHandle: "coderxtushar",
  githubUrl: "https://github.com/coderxtushar",
};

/** GitHub's mark (lucide-react no longer ships brand icons). */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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
      <div className="relative mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-4 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          © {COPYRIGHT.year} {COPYRIGHT.owner}. All rights reserved. Prices include applicable taxes.
        </p>
        <a
          href={COPYRIGHT.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-full py-1 text-white/60 transition-colors hover:text-shoal sm:self-auto"
        >
          <GitHubMark className="size-4" />
          {COPYRIGHT.githubHandle} on GitHub
        </a>
      </div>
    </footer>
  );
}
