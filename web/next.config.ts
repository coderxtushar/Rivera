import path from "node:path";
import type { NextConfig } from "next";

/**
 * The browser only ever talks to this app's own origin. Requests to /api/v1/*
 * are forwarded to the Rivera API, so auth cookies are first-party even when the
 * API is hosted on another domain (e.g. Render) and the site on Vercel.
 */
const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // web/ is its own app next to the API's package.json; don't infer the repo root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Signed-in areas are client-rendered behind an auth gate, so only validate
    // instant navigation where a segment opts in with `export const instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
