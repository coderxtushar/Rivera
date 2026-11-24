# Rivera API reference (v1)

Base URL: `http://localhost:4000/api/v1`. Everything here is JSON.

## Conventions

**Responses.** Success bodies are `{ "data": … }`. Lists add `"meta": { page, limit, total, totalPages }`.
Errors are always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [{ "path": "email", "message": "Invalid email address" }] } }
```

Branch on `error.code` rather than the message. Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE`, `RATE_LIMITED`, `NOT_ENROLLED`, `ALREADY_ENROLLED`, `COUPON_INVALID`, `NOT_PUBLISHABLE`.

**Money.** Integer amounts in the currency's minor unit: `49900` = ₹499.00. Display with `amount / 100`.

**Pagination.** `?page=1&limit=12` (limit max 50).

**Ids.** Any `:id` for a course also accepts its slug.

## Authentication

Signin, signup and refresh return `data.accessToken` (15 min) and set two httpOnly cookies: `rv_access` and `rv_refresh` (30 days, path `/api/v1/auth`).

- **Browser frontend (recommended):** call with `credentials: 'include'` and rely on the cookies. When a request fails with `401 TOKEN_EXPIRED`, call `POST /auth/refresh` once and retry.
- **Other clients:** send `Authorization: Bearer <accessToken>`. Add the header `X-Auth-Transport: token` to signin/signup/refresh to get `refreshToken` in the body too, then send it as `{ refreshToken }` to `/auth/refresh`. Use this mode in browsers too if the API and frontend sit on different sites and the browser blocks third-party cookies (Safari, Firefox strict mode). Storing tokens in JS memory is then your frontend's job.

Role changes (e.g. becoming an instructor) return a fresh `accessToken`.

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/signup` | – | `{ email, password (8+), firstName, lastName? }` → 201 `{ user, accessToken }` |
| POST | `/auth/signin` | – | `{ email, password }` |
| POST | `/auth/refresh` | cookie | Rotates the refresh token. Body `{ refreshToken }` is accepted for non-browser clients |
| POST | `/auth/signout` | cookie | 204 |
| POST | `/auth/signout-all` | ✓ | Revokes every session, including access tokens already issued |
| GET | `/auth/me` | ✓ | `{ user }` |
| POST | `/auth/verify-email` | – | `{ token }` from the emailed link `/verify-email?token=…` |
| POST | `/auth/resend-verification` | ✓ | |
| POST | `/auth/forgot-password` | – | `{ email }`. Always 200 |
| POST | `/auth/reset-password` | – | `{ token, password }` from `/reset-password?token=…` |
| POST | `/auth/change-password` | ✓ | `{ currentPassword, newPassword }`. Returns new tokens and signs out other devices |

Auth endpoints are rate-limited (20 requests per 15 min per IP by default).

## Users

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/users/:id/profile` | – | Public profile, published courses, `stats: { courses, students, reviews }` |
| PATCH | `/users/me` | ✓ | `{ firstName, lastName, headline, bio, website, avatarUrl }` (all optional) |
| DELETE | `/users/me` | ✓ | `{ password }`. 409 `HAS_ENROLLED_STUDENTS` if you own courses with students |
| POST | `/users/me/become-instructor` | ✓ | `{ headline?, bio? }`. Instant, or `instructorStatus: "pending"` when admin approval is on |
| GET | `/users/me/enrollments` | ✓ | My courses, with `course` populated and `progress` |
| GET | `/users/me/orders` | ✓ | Purchase history |
| GET | `/users/me/certificates` | ✓ | |
| GET | `/users/me/sessions` | ✓ | Active sign-ins (device, IP, date) |
| GET | `/users/me/wishlist` | ✓ | |
| PUT / DELETE | `/users/me/wishlist/:courseId` | ✓ | 204 |

## Catalog

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/categories` | – | Each with `courseCount` |
| GET | `/courses` | – | Query: `q, category (slug or id), level, language, tag, instructor, minPrice, maxPrice, free=true\|false, featured=true, minRating, sort=relevance\|newest\|popular\|rating\|price_asc\|price_desc` |
| GET | `/courses/:id` | optional | `{ course, curriculum, viewer }`. `curriculum` is sections → lesson outlines (no video/content). `viewer` is `null` when signed out, otherwise `{ isEnrolled, canManage, isWishlisted, progress }` |
| GET | `/courses/:id/reviews` | – | `?rating=1..5`. `meta` includes `ratingAvg, ratingCount, distribution: { "1": n, …, "5": n }` |
| GET | `/certificates/:code` | – | Public certificate verification (`RIV-XXXXXXXXXX`) |

Course fields: `title, slug, subtitle, description, instructor, category, tags[], level (beginner|intermediate|advanced|all), language, price, currency, isFree, thumbnailUrl, promoVideoUrl, requirements[], outcomes[], status (draft|published|archived), isFeatured, publishedAt, stats { enrollmentCount, ratingAvg, ratingCount, lessonCount, totalDurationSec }`.

## Learning

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/courses/:id/enroll` | ✓ | Free courses only. Paid courses → 402 `PAYMENT_REQUIRED` |
| GET | `/courses/:id/curriculum` | enrolled / owner | Full outline with `videoUrl`, `resources`, plus `progress` |
| GET | `/courses/:id/lessons/:lessonId` | enrolled / owner / anyone for previews | Full lesson incl. `content` (markdown). Also records "last watched" |
| POST / DELETE | `/courses/:id/lessons/:lessonId/complete` | enrolled | `{ progress, certificate }`. `certificate` is set when the course reaches 100% |
| GET | `/courses/:id/progress` | enrolled | `{ progress: { completedLessons[], lastLesson, percent, completedAt }, lessonCount }` |
| POST | `/courses/:id/reviews` | enrolled | `{ rating 1–5, comment? }`. One per student |
| PATCH / DELETE | `/reviews/:id` | author / admin | |
| PUT | `/reviews/:id/reply` | course instructor | `{ text }`. Empty text removes the reply |

## Payments

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/payments/config` | – | `{ provider, currency, razorpayKeyId? }` |
| POST | `/payments/quote` | ✓ | `{ courseId, couponCode? }` → `{ originalAmount, discount, amount, currency, coupon }` |
| POST | `/payments/checkout` | ✓ | `{ courseId, couponCode? }` → `{ order, requiresPayment, payment?, enrollment? }` |
| POST | `/payments/verify` | ✓ | `{ orderId, …provider fields }` → `{ order }` |
| GET | `/payments/orders/:id` | ✓ | Poll this after a Stripe redirect |

Order `status`: `created` → `paid` → `refunded`, or `failed`. Unpaid orders expire after 2 hours, and starting a new checkout for the same course cancels the older unpaid one. If money is captured for an order that can't be honoured (expired, already enrolled, coupon used up), it is **refunded automatically** and the order shows `failureReason`. If that automatic refund fails, the order becomes `refund_pending` for an admin to handle.

Checkout flow by `payment.provider`:

- **No payment needed** (`requiresPayment: false`): free course or 100% coupon. You're enrolled; go to the course.
- **`razorpay`:** load `https://checkout.razorpay.com/v1/checkout.js` and open it with `key: payment.keyId, order_id: payment.razorpayOrderId, amount, currency, name, description, prefill`. In its `handler(response)`, POST `/payments/verify` with `{ orderId: payment.orderId, ...response }`. The webhook also fulfils the order, so a closed tab still completes.
- **`stripe`:** redirect to `payment.checkoutUrl`. Stripe sends the user back to `CLIENT_URL/checkout/success?orderId=…`; poll `GET /payments/orders/:orderId` until `status === "paid"`.
- **`mock`** (development only): POST `/payments/verify` with `{ orderId }`.

## Instructor

Requires role `instructor` or `admin`. Instructors can manage only their own courses.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/instructor/courses` | `?status=draft\|published\|archived` |
| GET | `/instructor/stats` | `{ courses, students, rating, revenue[], monthly[], perCourse[] }`. Revenue is per currency, in minor units |
| GET | `/instructor/sales` | Paid and refunded orders for my courses |
| POST | `/courses` | `{ title, subtitle?, description?, category?, tags?, level?, language?, price?, currency?, thumbnailUrl?, promoVideoUrl?, requirements?, outcomes? }` → draft |
| PATCH | `/courses/:id` | Any of the above. The slug is frozen once the course has been published |
| DELETE | `/courses/:id` | 409 `COURSE_HAS_STUDENTS` if anyone is enrolled (archive instead) |
| POST | `/courses/:id/publish` | 422 `NOT_PUBLISHABLE` with `details: [reasons]` until: description ≥ 50 chars, ≥ 1 section, ≥ 1 lesson |
| POST | `/courses/:id/archive` | Hidden from the catalog; enrolled students keep access |
| GET | `/courses/:id/students` | Enrolled students with progress (names only, no emails) |
| POST | `/courses/:id/sections` | `{ title }` |
| PATCH / DELETE | `/courses/:id/sections/:sectionId` | Delete cascades to the section's lessons |
| PUT | `/courses/:id/sections/order` | `{ sectionIds: [all ids in new order] }` |
| POST | `/courses/:id/sections/:sectionId/lessons` | `{ title, type: video\|article, videoUrl?, content?, durationSec?, isPreview?, resources?: [{ title, url }] }` |
| PATCH | `/courses/:id/lessons/:lessonId` | Same fields, plus `sectionId` to move the lesson |
| DELETE | `/courses/:id/lessons/:lessonId` | |
| PUT | `/courses/:id/sections/:sectionId/lessons/order` | `{ lessonIds: [all ids in new order] }` |
| GET / POST | `/coupons` | `{ code, type: percent\|fixed, value, course, maxRedemptions?, expiresAt? }`. Instructors must set `course`; admins may omit it for a site-wide coupon |
| PATCH / DELETE | `/coupons/:id` | PATCH `{ isActive, maxRedemptions, expiresAt }`. Deleting a used coupon deactivates it instead |
| POST | `/uploads/signature` | `{ kind: avatar\|thumbnail\|video\|resource }` → `{ uploadUrl, fields }`. Allowed formats are enforced per kind. POST the file as multipart to `uploadUrl` with `fields` + `file`; save the returned `secure_url`. 503 when Cloudinary isn't configured. Any signed-in user may request `avatar` |

## Admin

Requires role `admin`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/stats` | Users by role, new users (30 days), courses by status, enrollments, revenue and platform fees |
| GET | `/admin/users` | `?q, role, status, instructorStatus` |
| PATCH | `/admin/users/:id` | `{ role?, status: active\|suspended, instructorStatus? }`. Suspending signs the user out immediately |
| GET | `/admin/courses` | `?q, status` |
| PATCH | `/admin/courses/:id` | `{ isFeatured?, status: published\|archived }` |
| GET | `/admin/orders` | `?status=created\|paid\|failed\|refunded\|refund_pending`. Check `refund_pending` regularly |
| POST | `/admin/orders/:id/refund` | Refunds through the provider; revokes the access, review and certificate that order granted. Works on `paid` and `refund_pending` |
| POST / DELETE | `/admin/enrollments` | `{ userId, courseId }`. Grant or revoke access manually |
| POST / PATCH / DELETE | `/categories[/:id]` | `{ name, description? }` |

## Webhooks

`POST /api/v1/payments/webhooks/razorpay` and `/webhooks/stripe`. Both need a valid signature header, and both are idempotent, so the same event can arrive several times.

## Frontend routes the API links to

Emails and Stripe redirects point at these `CLIENT_URL` paths, so the frontend needs pages for them:
`/verify-email?token=`, `/reset-password?token=`, `/learn/:slug`, `/certificates/:code`, `/courses/:slug`, `/checkout/success?orderId=`.
