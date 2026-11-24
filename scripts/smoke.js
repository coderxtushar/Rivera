'use strict';

/**
 * End-to-end smoke test: drives a *running* API over HTTP through every
 * endpoint, the way a frontend would, then deletes everything it created
 * (except paid orders, which are kept for accounting).
 *
 *   BASE_URL=http://localhost:4000 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run smoke
 *
 * Optional:
 *   SMOKE_MAIL_LOG=<server log file>  read email links from a dev server's log to
 *                                     test verify-email / reset-password end to end
 *   SMOKE_REPORT=<file.json>          write the list of exercised routes
 *
 * Makes ~15 rate-limited auth calls; raise AUTH_RATE_LIMIT_MAX on the server
 * if you run it repeatedly within 15 minutes.
 */
const fs = require('node:fs');

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API = '/api/v1';
const RUN = Date.now().toString(36);
const PASSWORD = 'smoke-password-1';

const results = [];
const exercised = new Set();
let area = 'setup';

function fill(template, params = {}) {
  return template.replace(/:(\w+)/g, (_, k) => {
    if (params[k] === undefined) throw new Error(`missing param ${k} for ${template}`);
    return encodeURIComponent(params[k]);
  });
}

/** Make a request, record pass/fail against the expected status(es). */
async function call(name, method, template, { params, query, token, body, headers = {}, expect = 200, raw } = {}) {
  const path = fill(template, params) + (query ? `?${new URLSearchParams(query)}` : '');
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  let res;
  let json = null;
  const started = performance.now();
  try {
    res = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
  } catch (err) {
    results.push({ area, name, method, path: template, status: 'ERR', ok: false, note: err.message });
    return { status: 0, body: null, headers: new Headers() };
  }
  const ms = Math.round(performance.now() - started);
  const expected = [].concat(expect);
  const ok = expected.includes(res.status);
  exercised.add(`${method} ${template}`);
  results.push({
    area,
    name,
    method,
    path: template,
    status: res.status,
    ms,
    ok,
    note: ok ? '' : `expected ${expected.join('/')}: ${JSON.stringify(json?.error || json).slice(0, 160)}`,
  });
  return { status: res.status, body: json, headers: res.headers };
}

/** Record a non-HTTP assertion. */
function check(name, condition, note = '') {
  results.push({ area, name, method: '', path: '', status: condition ? 'ok' : 'FAIL', ok: Boolean(condition), note: condition ? '' : note });
}

const cookieHeader = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

function mailToken(kind) {
  const file = process.env.SMOKE_MAIL_LOG;
  if (!file || !fs.existsSync(file)) return null;
  const matches = [...fs.readFileSync(file, 'utf8').matchAll(new RegExp(`${kind}\\?token=([A-Za-z0-9_-]+)`, 'g'))];
  return matches.at(-1)?.[1] || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const email = (who) => `smoke-${who}-${RUN}@example.com`;

  /* ------------------------------------------------------------ system */
  area = 'system';
  await call('API root', 'GET', '/');
  await call('Health check', 'GET', '/health');
  const info = (await call('API info + features', 'GET', API)).body;
  const features = info?.features || {};

  /* -------------------------------------------------------------- auth */
  area = 'auth';
  let admin = null;
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const r = await call('Admin signs in', 'POST', `${API}/auth/signin`, {
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    admin = r.body?.data?.accessToken;
  } else {
    check('Admin credentials provided', false, 'set ADMIN_EMAIL / ADMIN_PASSWORD to test admin endpoints');
  }

  const signup = async (who, firstName) => {
    const r = await call(`Signup (${who})`, 'POST', `${API}/auth/signup`, {
      body: { email: email(who), password: PASSWORD, firstName, lastName: 'Smoke' },
      expect: 201,
    });
    return { token: r.body?.data?.accessToken, id: r.body?.data?.user?._id, email: email(who), password: PASSWORD };
  };
  const inst = await signup('instructor', 'Ivy');
  const a = await signup('student-a', 'Ana');
  const b = await signup('student-b', 'Ben');

  await call('Duplicate signup rejected', 'POST', `${API}/auth/signup`, {
    body: { email: a.email, password: PASSWORD, firstName: 'Dup' },
    expect: 409,
  });
  await call('Invalid signup rejected', 'POST', `${API}/auth/signup`, { body: { email: 'bad', password: 'x' }, expect: 400 });
  await call('Wrong password rejected', 'POST', `${API}/auth/signin`, { body: { email: a.email, password: 'wrong-pass-1' }, expect: 401 });

  const cookieLogin = await call('Signin (cookie session)', 'POST', `${API}/auth/signin`, { body: { email: a.email, password: PASSWORD } });
  const cookies = cookieHeader(cookieLogin);
  check('Signin sets rv_access + rv_refresh cookies', /rv_access=/.test(cookies) && /rv_refresh=/.test(cookies));
  await call('GET /auth/me via cookie', 'GET', `${API}/auth/me`, { headers: { Cookie: cookies } });
  await call('GET /auth/me via Bearer', 'GET', `${API}/auth/me`, { token: a.token });
  await call('GET /auth/me without auth', 'GET', `${API}/auth/me`, { expect: 401 });

  const tokenLogin = await call('Signin (token mode)', 'POST', `${API}/auth/signin`, {
    body: { email: a.email, password: PASSWORD },
    headers: { 'X-Auth-Transport': 'token' },
  });
  const rt1 = tokenLogin.body?.data?.refreshToken;
  check('Token mode returns refreshToken in body', Boolean(rt1));
  const refreshed = await call('Refresh rotates token', 'POST', `${API}/auth/refresh`, {
    body: { refreshToken: rt1 },
    headers: { 'X-Auth-Transport': 'token' },
  });
  check('Refresh returns a new refresh token', refreshed.body?.data?.refreshToken && refreshed.body.data.refreshToken !== rt1);
  await call('Replayed refresh token rejected', 'POST', `${API}/auth/refresh`, { body: { refreshToken: rt1 }, expect: 401 });
  await call('Signout (cookie)', 'POST', `${API}/auth/signout`, { headers: { Cookie: cookies }, expect: 204 });

  await call('Resend verification email', 'POST', `${API}/auth/resend-verification`, { token: a.token });
  await sleep(300); // let the server flush its log
  const verifyToken = mailToken('verify-email');
  if (verifyToken) {
    const v = await call('Verify email (real token)', 'POST', `${API}/auth/verify-email`, { body: { token: verifyToken } });
    check('Email marked verified', v.body?.data?.user?.isEmailVerified === true);
  } else {
    await call('Verify email (invalid token)', 'POST', `${API}/auth/verify-email`, { body: { token: 'not-a-real-token-123' }, expect: 400 });
  }

  await call('Forgot password', 'POST', `${API}/auth/forgot-password`, { body: { email: a.email } });
  await sleep(300);
  const resetToken = mailToken('reset-password');
  if (resetToken) {
    await call('Reset password (real token)', 'POST', `${API}/auth/reset-password`, { body: { token: resetToken, password: 'smoke-password-2' } });
    await call('Old access token revoked after reset', 'GET', `${API}/auth/me`, { token: a.token, expect: 401 });
    a.password = 'smoke-password-2';
    a.token = (await call('Signin with new password', 'POST', `${API}/auth/signin`, { body: { email: a.email, password: a.password } })).body?.data?.accessToken;
  } else {
    await call('Reset password (invalid token)', 'POST', `${API}/auth/reset-password`, { body: { token: 'not-a-real-token-123', password: 'whatever-123' }, expect: 400 });
  }

  const changed = await call('Change password', 'POST', `${API}/auth/change-password`, {
    token: b.token,
    body: { currentPassword: PASSWORD, newPassword: 'smoke-password-3' },
  });
  b.password = 'smoke-password-3';
  await call('Old token dead after change', 'GET', `${API}/auth/me`, { token: b.token, expect: 401 });
  b.token = changed.body?.data?.accessToken;
  await call('Signout everywhere', 'POST', `${API}/auth/signout-all`, { token: b.token, expect: 204 });
  await call('Token dead after signout-all', 'GET', `${API}/auth/me`, { token: b.token, expect: 401 });
  b.token = (await call('Signin again', 'POST', `${API}/auth/signin`, { body: { email: b.email, password: b.password } })).body?.data?.accessToken;

  /* ------------------------------------------------------------- users */
  area = 'users';
  await call('Update my profile', 'PATCH', `${API}/users/me`, {
    token: inst.token,
    body: { headline: 'Smoke-test instructor', bio: 'Created by scripts/smoke.js', website: 'https://example.com' },
  });
  await call('Student cannot create a course', 'POST', `${API}/courses`, { token: inst.token, body: { title: 'Not yet allowed' }, expect: 403 });
  const became = await call('Become an instructor', 'POST', `${API}/users/me/become-instructor`, { token: inst.token, body: {} });
  check('Role is now instructor', became.body?.data?.user?.role === 'instructor');
  inst.token = became.body?.data?.accessToken;
  await call('List my sessions', 'GET', `${API}/users/me/sessions`, { token: a.token });

  /* -------------------------------------------------------- categories */
  area = 'categories';
  let category = null;
  if (admin) {
    category = (await call('Admin creates category', 'POST', `${API}/categories`, { token: admin, body: { name: `Smoke ${RUN}` }, expect: 201 })).body?.data?.category;
    await call('Admin renames category', 'PATCH', `${API}/categories/:id`, {
      params: { id: category?._id },
      token: admin,
      body: { name: `Smoke Tests ${RUN}`, description: 'temporary' },
    });
    category = (await call('Categories list', 'GET', `${API}/categories`)).body?.data?.find((c) => c._id === category?._id) || category;
  }
  await call('Student cannot create category', 'POST', `${API}/categories`, { token: a.token, body: { name: 'Nope' }, expect: 403 });

  /* --------------------------------------------------------- authoring */
  area = 'authoring';
  const paid = (await call('Create paid course', 'POST', `${API}/courses`, {
    token: inst.token,
    body: { title: `Smoke Paid Course ${RUN}`, price: 49900, level: 'beginner', ...(category ? { category: category._id } : {}) },
    expect: 201,
  })).body?.data?.course;
  const free = (await call('Create free course', 'POST', `${API}/courses`, {
    token: inst.token,
    body: { title: `Smoke Free Course ${RUN}`, price: 0 },
    expect: 201,
  })).body?.data?.course;

  const description = 'An end-to-end smoke test course used to verify that every API endpoint behaves correctly.';
  await call('Update course details', 'PATCH', `${API}/courses/:id`, {
    params: { id: paid?._id },
    token: inst.token,
    body: { description, subtitle: 'Smoke testing', tags: ['smoke', 'testing'], outcomes: ['Confidence'], requirements: ['None'] },
  });
  const early = await call('Publish blocked until ready', 'POST', `${API}/courses/:id/publish`, { params: { id: paid?._id }, token: inst.token, expect: 422 });
  check('Publish errors list reasons', Array.isArray(early.body?.error?.details) && early.body.error.details.length >= 2);

  const s1 = (await call('Add section', 'POST', `${API}/courses/:id/sections`, { params: { id: paid?._id }, token: inst.token, body: { title: 'Basics' }, expect: 201 })).body?.data?.section;
  const s2 = (await call('Add second section', 'POST', `${API}/courses/:id/sections`, { params: { id: paid?._id }, token: inst.token, body: { title: 'Extras' }, expect: 201 })).body?.data?.section;
  await call('Rename section', 'PATCH', `${API}/courses/:id/sections/:sectionId`, { params: { id: paid?._id, sectionId: s1?._id }, token: inst.token, body: { title: 'Fundamentals' } });

  const addLesson = async (section, title, extra = {}) =>
    (await call(`Add lesson "${title}"`, 'POST', `${API}/courses/:id/sections/:sectionId/lessons`, {
      params: { id: paid?._id, sectionId: section?._id },
      token: inst.token,
      body: { title, type: 'video', videoUrl: 'https://example.com/video.mp4', durationSec: 120, content: `Notes for ${title}`, ...extra },
      expect: 201,
    })).body?.data?.lesson;
  const l1 = await addLesson(s1, 'Welcome', { isPreview: true });
  const l2 = await addLesson(s1, 'Core ideas', { resources: [{ title: 'Slides', url: 'https://example.com/slides.pdf' }] });
  const l3 = await addLesson(s1, 'Wrap up');
  const l4 = await addLesson(s2, 'Bonus', { type: 'article', videoUrl: '' });

  await call('Edit lesson', 'PATCH', `${API}/courses/:id/lessons/:lessonId`, { params: { id: paid?._id, lessonId: l2?._id }, token: inst.token, body: { durationSec: 600 } });
  await call('Reorder lessons', 'PUT', `${API}/courses/:id/sections/:sectionId/lessons/order`, {
    params: { id: paid?._id, sectionId: s1?._id },
    token: inst.token,
    body: { lessonIds: [l1?._id, l3?._id, l2?._id] },
  });
  await call('Move lesson to other section', 'PATCH', `${API}/courses/:id/lessons/:lessonId`, { params: { id: paid?._id, lessonId: l3?._id }, token: inst.token, body: { sectionId: s2?._id } });
  await call('Reorder sections', 'PUT', `${API}/courses/:id/sections/order`, { params: { id: paid?._id }, token: inst.token, body: { sectionIds: [s1?._id, s2?._id] } });
  await call('Other user cannot edit course', 'PATCH', `${API}/courses/:id`, { params: { id: paid?._id }, token: a.token, body: { title: 'Hijacked course' }, expect: 403 });

  const published = await call('Publish paid course', 'POST', `${API}/courses/:id/publish`, { params: { id: paid?._id }, token: inst.token });
  check('Course stats computed', published.body?.data?.course?.stats?.lessonCount === 4);

  await call('Free course: update', 'PATCH', `${API}/courses/:id`, { params: { id: free?._id }, token: inst.token, body: { description } });
  const fs1 = (await call('Free course: add section', 'POST', `${API}/courses/:id/sections`, { params: { id: free?._id }, token: inst.token, body: { title: 'Only section' }, expect: 201 })).body?.data?.section;
  const fl1 = (await call('Free course: add lesson', 'POST', `${API}/courses/:id/sections/:sectionId/lessons`, {
    params: { id: free?._id, sectionId: fs1?._id },
    token: inst.token,
    body: { title: 'Only lesson', durationSec: 60 },
    expect: 201,
  })).body?.data?.lesson;
  await call('Free course: publish', 'POST', `${API}/courses/:id/publish`, { params: { id: free?._id }, token: inst.token });

  await call('Instructor: my courses', 'GET', `${API}/instructor/courses`, { token: inst.token });
  await call('Instructor: full curriculum', 'GET', `${API}/courses/:id/curriculum`, { params: { id: paid?._id }, token: inst.token });

  /* ----------------------------------------------------------- catalog */
  area = 'catalog';
  const all = await call('Browse catalog', 'GET', `${API}/courses`);
  check('Catalog returns pagination meta', typeof all.body?.meta?.total === 'number');
  const search = await call('Search', 'GET', `${API}/courses`, { query: { q: `Smoke Paid Course ${RUN}` } });
  check('Search finds the course', search.body?.data?.some((c) => c._id === paid?._id));
  if (category) {
    const byCat = await call('Filter by category slug', 'GET', `${API}/courses`, { query: { category: category.slug } });
    check('Category filter works', byCat.body?.data?.length === 1 && byCat.body.data[0]._id === paid?._id);
  }
  const freeOnly = await call('Filter free courses', 'GET', `${API}/courses`, { query: { free: 'true', limit: 50 } });
  check('Free filter only returns free courses', freeOnly.body?.data?.every((c) => c.price === 0));
  await call('Filter by price, sort by price', 'GET', `${API}/courses`, { query: { minPrice: 1, maxPrice: 100000, sort: 'price_desc' } });
  await call('Filter by level + tag', 'GET', `${API}/courses`, { query: { level: 'beginner', tag: 'smoke' } });
  await call('Invalid sort rejected', 'GET', `${API}/courses`, { query: { sort: 'nonsense' }, expect: 400 });

  const detail = await call('Course detail by slug (public)', 'GET', `${API}/courses/:id`, { params: { id: paid?.slug } });
  check('Public detail hides video URLs', detail.body?.data?.curriculum?.every((s) => s.lessons.every((l) => l.videoUrl === undefined)));
  check('Anonymous viewer is null', detail.body?.data?.viewer === null);
  await call('Preview lesson (anonymous)', 'GET', `${API}/courses/:id/lessons/:lessonId`, { params: { id: paid?._id, lessonId: l1?._id } });
  await call('Locked lesson (anonymous)', 'GET', `${API}/courses/:id/lessons/:lessonId`, { params: { id: paid?._id, lessonId: l2?._id }, expect: 403 });
  await call('Instructor public profile', 'GET', `${API}/users/:id/profile`, { params: { id: inst.id } });
  await call('Reviews list (empty)', 'GET', `${API}/courses/:id/reviews`, { params: { id: paid?._id } });

  /* ---------------------------------------------------------- wishlist */
  area = 'wishlist';
  await call('Add to wishlist', 'PUT', `${API}/users/me/wishlist/:courseId`, { params: { courseId: paid?._id }, token: a.token, expect: 204 });
  const wl = await call('Get wishlist', 'GET', `${API}/users/me/wishlist`, { token: a.token });
  check('Wishlist has the course', wl.body?.data?.some((c) => c._id === paid?._id));
  const viewer = await call('Course detail (signed in)', 'GET', `${API}/courses/:id`, { params: { id: paid?._id }, token: a.token });
  check('Viewer shows wishlisted', viewer.body?.data?.viewer?.isWishlisted === true);
  await call('Remove from wishlist', 'DELETE', `${API}/users/me/wishlist/:courseId`, { params: { courseId: paid?._id }, token: a.token, expect: 204 });

  /* ----------------------------------------------------------- coupons */
  area = 'coupons';
  const code = `SMOKE${RUN}`.toUpperCase().slice(0, 32);
  const coupon = (await call('Create coupon', 'POST', `${API}/coupons`, {
    token: inst.token,
    body: { code, type: 'percent', value: 50, course: paid?._id, maxRedemptions: 5 },
    expect: 201,
  })).body?.data?.coupon;
  await call('List my coupons', 'GET', `${API}/coupons`, { token: inst.token });
  await call('Update coupon', 'PATCH', `${API}/coupons/:id`, { params: { id: coupon?._id }, token: inst.token, body: { maxRedemptions: 10 } });
  await call('Student cannot list coupons', 'GET', `${API}/coupons`, { token: a.token, expect: 403 });

  /* ---------------------------------------------------------- payments */
  area = 'payments';
  const config = await call('Payment config', 'GET', `${API}/payments/config`);
  const provider = config.body?.data?.provider;
  const q = await call('Quote with coupon', 'POST', `${API}/payments/quote`, { token: a.token, body: { courseId: paid?._id, couponCode: code } });
  check('Coupon halves the price', q.body?.data?.amount === 24950, `got ${q.body?.data?.amount}`);
  await call('Invalid coupon rejected', 'POST', `${API}/payments/quote`, { token: a.token, body: { courseId: paid?._id, couponCode: 'NOPE-NOPE' }, expect: 422 });
  await call('Instructor cannot buy own course', 'POST', `${API}/payments/checkout`, { token: inst.token, body: { courseId: paid?._id }, expect: 422 });

  const co = await call('Checkout', 'POST', `${API}/payments/checkout`, { token: a.token, body: { courseId: paid?._id, couponCode: code }, expect: 201 });
  const order = co.body?.data?.order;
  check(`Checkout returns ${provider} payment payload`, co.body?.data?.payment?.provider === provider);
  let purchased = false;
  if (provider === 'mock') {
    const v = await call('Verify payment', 'POST', `${API}/payments/verify`, { token: a.token, body: { orderId: order?._id } });
    purchased = v.body?.data?.order?.status === 'paid';
    check('Order is paid', purchased);
    await call('Order status', 'GET', `${API}/payments/orders/:id`, { params: { id: order?._id }, token: a.token });
    await call('Checkout again → already enrolled', 'POST', `${API}/payments/checkout`, { token: a.token, body: { courseId: paid?._id }, expect: 409 });
  } else {
    check(`Payment completion skipped (${provider} needs a real payment)`, true);
    await call('Order status', 'GET', `${API}/payments/orders/:id`, { params: { id: order?._id }, token: a.token });
  }
  await call('Other user cannot see order', 'GET', `${API}/payments/orders/:id`, { params: { id: order?._id }, token: b.token, expect: 404 });
  await call('Free-enroll on paid course → 402', 'POST', `${API}/courses/:id/enroll`, { params: { id: paid?._id }, token: b.token, expect: 402 });
  await call('Enroll in free course', 'POST', `${API}/courses/:id/enroll`, { params: { id: free?._id }, token: b.token, expect: 201 });
  await call('Unsigned Razorpay webhook rejected', 'POST', `${API}/payments/webhooks/:provider`, {
    params: { provider: 'razorpay' },
    raw: '{"event":"payment.captured"}',
    headers: { 'Content-Type': 'application/json' },
    expect: [400, 503],
  });
  await call('Unsigned Stripe webhook rejected', 'POST', `${API}/payments/webhooks/:provider`, {
    params: { provider: 'stripe' },
    raw: '{"type":"checkout.session.completed"}',
    headers: { 'Content-Type': 'application/json' },
    expect: [400, 503],
  });

  /* ---------------------------------------------------------- learning */
  area = 'learning';
  let certCode = null;
  if (purchased) {
    const cur = await call('Student: full curriculum', 'GET', `${API}/courses/:id/curriculum`, { params: { id: paid?._id }, token: a.token });
    check('Enrolled student sees video URLs', cur.body?.data?.curriculum?.[0]?.lessons?.[0]?.videoUrl);
    await call('Student: open locked lesson', 'GET', `${API}/courses/:id/lessons/:lessonId`, { params: { id: paid?._id, lessonId: l2?._id }, token: a.token });
    let last;
    for (const l of [l1, l2, l3, l4]) {
      // eslint-disable-next-line no-await-in-loop
      last = await call('Complete lesson', 'POST', `${API}/courses/:id/lessons/:lessonId/complete`, { params: { id: paid?._id, lessonId: l?._id }, token: a.token });
    }
    check('Progress reaches 100%', last.body?.data?.progress?.percent === 100);
    certCode = last.body?.data?.certificate?.code;
    check('Certificate issued', /^RIV-/.test(certCode || ''));
    const undo = await call('Un-complete lesson', 'DELETE', `${API}/courses/:id/lessons/:lessonId/complete`, { params: { id: paid?._id, lessonId: l4?._id }, token: a.token });
    check('Progress drops to 75%', undo.body?.data?.progress?.percent === 75);
    await call('Get progress', 'GET', `${API}/courses/:id/progress`, { params: { id: paid?._id }, token: a.token });
    await call('Verify certificate (public)', 'GET', `${API}/certificates/:code`, { params: { code: certCode } });
  }
  await call('Unknown certificate', 'GET', `${API}/certificates/:code`, { params: { code: 'RIV-0000000000' }, expect: 404 });
  await call('My enrollments', 'GET', `${API}/users/me/enrollments`, { token: a.token });
  await call('My orders', 'GET', `${API}/users/me/orders`, { token: a.token });
  await call('My certificates', 'GET', `${API}/users/me/certificates`, { token: a.token });
  await call('Not enrolled → progress 403', 'GET', `${API}/courses/:id/progress`, { params: { id: paid?._id }, token: b.token, expect: 403 });

  /* ----------------------------------------------------------- reviews */
  area = 'reviews';
  let reviewId = null;
  if (purchased) {
    reviewId = (await call('Post review', 'POST', `${API}/courses/:id/reviews`, { params: { id: paid?._id }, token: a.token, body: { rating: 4, comment: 'Solid' }, expect: 201 })).body?.data?.review?._id;
    await call('Second review blocked', 'POST', `${API}/courses/:id/reviews`, { params: { id: paid?._id }, token: a.token, body: { rating: 5 }, expect: 409 });
    await call('Edit review', 'PATCH', `${API}/reviews/:id`, { params: { id: reviewId }, token: a.token, body: { rating: 5 } });
    await call('Instructor replies', 'PUT', `${API}/reviews/:id/reply`, { params: { id: reviewId }, token: inst.token, body: { text: 'Thank you!' } });
    await call('Others cannot edit review', 'PATCH', `${API}/reviews/:id`, { params: { id: reviewId }, token: b.token, body: { rating: 1 }, expect: 403 });
    const rl = await call('Reviews with distribution', 'GET', `${API}/courses/:id/reviews`, { params: { id: paid?._id } });
    check('Rating average updated', rl.body?.meta?.ratingAvg === 5);
  }
  await call('Non-enrolled cannot review', 'POST', `${API}/courses/:id/reviews`, { params: { id: paid?._id }, token: b.token, body: { rating: 1 }, expect: 403 });
  const freeReview = (await call('Review free course', 'POST', `${API}/courses/:id/reviews`, { params: { id: free?._id }, token: b.token, body: { rating: 3 }, expect: 201 })).body?.data?.review;
  await call('Delete review', 'DELETE', `${API}/reviews/:id`, { params: { id: freeReview?._id }, token: b.token, expect: 204 });

  /* -------------------------------------------------------- instructor */
  area = 'instructor';
  const stats = await call('Instructor stats', 'GET', `${API}/instructor/stats`, { token: inst.token });
  if (purchased) check('Earnings = 80% of 24950', stats.body?.data?.revenue?.[0]?.earnings === 19960, JSON.stringify(stats.body?.data?.revenue));
  await call('Instructor sales', 'GET', `${API}/instructor/sales`, { token: inst.token });
  await call('Course students', 'GET', `${API}/courses/:id/students`, { params: { id: free?._id }, token: inst.token });
  await call('Student blocked from dashboard', 'GET', `${API}/instructor/stats`, { token: a.token, expect: 403 });

  /* ----------------------------------------------------------- uploads */
  area = 'uploads';
  const up = await call('Upload signature', 'POST', `${API}/uploads/signature`, {
    token: inst.token,
    body: { kind: 'thumbnail' },
    expect: features.uploads ? 200 : 503,
  });
  if (features.uploads) check('Signature has fields', Boolean(up.body?.data?.fields?.signature));
  await call('Student cannot sign video upload', 'POST', `${API}/uploads/signature`, { token: a.token, body: { kind: 'video' }, expect: features.uploads ? 403 : [403, 503] });

  /* ------------------------------------------------------------- admin */
  area = 'admin';
  if (admin) {
    await call('Platform stats', 'GET', `${API}/admin/stats`, { token: admin });
    await call('Search users', 'GET', `${API}/admin/users`, { token: admin, query: { q: `smoke-student-b-${RUN}` } });
    await call('Suspend user', 'PATCH', `${API}/admin/users/:id`, { params: { id: b.id }, token: admin, body: { status: 'suspended' } });
    await call('Suspended user blocked', 'GET', `${API}/auth/me`, { token: b.token, expect: [401, 403] });
    await call('Suspended user cannot sign in', 'POST', `${API}/auth/signin`, { body: { email: b.email, password: b.password }, expect: 403 });
    await call('Reactivate user', 'PATCH', `${API}/admin/users/:id`, { params: { id: b.id }, token: admin, body: { status: 'active' } });
    b.token = (await call('Signin after reactivation', 'POST', `${API}/auth/signin`, { body: { email: b.email, password: b.password } })).body?.data?.accessToken;

    await call('List all courses', 'GET', `${API}/admin/courses`, { token: admin, query: { q: RUN } });
    await call('Feature a course', 'PATCH', `${API}/admin/courses/:id`, { params: { id: paid?._id }, token: admin, body: { isFeatured: true } });
    const featured = await call('Featured courses', 'GET', `${API}/courses`, { query: { featured: 'true', limit: 50 } });
    check('Course is featured', featured.body?.data?.some((c) => c._id === paid?._id));

    await call('Grant enrollment', 'POST', `${API}/admin/enrollments`, { token: admin, body: { userId: b.id, courseId: paid?._id }, expect: 201 });
    await call('Granted student can learn', 'GET', `${API}/courses/:id/progress`, { params: { id: paid?._id }, token: b.token });
    await call('Revoke enrollment', 'DELETE', `${API}/admin/enrollments`, { token: admin, body: { userId: b.id, courseId: paid?._id }, expect: 204 });

    await call('List orders', 'GET', `${API}/admin/orders`, { token: admin, query: { status: 'paid' } });
    if (purchased) {
      await call('Refund order', 'POST', `${API}/admin/orders/:id/refund`, { params: { id: order?._id }, token: admin });
      await call('Refund twice blocked', 'POST', `${API}/admin/orders/:id/refund`, { params: { id: order?._id }, token: admin, expect: 409 });
      await call('Refunded student lost access', 'GET', `${API}/courses/:id/progress`, { params: { id: paid?._id }, token: a.token, expect: 403 });
      await call('Refund removed certificate', 'GET', `${API}/certificates/:code`, { params: { code: certCode }, expect: 404 });
    }
  }
  await call('Student blocked from admin', 'GET', `${API}/admin/stats`, { token: a.token, expect: 403 });

  /* ---------------------------------------------------------- security */
  area = 'security';
  const csrfLogin = await call('Signin for CSRF check', 'POST', `${API}/auth/signin`, { body: { email: a.email, password: a.password } });
  await call('Cross-site cookie request blocked', 'POST', `${API}/auth/signout`, {
    headers: { Cookie: cookieHeader(csrfLogin), Origin: 'https://evil.example.com' },
    expect: 403,
  });
  await call('Garbage token rejected', 'GET', `${API}/auth/me`, { token: 'abc.def.ghi', expect: 401 });
  await call('Unknown route → 404', 'GET', `${API}/definitely-not-a-route`, { expect: 404 });
  await call('Malformed JSON → 400', 'POST', `${API}/auth/signin`, { raw: '{bad json', headers: { 'Content-Type': 'application/json' }, expect: 400 });
  await call('Bad id → 400', 'GET', `${API}/users/:id/profile`, { params: { id: 'not-an-id' }, expect: 400 });

  /* ----------------------------------------------------------- archive */
  area = 'lifecycle';
  await call('Archive free course', 'POST', `${API}/courses/:id/archive`, { params: { id: free?._id }, token: inst.token });
  await call('Archived course hidden publicly', 'GET', `${API}/courses/:id`, { params: { id: free?._id }, expect: 404 });
  await call('Enrolled student keeps access', 'GET', `${API}/courses/:id/curriculum`, { params: { id: free?._id }, token: b.token });
  await call('Course with students cannot be deleted', 'DELETE', `${API}/courses/:id`, { params: { id: free?._id }, token: inst.token, expect: 409 });

  /* ----------------------------------------------------------- cleanup */
  area = 'cleanup';
  await call('Delete account (student A)', 'DELETE', `${API}/users/me`, { token: a.token, body: { password: a.password }, expect: 204 });
  await call('Delete account (student B)', 'DELETE', `${API}/users/me`, { token: b.token, body: { password: b.password }, expect: 204 });
  await call('Delete coupon', 'DELETE', `${API}/coupons/:id`, { params: { id: coupon?._id }, token: inst.token, expect: 204 });
  await call('Delete lesson', 'DELETE', `${API}/courses/:id/lessons/:lessonId`, { params: { id: free?._id, lessonId: fl1?._id }, token: inst.token, expect: 204 });
  await call('Delete section', 'DELETE', `${API}/courses/:id/sections/:sectionId`, { params: { id: paid?._id, sectionId: s2?._id }, token: inst.token, expect: 204 });
  await call('Delete paid course', 'DELETE', `${API}/courses/:id`, { params: { id: paid?._id }, token: inst.token, expect: 204 });
  await call('Delete free course', 'DELETE', `${API}/courses/:id`, { params: { id: free?._id }, token: inst.token, expect: 204 });
  if (admin && category) await call('Delete category', 'DELETE', `${API}/categories/:id`, { params: { id: category._id }, token: admin, expect: 204 });
  await call('Delete account (instructor)', 'DELETE', `${API}/users/me`, { token: inst.token, body: { password: inst.password }, expect: 204 });
}

function report() {
  const byArea = Object.groupBy(results, (r) => r.area);
  for (const [name, rows] of Object.entries(byArea)) {
    const passed = rows.filter((r) => r.ok).length;
    console.log(`\n${name.toUpperCase()}  ${passed}/${rows.length}`);
    for (const r of rows) {
      const label = r.method ? `${r.method.padEnd(6)} ${r.path}` : '(check)';
      console.log(`  ${r.ok ? '✔' : '✖'} ${String(r.status).padEnd(4)} ${r.name.padEnd(42)} ${label}${r.note ? `\n        → ${r.note}` : ''}`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  const requests = results.filter((r) => r.method);
  const times = requests.map((r) => r.ms).filter(Number.isFinite).sort((x, y) => x - y);
  console.log(
    `\n${failed.length ? '✖' : '✔'} ${results.length - failed.length}/${results.length} checks passed · ${requests.length} requests · ${exercised.size} distinct routes · median ${times[Math.floor(times.length / 2)] ?? 0}ms`,
  );
  if (process.env.SMOKE_REPORT) fs.writeFileSync(process.env.SMOKE_REPORT, JSON.stringify([...exercised].sort(), null, 2));
  return failed.length;
}

main()
  .catch((err) => {
    results.push({ area, name: 'Smoke script crashed', method: '', path: '', status: 'ERR', ok: false, note: err.stack });
  })
  .finally(() => {
    process.exitCode = report() ? 1 : 0;
  });
