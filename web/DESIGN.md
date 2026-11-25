# Rivera web: design system & conventions

Next.js 16 (App Router, Cache Components on), React 19, Tailwind v4, Motion (`motion/react`), TanStack Query v5, lucide-react.
The API contract is `../docs/API.md`. Types live in `src/lib/types.ts`.

## Concept

A navigational river chart. Rivera means river: contour lines, depth soundings and channel markers.
Learning is going deeper. Course level is drawn as a **depth gauge** (1–3 wave bands).
One bold moment per page at most. Everything else is quiet, disciplined and legible.

## Tokens (Tailwind classes)

| Token | Class examples | Use |
|---|---|---|
| mist `#eaf1ef` | `bg-mist` | page background |
| foam `#f7faf9` | `bg-foam` | raised surfaces, inputs, panels |
| line / line-strong | `border-line`, `ring-line-strong` | hairlines, control outlines |
| ink / ink-2 / ink-3 | `text-ink`, `text-ink-2`, `text-ink-3` | text: primary / secondary / muted (ink-3 is the lightest allowed for text) |
| channel `#2340f5` | `bg-channel`, `text-channel`, `bg-channel-wash`, `text-channel-deep` | the one action colour: primary buttons, links, focus |
| shoal / reef / deep | `bg-shoal`, `text-reef`, `bg-deep` | depth bands: progress, level, success |
| buoy `#ff5b3a` | `bg-buoy`, `bg-buoy-wash` | small signals only: destructive, discount, "needs attention" |
| night / night-2 / night-3 | `bg-night` | dark surfaces: footer, learning player |

Radii form a hierarchy, not one value everywhere: `rounded-control` (10px) for inputs and buttons, `rounded-card` (16px) for covers and cards, `rounded-panel` (24px) for big panels and dialogs, and `rounded-full` for pills.
Shadows: `shadow-lift` (resting raised) and `shadow-float` (menus, dialogs). Prefer borders over shadows for structure.

## Type

- Text: Hanken Grotesk (`font-sans`, the default).
- Display: Anybody, a variable-width face. Use the `display` class and set width with the CSS var `--wdth` (50–150):
  `<h1 className="display text-4xl" style={{ ["--wdth" as string]: 88 }}>`. Narrow (72–90) for app headings; wide (110–150) only for marketing moments.
- Scale: text-xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl (major third). Use `tabular-nums` for numbers in tables/stats.
- Long-form markdown goes in `.prose-rivera` (render with `react-markdown`).

## Components (import from `@/components/...`)

- `ui/button`: `Button` (variants: primary, secondary, ghost, danger, light, quiet; sizes: sm, md, lg; `loading`, `icon`), `ButtonLink` (same, for next/link), `buttonClass()`.
- `ui/field`: `Field` (render-prop: `{(p) => <Input {...p} />}`; props `label`, `hint`, `error`), `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`.
- `ui/dialog`: `Dialog` (`open`, `onClose`, `title`, `description`, `variant: "center" | "sheet"`).
- `ui/tabs`: `Tabs` (segmented control with a gliding marker; `tone: "light" | "dark"`).
- `ui/toast`: `toast.success/error/info(message)`. The `Toaster` is already mounted.
- `ui/misc`: `Spinner`, `Skeleton`, `Badge` (tone: neutral, current, reef, buoy, ink), `Avatar`, `Stars`, `StarInput`, `ProgressBar`, `ProgressRing`, `EmptyState`, `Pagination` (takes API `meta`), `Collapse` (animated height), `PageTitle`.
- `brand/brand`: `Logo`, `DepthGauge` (`level`), `CourseCover` (generated cover when no thumbnail), `ContourRiver` (hero only).
- `course/course-card`: `CourseCard`, `CourseCardSkeleton`, `Thumb` (cover image or generated cover), `Price`.
- `layout/app-shell`: `RequireAuth` (`roles?`), `AppShell` (`title`, `links: {href,label,icon,exact?}[]`, gliding side-nav marker), `PageFade`.
- `layout/site-header`: `SiteHeader`. It's already in the `(site)` and `(app)` group layouts.

Note: Badge tone is named `current` for historical reasons; it renders in the channel colour.

## Data

- `api<T>(path, { method, body, query })` from `@/lib/api`. Paths are relative to `/api/v1`, and it refreshes expired sessions automatically. Errors are `ApiError` (`status`, `code`, `message`, `details`). Use `errorMessage(err)` for toasts and `fieldErrors(err)` for per-field errors.
- Responses: `{ data }`, with `{ data, meta }` for lists. Money is in minor units, so always format with `money(amount, currency)` from `@/lib/format`. Also there: `duration`, `date`, `relativeTime`, `compact`, `plural`, `fullName`, `cn`.
- `useAuth()` from `@/lib/auth` gives `{ user, loading, signIn, signOut, refresh, hasRole }`. Call `refresh()` after anything that changes the user (profile, role).
- React Query keys: start with the area, e.g. `["studio", "courses", page]`, `["learn", slug]`, `["admin", "users", filters]`. Invalidate the narrowest key after mutations. `["auth","me"]` is the current user.
- `GET /api/v1` → `features: { payments, email, uploads }`. Use it to decide whether to show file upload or URL inputs.

## Motion rules

- `MotionConfig reducedMotion="user"` is global; don't fight it.
- Motion answers actions: opening, closing, reordering, completing, switching tabs. Use `layout` / `layoutId` for things that move between states, `AnimatePresence` for things that appear and disappear, and `Reorder` for drag-to-reorder lists.
- Don't put fade-up entrances on every section, and don't animate hover on every card. A page gets at most one orchestrated entrance (`PageFade` is enough for app pages).
- Springs: the default is set globally. For linear/eased moves use `ease: [0.22, 1, 0.36, 1]`.

## Copy rules

- Sentence case everywhere. No ALL-CAPS labels, no eyebrow labels above headings, no "→" appended to buttons, no meta strings joined with "·" (lay meta out as separate elements).
- Buttons say exactly what happens ("Publish course", "Save changes", "Refund order"), and the matching toast reuses the verb ("Course published").
- Errors say what happened and how to fix it. Empty states invite the next action.
- Name things the way users think: "My learning", "Students", "Earnings", not "enrollments" or "orders" in UI copy (orders → "Purchases" for learners).

## Accessibility floor

Visible focus (global `:focus-visible`), labelled controls (use `Field`), `aria-current` on active nav, buttons for actions and links for navigation, sufficient contrast (never lighter than `text-ink-3` on mist/foam), responsive down to 360px wide.

## Route map & ownership

| Area | Routes | Notes |
|---|---|---|
| Public site `(site)` | `/`, `/courses`, `/courses/[slug]`, `/instructors/[id]`, `/certificates/[code]`, `/checkout/success`, `/teach` | |
| Auth `(auth)` | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | `?next=` is honoured after sign-in |
| Learner `(app)` | `/dashboard` (+ `/dashboard/wishlist`, `/dashboard/purchases`, `/dashboard/certificates`), `/settings` | |
| Player | `/learn/[slug]` (own full-screen dark layout, outside the groups) | Emails link here |
| Studio `(app)` | `/studio`, `/studio/courses`, `/studio/courses/new`, `/studio/courses/[id]`, `/studio/coupons`, `/studio/sales` | instructor + admin |
| Admin `(app)` | `/admin`, `/admin/users`, `/admin/courses`, `/admin/orders`, `/admin/categories` | admin only |

Shared files (`src/lib/*`, `src/components/*`, `src/app/layout.tsx`, `src/app/globals.css`, group layouts) are owned by the lead. If an area needs a change there, add a local component inside the area folder, or note the request in your final report.
