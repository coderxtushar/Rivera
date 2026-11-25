"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ComponentType, type ReactNode } from "react";
import { motion } from "motion/react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

/** Client-side gate: sends signed-out visitors to /signin and checks roles. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-ink-3">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          title="This area isn't part of your account"
          body={roles.includes("instructor") ? "Become an instructor to create and sell courses." : "You need admin access to open this page."}
          action={roles.includes("instructor") ? <ButtonLink href="/teach">Become an instructor</ButtonLink> : <ButtonLink href="/" variant="secondary">Go home</ButtonLink>}
        />
      </div>
    );
  }
  return <>{children}</>;
}

export interface ShellLink {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Match only the exact path (for index routes like /studio). */
  exact?: boolean;
}

/**
 * Two-column app layout: a sticky side nav (horizontal scroller on mobile) with a
 * gliding active marker, and the page content.
 */
export function AppShell({ title, links, children, footer }: { title: string; links: ShellLink[]; children: ReactNode; footer?: ReactNode }) {
  const pathname = usePathname();
  const isActive = (l: ShellLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8 lg:py-12">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 hidden px-3 text-sm font-bold text-ink-3 lg:block">{title}</p>
        <nav aria-label={title} className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:px-0">
          {links.map((l) => {
            const active = isActive(l);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-colors",
                  active ? "text-white" : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                )}
              >
                {active && <motion.span layoutId={`shell-${title}`} className="absolute inset-0 rounded-[12px] bg-ink" transition={{ type: "spring", stiffness: 450, damping: 38 }} />}
                <Icon className="relative size-4" />
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>
        {footer && <div className="mt-6 hidden lg:block">{footer}</div>}
      </aside>
      <main id="main" className="min-w-0">
        {children}
      </main>
    </div>
  );
}

/** Subtle entrance for page content inside app areas. */
export function PageFade({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
