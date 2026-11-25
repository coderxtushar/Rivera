# Rivera

**Rivera** is a course marketplace: instructors publish courses, students buy them and learn, and the platform takes a configurable fee. The API is built with Express 5, MongoDB (Mongoose 9) and Zod; the web app in [web/](web/) uses Next.js 16, Tailwind 4 and Motion. Both run on free tiers (Render + MongoDB Atlas M0 for the API, Vercel for the site).

## Features

| Area | What's included |
| --- | --- |
| **Auth** | Signup/signin, short-lived JWT access tokens plus rotating refresh tokens (reuse detection), httpOnly cookies *or* Bearer header, email verification, forgot/reset/change password, sign out everywhere, session list |
| **Roles** | `student`, `instructor` (self-serve or admin-approved), `admin` |
| **Catalog** | Full-text search, filters (category, level, language, tag, price range, free, rating, featured), sorting, pagination, categories with course counts |
| **Authoring** | Course CRUD, draft → published → archived lifecycle with publish checks, sections and lessons (video or article), drag-and-drop ordering, free preview lessons, downloadable resources |
| **Commerce** | Free enrollment, paid checkout via **Razorpay** or **Stripe** (signature-verified webhooks, idempotent fulfilment, automatic refund of duplicate/expired payments), coupons (percent/fixed, per-course or site-wide, expiry, usage caps), platform fee split, refunds |
| **Learning** | Enrollments, per-lesson progress, resume where you left off, auto-issued **certificates** with a public verification URL |
| **Social** | Reviews and ratings (one per student, kept in sync with course stats), rating distribution, instructor replies, wishlist, public instructor profiles |
| **Dashboards** | Instructor: revenue, monthly earnings, per-course sales, students. Admin: platform stats, user/course moderation, orders, refunds, manual enrollment |
| **Ops** | Helmet, CORS allowlist, CSRF origin check, rate limiting, structured logs with request IDs, health check, graceful shutdown, validated env config, Docker, Render blueprint, seed script, 51 integration tests |

## Quick start

Requires **Node 22+** and MongoDB (local Docker or a free Atlas cluster).

```bash
npm install
cp .env.example .env              # set MONGODB_URI at minimum
docker compose up -d mongo        # optional: local MongoDB on :27017
npm run seed -- --demo            # categories + demo instructor/student/courses
npm run dev                       # http://localhost:4000 (auto-reloads)

cd web && npm install && cp .env.example .env.local
npm run dev                       # the site on http://localhost:3000
```

Demo accounts (from `--demo`): `instructor@demo.rivera.dev` / `student@demo.rivera.dev`, password `password123`.
To create an admin, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ chars) in `.env` and run `npm run seed`.

```bash
npm test                          # integration tests against an in-memory MongoDB
```

To check a **running** server (local or deployed) end to end, run the smoke test. It calls every endpoint the way a frontend would, then deletes the users and courses it created (paid orders are kept for accounting):

```bash
BASE_URL=http://localhost:4000 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run smoke
```

## Project layout

```
src/
  app.js                 Express app (middleware, routes); no listen, so tests can import it
  server.js              DB connect, listen, graceful shutdown
  config/                env (validated with zod), db, logger
  lib/                   ApiError, mailer, helpers
  middleware/            auth, validation, rate limit + CSRF, error handler
  models/                User, Course, Lesson, Enrollment, Order, Coupon, Review, Certificate, Category, tokens
  services/              business logic: tokens, courses, enrollment/progress, payments
  routes/                one router per area, mounted under /api/v1
scripts/seed.js          categories, admin, demo data
tests/                   node:test + supertest integration tests
docs/API.md              endpoint reference for frontend work
web/                     Next.js frontend (see web/README.md and web/DESIGN.md)
```

## Configuration

Every variable is documented in [.env.example](.env.example) and validated at startup in [src/config/env.js](src/config/env.js). The app refuses to boot with unsafe production settings, such as weak JWT secrets or the mock payment provider.

Optional integrations switch on when their variables are set:

| Integration | Variables | Free tier |
| --- | --- | --- |
| Payments | `PAYMENT_PROVIDER=razorpay` + `RAZORPAY_*`, or `stripe` + `STRIPE_*` | Test modes of both |
| Email | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Brevo (300/day), Resend, Mailtrap |
| Media uploads | `CLOUDINARY_*` | Cloudinary free plan |

Without SMTP, emails (verification and reset links) are printed to the server log. Without Cloudinary, the frontend can still save media by URL (for example YouTube or Vimeo links for lessons).

## Deploying for free

1. **Database:** create an Atlas M0 cluster, add a database user, allow access from `0.0.0.0/0` (Render has no static IPs on the free plan) and copy the connection string.
2. **API:** in Render, go to *New → Blueprint* and pick this repo. [render.yaml](render.yaml) sets up a free web service. Fill in `MONGODB_URI`, `CLIENT_URL` and `CORS_ORIGINS` (your frontend URL), plus the payment keys.
3. **Payment webhooks:** point them at `https://<your-api>/api/v1/payments/webhooks/razorpay` (events: `payment.captured`, `order.paid`, `payment.failed`) or `/webhooks/stripe` (`checkout.session.completed`, `checkout.session.expired`).
4. **Seed:** run `npm run seed` once with `ADMIN_EMAIL`/`ADMIN_PASSWORD` set, from the Render shell or locally against the Atlas URI.

When the frontend and API are on different sites (e.g. `*.vercel.app` and `*.onrender.com`), keep `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` as the blueprint does. Browsers increasingly block such third-party cookies (Safari, Firefox strict mode), so either put both on one domain you own (`app.example.com` + `api.example.com`; recommended) or have the frontend use the `X-Auth-Transport: token` mode described in [docs/API.md](docs/API.md). Free Render services sleep after 15 minutes idle, so the first request after that takes about 30 seconds.

## Scaling notes

The code is stateless apart from the in-memory rate-limit store, so scaling out is mostly configuration:

- **Several instances:** move rate limiting to a shared store (`rate-limit-redis`; see [src/middleware/security.js](src/middleware/security.js)).
- **Database:** indexes for every catalog query are declared in the models. Move off M0 when you outgrow 512 MB or need backups.
- **Background work:** emails are sent in-process, fire-and-forget. At volume, move them (and certificate generation) to a queue such as BullMQ.
- **Media:** uploads go straight from the browser to Cloudinary, so the API never handles file bytes.
- **Multi-tenancy:** the current model is a single marketplace. White-label "schools" would add an `Organization` model and scope courses and users to it.
