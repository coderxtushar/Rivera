'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, api, createUser, createPublishedCourse } = require('./helpers');

describe('courses & curriculum', () => {
  let instructor;
  let other;
  let student;
  let admin;
  let category;

  before(async () => {
    await setup();
    [instructor, other, student, admin] = await Promise.all([
      createUser({ role: 'instructor' }),
      createUser({ role: 'instructor' }),
      createUser(),
      createUser({ role: 'admin' }),
    ]);
    const cat = await api().post('/api/v1/categories').set(admin.auth).send({ name: 'Web Development' });
    category = cat.body.data.category;
  });
  after(teardown);

  it('only instructors/admins can create courses; protected fields are ignored', async () => {
    const denied = await api().post('/api/v1/courses').set(student.auth).send({ title: 'Nope course' });
    assert.equal(denied.status, 403);

    const res = await api()
      .post('/api/v1/courses')
      .set(instructor.auth)
      .send({ title: 'Node.js from Zero', price: 99900, category: category._id, status: 'published', stats: { enrollmentCount: 999 } });
    assert.equal(res.status, 201);
    const c = res.body.data.course;
    assert.equal(c.slug, 'node-js-from-zero');
    assert.equal(c.status, 'draft');
    assert.equal(c.stats.enrollmentCount, 0);
    assert.equal(c.currency, 'INR');
    assert.equal(c.isFree, false);
  });

  it('builds a curriculum, enforces publish rules, and keeps drafts private', async () => {
    const { body } = await api().post('/api/v1/courses').set(instructor.auth).send({ title: 'Draft Course Here' });
    const id = body.data.course._id;

    const early = await api().post(`/api/v1/courses/${id}/publish`).set(instructor.auth);
    assert.equal(early.status, 422);
    assert.equal(early.body.error.code, 'NOT_PUBLISHABLE');
    assert.equal(early.body.error.details.length, 3);

    // Drafts are invisible to the public and to other instructors.
    assert.equal((await api().get(`/api/v1/courses/${id}`)).status, 404);
    assert.equal((await api().get(`/api/v1/courses/${id}`).set(other.auth)).status, 404);
    assert.equal((await api().patch(`/api/v1/courses/${id}`).set(other.auth).send({ title: 'Hijacked!' })).status, 403);

    const s1 = (await api().post(`/api/v1/courses/${id}/sections`).set(instructor.auth).send({ title: 'One' })).body.data.section;
    const s2 = (await api().post(`/api/v1/courses/${id}/sections`).set(instructor.auth).send({ title: 'Two' })).body.data.section;
    const l1 = (await api().post(`/api/v1/courses/${id}/sections/${s1._id}/lessons`).set(instructor.auth).send({ title: 'A', durationSec: 60 })).body.data.lesson;
    const l2 = (await api().post(`/api/v1/courses/${id}/sections/${s1._id}/lessons`).set(instructor.auth).send({ title: 'B', durationSec: 120 })).body.data.lesson;
    assert.equal(l2.order, 1);

    // Reorder sections and lessons.
    const so = await api().put(`/api/v1/courses/${id}/sections/order`).set(instructor.auth).send({ sectionIds: [s2._id, s1._id] });
    assert.equal(so.status, 200);
    assert.equal(so.body.data.sections[0]._id, s2._id);
    const badOrder = await api().put(`/api/v1/courses/${id}/sections/order`).set(instructor.auth).send({ sectionIds: [s2._id] });
    assert.equal(badOrder.status, 400);
    const lo = await api().put(`/api/v1/courses/${id}/sections/${s1._id}/lessons/order`).set(instructor.auth).send({ lessonIds: [l2._id, l1._id] });
    assert.deepEqual(lo.body.data.lessons.map((l) => l.title), ['B', 'A']);

    // Move a lesson to another section.
    const moved = await api().patch(`/api/v1/courses/${id}/lessons/${l1._id}`).set(instructor.auth).send({ sectionId: s2._id });
    assert.equal(moved.body.data.lesson.section, s2._id);

    await api()
      .patch(`/api/v1/courses/${id}`)
      .set(instructor.auth)
      .send({ description: 'This description is long enough to satisfy the publishing rule for courses.' });
    const pub = await api().post(`/api/v1/courses/${id}/publish`).set(instructor.auth);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.data.course.stats.lessonCount, 2);
    assert.equal(pub.body.data.course.stats.totalDurationSec, 180);

    const detail = await api().get(`/api/v1/courses/${pub.body.data.course.slug}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.data.curriculum.map((s) => s.title), ['Two', 'One']);
    assert.equal(detail.body.data.viewer, null);

    // Slug is frozen once published.
    const renamed = await api().patch(`/api/v1/courses/${id}`).set(instructor.auth).send({ title: 'Brand New Name' });
    assert.equal(renamed.body.data.course.slug, pub.body.data.course.slug);
  });

  it('hides lesson content from non-enrolled users except previews', async () => {
    const { course, lessons } = await createPublishedCourse(instructor, { lessons: 2 });
    const detail = await api().get(`/api/v1/courses/${course._id}`);
    const outline = detail.body.data.curriculum[0].lessons[0];
    assert.equal(outline.videoUrl, undefined);
    assert.equal(outline.content, undefined);

    const preview = await api().get(`/api/v1/courses/${course._id}/lessons/${lessons[0]._id}`);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.lesson.videoUrl, 'https://example.com/v.mp4');

    const locked = await api().get(`/api/v1/courses/${course._id}/lessons/${lessons[1]._id}`).set(student.auth);
    assert.equal(locked.status, 403);
    assert.equal(locked.body.error.code, 'NOT_ENROLLED');

    const owner = await api().get(`/api/v1/courses/${course._id}/lessons/${lessons[1]._id}`).set(instructor.auth);
    assert.equal(owner.status, 200);
    assert.equal((await api().get(`/api/v1/courses/${course._id}/curriculum`).set(student.auth)).status, 403);
  });

  it('searches, filters, sorts and paginates the catalog', async () => {
    await createPublishedCourse(other, { title: 'Advanced Python Patterns', price: 0 });
    await createPublishedCourse(other, { title: 'Python for Beginners', price: 19900 });
    await createPublishedCourse(other, { title: 'Rust Systems Programming', price: 299900 });

    const search = await api().get('/api/v1/courses').query({ q: 'python' });
    assert.equal(search.status, 200);
    assert.equal(search.body.data.length, 2);
    assert.ok(search.body.data.every((c) => /python/i.test(c.title)));
    assert.ok(search.body.data[0].instructor.firstName);

    const free = await api().get('/api/v1/courses').query({ free: 'true' });
    assert.ok(free.body.data.length >= 1);
    assert.ok(free.body.data.every((c) => c.price === 0));

    const range = await api().get('/api/v1/courses').query({ minPrice: 10000, maxPrice: 100000, sort: 'price_asc' });
    const prices = range.body.data.map((c) => c.price);
    assert.ok(prices.every((p) => p >= 10000 && p <= 100000));
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

    const page = await api().get('/api/v1/courses').query({ limit: 2, page: 1 });
    assert.equal(page.body.data.length, 2);
    assert.ok(page.body.meta.total >= 5);
    assert.equal(page.body.meta.totalPages, Math.ceil(page.body.meta.total / 2));

    assert.ok((await api().get('/api/v1/courses')).body.data.every((c) => c.status === 'published'));
    assert.equal((await api().get('/api/v1/courses').query({ category: 'no-such-category' })).body.data.length, 0);
    assert.equal((await api().get('/api/v1/courses').query({ sort: 'bogus' })).status, 400);
  });

  it('leaves out courses the signed-in viewer already owns when asked', async () => {
    const { course } = await createPublishedCourse(instructor, { title: 'Owned Course Example', price: 0 });
    const viewer = await createUser();
    assert.equal((await api().post(`/api/v1/courses/${course._id}/enroll`).set(viewer.auth)).status, 201);

    const ids = (res) => res.body.data.map((c) => c._id);
    const q = { q: 'owned', excludeEnrolled: 'true' };
    const mine = await api().get('/api/v1/courses').query(q).set(viewer.auth);
    assert.equal(mine.status, 200);
    assert.ok(!ids(mine).includes(course._id), 'owned course is hidden');
    assert.equal(mine.body.meta.total, 0, 'totals match the filtered list');

    // Without the flag, for other users, and for anonymous visitors, it still shows.
    assert.ok(ids(await api().get('/api/v1/courses').query({ q: 'owned' }).set(viewer.auth)).includes(course._id));
    assert.ok(ids(await api().get('/api/v1/courses').query(q).set(student.auth)).includes(course._id));
    assert.ok(ids(await api().get('/api/v1/courses').query(q)).includes(course._id));
  });

  it('filters by category slug and reports category course counts', async () => {
    const { course } = await createPublishedCourse(instructor, { title: 'Categorised Course' });
    await api().patch(`/api/v1/courses/${course._id}`).set(instructor.auth).send({ category: category._id });
    const res = await api().get('/api/v1/courses').query({ category: 'web-development' });
    assert.ok(res.body.data.some((c) => c._id === course._id));
    const cats = await api().get('/api/v1/categories');
    assert.equal(cats.body.data.find((c) => c.slug === 'web-development').courseCount, 1);
  });

  it('deleting a section cascades to its lessons and updates stats', async () => {
    const { course, section } = await createPublishedCourse(instructor, { lessons: 3 });
    const s2 = (await api().post(`/api/v1/courses/${course._id}/sections`).set(instructor.auth).send({ title: 'Extra' })).body.data.section;
    await api().post(`/api/v1/courses/${course._id}/sections/${s2._id}/lessons`).set(instructor.auth).send({ title: 'X', durationSec: 10 });
    const del = await api().delete(`/api/v1/courses/${course._id}/sections/${section._id}`).set(instructor.auth);
    assert.equal(del.status, 204);
    const detail = await api().get(`/api/v1/courses/${course._id}`);
    assert.equal(detail.body.data.course.stats.lessonCount, 1);
    assert.equal(detail.body.data.curriculum.length, 1);
  });

  it('lists an instructor\'s own courses in every status', async () => {
    const res = await api().get('/api/v1/instructor/courses').set(instructor.auth);
    assert.equal(res.status, 200);
    const statuses = new Set(res.body.data.map((c) => c.status));
    assert.ok(statuses.has('draft') && statuses.has('published'));
    assert.equal((await api().get('/api/v1/instructor/courses').set(student.auth)).status, 403);
  });

  it('accepts site-relative cover images but rejects other schemes', async () => {
    const { body } = await api().post('/api/v1/courses').set(instructor.auth).send({ title: 'Cover path course' });
    const id = body.data.course._id;
    const ok = await api().patch(`/api/v1/courses/${id}`).set(instructor.auth).send({ thumbnailUrl: '/covers/cover-path-course.jpg' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.course.thumbnailUrl, '/covers/cover-path-course.jpg');
    for (const bad of ['//evil.example/x.jpg', 'javascript:alert(1)', 'ftp://x/y.jpg']) {
      // eslint-disable-next-line no-await-in-loop
      assert.equal((await api().patch(`/api/v1/courses/${id}`).set(instructor.auth).send({ thumbnailUrl: bad })).status, 400, bad);
    }
  });

  it('returns consistent errors for bad ids and unknown routes', async () => {
    const notFound = await api().get('/api/v1/does-not-exist');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.error.code, 'ROUTE_NOT_FOUND');
    const badJson = await api().post('/api/v1/auth/signin').set('Content-Type', 'application/json').send('{bad');
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.error.code, 'INVALID_JSON');
    const badId = await api().get('/api/v1/users/not-an-id/profile');
    assert.equal(badId.status, 400);
  });

  it('serves a public instructor profile with published courses only', async () => {
    const res = await api().get(`/api/v1/users/${other.user._id}/profile`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, undefined);
    assert.equal(res.body.data.courses.length, 3);
    assert.ok(res.body.data.courses.every((c) => c.status === 'published'));
  });
});
