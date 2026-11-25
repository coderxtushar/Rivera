import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Learning",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1d29",
};

/** The course player: full-screen "night water", no site header or footer. */
export default function LearnLayout({ children }: LayoutProps<"/learn/[slug]">) {
  return <div className="min-h-dvh bg-night text-white [color-scheme:dark]">{children}</div>;
}
