'use strict';

/** Regression tests for issues found in code review (payment edge cases, lifecycle). */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, api, createUser, createPublishedCourse } = require('./helpers');

describe('regressions', () => {
  let instructor;
  let admin;

  before(async () => {
    await setup();
    [instructor, admin] = await Promise.all([createUser({ role: 'instructor' }), createUser({ role: 'admin' })]);
  });
  after(teardown);

  const checkout = (u, body) => api().post('/api/v1/payments/checkout').set(u.auth).send(body);
  const verify = (u, orderId) => api().post('/api/v1/payments/verify').set(u.auth).send({ orderId });

  it('a second checkout supersedes the first, and a duplicate payment is never kept', async () => {
    const { Order } = require('../src/models');
    const { fulfillOrder } = require('../src/services/payments/order.service');
    const { course } = await createPublishedCourse(instructor, { price: 100000 });
    const s = await createUser();

    const tab1 = (await checkout(s, { courseId: course._id })).body.data.order;
    const tab2 = (await checkout(s, { courseId: course._id })).body.data.order;
    assert.equal((await Order.findById(tab1._id)).status, 'failed', 'older unpaid order superseded');
    assert.equal((await verify(s, tab1._id)).status, 409, 'superseded mock order cannot be paid');

    assert.equal((await verify(s, tab2._id)).body.data.order.status, 'paid');
    // Simulate the provider capturing money for the superseded order anyway (e.g. a late webhook).
    const dup = await fulfillOrder(tab1._id, 'pay_dup');
    assert.equal(dup.status, 'failed', 'mock has no money to refund, so it is cancelled');
    assert.match(dup.failureReason, /Duplicate/);

    const detail = await api().get(`/api/v1/courses/${course._id}`).set(s.auth);
    assert.equal(detail.body.data.course.stats.enrollmentCount, 1);
    const stats = await api().get('/api/v1/instructor/stats').set(instructor.auth);
    assert.equal(stats.body.data.revenue[0].sales, 1, 'only one sale counted');
  });

  it('orders paid after they expire are cancelled instead of honouring an old price', async () => {
    const { Order } = require('../src/models');
    const { course } = await createPublishedCourse(instructor, { price: 100000 });
    const s = await createUser();
    const order = (await checkout(s, { courseId: course._id })).body.data.order;
    await Order.updateOne({ _id: order._id }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await verify(s, order._id);
    assert.equal(res.body.data.order.status, 'failed');
    assert.equal((await api().get(`/api/v1/courses/${course._id}/progress`).set(s.auth)).status, 403);
  });

  it('coupon redemption limits are enforced at payment time', async () => {
    const { course } = await createPublishedCourse(instructor, { price: 100000 });
    await api().post('/api/v1/coupons').set(instructor.auth).send({ code: 'ONLYONE', type: 'percent', value: 50, course: course._id, maxRedemptions: 1 });
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const oa = (await checkout(a, { courseId: course._id, couponCode: 'ONLYONE' })).body.data.order;
    const ob = (await checkout(b, { courseId: course._id, couponCode: 'ONLYONE' })).body.data.order;
    assert.equal((await verify(a, oa._id)).body.data.order.status, 'paid');
    const second = (await verify(b, ob._id)).body.data.order;
    assert.equal(second.status, 'failed');
    assert.match(second.failureReason, /Coupon/);
    const { Coupon } = require('../src/models');
    assert.equal((await Coupon.findOne({ code: 'ONLYONE' })).redemptionCount, 1);
  });

  it('a 100% coupon that is exhausted returns an error instead of a half-made order', async () => {
    const { course } = await createPublishedCourse(instructor, { price: 100000 });
    await api().post('/api/v1/coupons').set(instructor.auth).send({ code: 'FULLFREE', type: 'percent', value: 100, course: course._id, maxRedemptions: 1 });
    const [a, b] = await Promise.all([createUser(), createUser()]);
    assert.equal((await checkout(a, { courseId: course._id, couponCode: 'FULLFREE' })).status, 201);
    const res = await checkout(b, { courseId: course._id, couponCode: 'FULLFREE' });
    assert.equal(res.status, 422);
  });

  it('refunding an order never revokes access granted some other way', async () => {
    const { Order } = require('../src/models');
    const { course } = await createPublishedCourse(instructor, { price: 100000 });
    const s = await createUser();
    const order = (await checkout(s, { courseId: course._id })).body.data.order;
    await verify(s, order._id);
    // Admin also grants access separately; then a stray second paid order exists.
    const strayOrder = await Order.create({
      user: s.user._id, course: course._id, instructor: instructor.user._id,
      originalAmount: 100000, amount: 100000, currency: 'INR', provider: 'mock', status: 'paid', paidAt: new Date(),
    });
    assert.equal((await api().post(`/api/v1/admin/orders/${strayOrder._id}/refund`).set(admin.auth)).status, 200);
    assert.equal((await api().get(`/api/v1/courses/${course._id}/progress`).set(s.auth)).status, 200, 'still enrolled via the real order');

    // Concurrent refunds of the real order: exactly one succeeds.
    const results = await Promise.all([
      api().post(`/api/v1/admin/orders/${order._id}/refund`).set(admin.auth),
      api().post(`/api/v1/admin/orders/${order._id}/refund`).set(admin.auth),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await api().get(`/api/v1/courses/${course._id}/progress`).set(s.auth)).status, 403);
  });

  it('a demoted instructor can no longer manage their courses', async () => {
    const teacher = await createUser({ role: 'instructor' });
    const { course } = await createPublishedCourse(teacher, { price: 0 });
    await api().patch(`/api/v1/admin/users/${teacher.user._id}`).set(admin.auth).send({ role: 'student', instructorStatus: 'rejected' });
    const res = await api().patch(`/api/v1/courses/${course._id}`).set(teacher.auth).send({ title: 'Still mine?' });
    assert.equal(res.status, 403);
  });

  it('progress is recomputed when lessons are removed, issuing earned certificates', async () => {
    const { course, lessons } = await createPublishedCourse(instructor, { price: 0, lessons: 3 });
    const s = await createUser();
    await api().post(`/api/v1/courses/${course._id}/enroll`).set(s.auth);
    await api().post(`/api/v1/courses/${course._id}/lessons/${lessons[0]._id}/complete`).set(s.auth);
    await api().post(`/api/v1/courses/${course._id}/lessons/${lessons[1]._id}/complete`).set(s.auth);
    let p = await api().get(`/api/v1/courses/${course._id}/progress`).set(s.auth);
    assert.equal(p.body.data.progress.percent, 67);

    await api().delete(`/api/v1/courses/${course._id}/lessons/${lessons[2]._id}`).set(instructor.auth);
    p = await api().get(`/api/v1/courses/${course._id}/progress`).set(s.auth);
    assert.equal(p.body.data.progress.percent, 100);
    assert.ok(p.body.data.progress.completedAt);
    assert.equal((await api().get('/api/v1/users/me/certificates').set(s.auth)).body.data.length, 1);
  });

  it('deleting an account keeps course counters consistent', async () => {
    const { course } = await createPublishedCourse(instructor, { price: 0 });
    const s = await createUser();
    await api().post(`/api/v1/courses/${course._id}/enroll`).set(s.auth);
    await api().post(`/api/v1/courses/${course._id}/reviews`).set(s.auth).send({ rating: 1 });
    assert.equal((await api().delete('/api/v1/users/me').set(s.auth).send({ password: 'password123' })).status, 204);
    const detail = await api().get(`/api/v1/courses/${course._id}`);
    assert.equal(detail.body.data.course.stats.enrollmentCount, 0);
    assert.equal(detail.body.data.course.stats.ratingCount, 0);
  });

  it('instructors with enrolled students cannot delete their account', async () => {
    const teacher = await createUser({ role: 'instructor' });
    const { course } = await createPublishedCourse(teacher, { price: 0 });
    const s = await createUser();
    await api().post(`/api/v1/courses/${course._id}/enroll`).set(s.auth);
    await api().post(`/api/v1/courses/${course._id}/archive`).set(teacher.auth);
    const res = await api().delete('/api/v1/users/me').set(teacher.auth).send({ password: 'password123' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'HAS_ENROLLED_STUDENTS');
  });

  it('rejects malformed signout bodies with 400, not 500', async () => {
    const res = await api().post('/api/v1/auth/signout').send({ refreshToken: { a: 1 } });
    assert.equal(res.status, 400);
  });

  it('returns the refresh token in the body only when asked via X-Auth-Transport', async () => {
    const u = await createUser();
    const plain = await api().post('/api/v1/auth/signin').send({ email: u.user.email, password: 'password123' });
    assert.equal(plain.body.data.refreshToken, undefined);
    const token = await api().post('/api/v1/auth/signin').set('X-Auth-Transport', 'token').send({ email: u.user.email, password: 'password123' });
    assert.ok(token.body.data.refreshToken);
    const refreshed = await api().post('/api/v1/auth/refresh').set('X-Auth-Transport', 'token').send({ refreshToken: token.body.data.refreshToken });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.data.refreshToken);
  });

  it('never discounts a paid course below the gateway minimum of 100', async () => {
    const { course } = await createPublishedCourse(instructor, { price: 10000 });
    await api().post('/api/v1/coupons').set(instructor.auth).send({ code: 'ALMOSTFREE', type: 'fixed', value: 9950, course: course._id });
    const s = await createUser();
    const q = await api().post('/api/v1/payments/quote').set(s.auth).send({ courseId: course._id, couponCode: 'ALMOSTFREE' });
    assert.equal(q.body.data.amount, 100);
    assert.equal(q.body.data.discount, 9900);
    const tooCheap = await api().post('/api/v1/courses').set(instructor.auth).send({ title: 'Fifty paise course', price: 50 });
    assert.equal(tooCheap.status, 400);
  });

  it('does not expose student emails to instructors', async () => {
    const { course } = await createPublishedCourse(instructor, { price: 0 });
    const s = await createUser();
    await api().post(`/api/v1/courses/${course._id}/enroll`).set(s.auth);
    const res = await api().get(`/api/v1/courses/${course._id}/students`).set(instructor.auth);
    assert.equal(res.body.data[0].user.email, undefined);
  });
});
