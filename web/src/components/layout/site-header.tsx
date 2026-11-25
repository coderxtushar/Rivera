"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { BookOpen, ChevronDown, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, Shield, X } from "lucide-react";
import { Logo } from "@/components/brand/brand";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { cn, fullName } from "@/lib/format";

const NAV = [
  { href: "/courses", label: "Browse courses" },
  { href: "/teach", label: "Teach on Rivera" },
];

function useMenuLinks() {
  const { user } = useAuth();
  if (!user) return [];
  return [
    { href: "/dashboard", label: "My learning", icon: BookOpen },
    ...(user.role === "instructor" || user.role === "admin" ? [{ href: "/studio", label: "Instructor studio", icon: LayoutDashboard }] : []),
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
    { href: "/settings", label: "Settings", icon: Settings },
  ];
}

export function SiteHeader({ tone = "mist" }: { tone?: "mist" | "clear" }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const links = useMenuLinks();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation (reset-on-change during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const doSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background,box-shadow] duration-300",
        scrolled || tone === "mist" ? "bg-mist/85 backdrop-blur-md" : "bg-transparent",
        scrolled && "shadow-[0_1px_0_var(--color-line)]",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors", active ? "text-ink" : "text-ink-2 hover:text-ink")}
              >
                {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-full bg-ink/7" />}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <span className="size-9 animate-pulse rounded-full bg-ink/8" />
          ) : user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-ink/6"
              >
                <Avatar user={user} size={34} />
                <span className="hidden text-sm font-semibold sm:inline">{user.firstName}</span>
                <ChevronDown className={cn("size-4 text-ink-3 transition-transform", menuOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-card bg-foam p-1.5 shadow-float ring-1 ring-line"
                  >
                    <div className="px-3 pb-2.5 pt-2">
                      <p className="truncate font-semibold">{fullName(user)}</p>
                      <p className="truncate text-sm text-ink-3">{user.email}</p>
                    </div>
                    <div className="h-px bg-line" />
                    <div className="py-1">
                      {links.map(({ href, label, icon: Icon }) => (
                        <Link key={href} role="menuitem" href={href} className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-ink-2 hover:bg-ink/6 hover:text-ink">
                          <Icon className="size-4" />
                          {label}
                        </Link>
                      ))}
                    </div>
                    <div className="h-px bg-line" />
                    <button role="menuitem" onClick={doSignOut} className="mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-ink-2 hover:bg-ink/6 hover:text-ink">
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link href={`/signin?next=${encodeURIComponent(pathname)}`} className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-ink-2 hover:text-ink sm:block">
                Sign in
              </Link>
              <ButtonLink href="/signup" size="sm" className="h-9 rounded-full px-4">
                Create account
              </ButtonLink>
            </>
          )}
          <button className="grid size-10 place-items-center rounded-full hover:bg-ink/6 md:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-mist md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-[10px] px-3 py-2.5 font-semibold hover:bg-ink/6">
                  {n.label}
                </Link>
              ))}
              {!user && (
                <Link href="/signin" className="rounded-[10px] px-3 py-2.5 font-semibold hover:bg-ink/6">
                  Sign in
                </Link>
              )}
              {user && (
                <Link href="/dashboard" className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 font-semibold hover:bg-ink/6">
                  <GraduationCap className="size-4" /> My learning
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Static stand-in shown while the header (which reads the URL) streams in. */
export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-50 bg-mist/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-2">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
