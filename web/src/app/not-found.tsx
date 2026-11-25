import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/brand/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo className="mb-10" />
        <p className="display text-[7rem] leading-none text-ink/10" style={{ ["--wdth" as string]: 150 }}>404</p>
        <h1 className="display -mt-6 text-3xl">This page isn&apos;t on the map</h1>
        <p className="mx-auto mt-3 max-w-sm text-ink-3">The link may be old, or the course may have been archived.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/courses">Browse courses</ButtonLink>
          <ButtonLink href="/" variant="secondary">Go home</ButtonLink>
        </div>
      </div>
    </main>
  );
}
