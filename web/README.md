# Rivera web

The Rivera frontend: Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, Motion and TanStack Query.
Design system and conventions live in [DESIGN.md](DESIGN.md). The API contract is [../docs/API.md](../docs/API.md).

## Run it

Start the API first (from the repo root: `npm run dev`, which listens on :4000), then:

```bash
cd web
npm install
cp .env.example .env.local      # API_URL=http://localhost:4000
npm run dev                     # http://localhost:3000
```

The API must allow this origin: set `CLIENT_URL=http://localhost:3000` and `CORS_ORIGINS=http://localhost:3000` in the API's `.env`.
For demo content, run `npm run seed -- --demo` in the repo root. Then sign in as `student@demo.rivera.dev` or `instructor@demo.rivera.dev` (password `password123`).

## How it talks to the API

The browser only calls this site's own `/api/v1/*`. `next.config.ts` rewrites those requests to `API_URL`, so the API's httpOnly session cookies are first-party even when the API is on another domain. Expired sessions are refreshed transparently by `src/lib/api.ts`.

## Map

| Area | Routes |
|---|---|
| Public site | `/`, `/courses`, `/courses/[slug]`, `/instructors/[id]`, `/certificates/[code]`, `/checkout/success`, `/teach` |
| Accounts | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` |
| Learner | `/dashboard` (+ wishlist, purchases, certificates), `/settings`, `/learn/[slug]` (course player) |
| Instructor studio | `/studio`, `/studio/courses`, `/studio/courses/new`, `/studio/courses/[id]`, `/studio/coupons`, `/studio/sales` |
| Admin | `/admin`, `/admin/users`, `/admin/courses`, `/admin/orders`, `/admin/categories` |

## Deploy (Vercel, free)

1. Import the repo in Vercel and set **Root Directory** to `web`.
2. Add the env var `API_URL` = your API's URL (e.g. `https://rivera-api.onrender.com`).
3. In the API's environment, set `CLIENT_URL` and `CORS_ORIGINS` to the Vercel URL. Because cookies are now first-party, `COOKIE_SAMESITE=lax` is enough.
4. Requests reach the API through Vercel's proxy, so set the API's `TRUST_PROXY` to the number of proxy hops (Vercel plus Render's own, usually `2`). Check that `req.ip` in the API logs shows visitor IPs; otherwise every visitor shares one rate-limit bucket.
