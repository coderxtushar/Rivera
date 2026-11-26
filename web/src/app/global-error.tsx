"use client";

import "./globals.css";

/**
 * Last resort: the root layout itself failed, so this page renders its own
 * document. It avoids app providers and shared components that may be the
 * cause, and uses plain links so it works even if client routing is broken.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-mist text-ink antialiased">
        <title>Something went wrong | Rivera</title>
        <main role="alert" className="grid min-h-dvh place-items-center px-6 text-center">
          <div className="max-w-md">
            <p className="text-2xl font-extrabold tracking-tight">Rivera</p>
            <p aria-hidden className="mt-10 text-[7rem] font-black leading-none text-ink/10">
              500
            </p>
            <h1 className="-mt-6 text-3xl font-extrabold tracking-tight">Something went off course</h1>
            <p className="mx-auto mt-3 max-w-sm text-ink-3">
              Rivera couldn&apos;t load. Try again, or come back in a minute. Your purchases and progress are safe.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => retry()}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85"
              >
                Try again
              </button>
              {/* A full page load on purpose: client routing may be what broke. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="rounded-full bg-ink/7 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/12">
                Go home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
