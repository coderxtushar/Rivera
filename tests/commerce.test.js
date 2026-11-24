'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, api, createUser, createPublishedCourse, lastMail } = require('./helpers');

describe('enrollment, payments, progress, reviews', () => {
  let instructor;
  let student;
  let admin;
  let paid;
  let free;

  before(async () => {
    await setup();
    [instructor, student, admin] = await Promise.all([createUser({ role: 'instructor' }), createUser(), createUser({ role: 'admin' })]);
    paid = await createPublishedCourse(instructor, { price: 100000, lessons: 2 });
    free = await createPublishedCourse(instructor, { price: 0, lessons: 1 });
  });
  after(teardown);

  it('enrolls in a free course once, and refuses free-enroll on paid courses', async () => {
    const res = await api().post(`/api/v1/courses/${free.course._id}/enroll`).set(student.auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.enrollment.source, 'free');
    const again = await api().post(`/api/v1/payments/checkout`).set(student.auth).send({ courseId: free.course._id });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'ALREADY_ENROLLED');

    const paidEnroll = await api().post(`/api/v1/courses/${paid.course._id}/enroll`).set(student.auth);
    assert.equal(paidEnroll.status, 402);
    assert.ok(lastMail('enrollmentConfirmed'));
  });

  it('instructors cannot buy their own course', async () => {
    const res = await api().post('/api/v1/payments/checkout').set(instructor.auth).send({ courseId: paid.course._id });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'OWN_COURSE');
  });

  it('quotes and applies an instructor coupon', async () => {
    const coupon = await api()
      .post('/api/v1/coupons')
      .set(instructor.auth)
      .send({ code: 'launch25', type: 'percent', value: 25, course: paid.course._id, maxRedemptions: 1 });
    assert.equal(coupon.status, 201);
    assert.equal(coupon.body.data.coupon.code, 'LAUNCH25');

    // Instructors can't make site-wide coupons or coupons on other people's courses.
    assert.equal((await api().post('/api/v1/coupons').set(instructor.auth).send({ code: 'GLOBAL', type: 'percent', value: 10 })).status, 400);

    const q = await api().post('/api/v1/payments/quote').set(student.auth).send({ courseId: paid.course._id, couponCode: 'launch25' });
    assert.equal(q.status, 200);
    assert.deepEqual(
      { originalAmount: q.body.data.originalAmount, discount: q.body.data.discount, amount: q.body.data.amount },
      { originalAmount: 100000, discount: 25000, amount: 75000 },
    );
    const bad = await api().post('/api/v1/payments/quote').set(student.auth).send({ courseId: paid.course._id, couponCode: 'NOPE' });
    assert.equal(bad.status, 422);
    assert.equal(bad.body.error.code, 'COUPON_INVALID');
  });

  it('runs a paid checkout with the mock provider, idempotently', async () => {
    const checkout = await api()
      .post('/api/v1/payments/checkout')
      .set(student.auth)
      .send({ courseId: paid.course.slug, couponCode: 'LAUNCH25' });
    assert.equal(checkout.status, 201);
    assert.equal(checkout.body.data.requiresPayment, true);
    assert.equal(checkout.body.data.payment.provider, 'mock');
    const orderId = checkout.body.data.order._id;
    assert.equal(checkout.body.data.order.amount, 75000);
    assert.equal(checkout.body.data.order.platformFee, 15000);
    assert.equal(checkout.body.data.order.instructorEarning, 60000);

    // Not enrolled until paid.
    assert.equal((await api().get(`/api/v1/courses/${paid.course._id}/progress`).set(student.auth)).status, 403);

    const someoneElse = await createUser();
    assert.equal((await api().post('/api/v1/payments/verify').set(someoneElse.auth).send({ orderId })).status, 404);

    const v1 = await api().post('/api/v1/payments/verify').set(student.auth).send({ orderId });
    const v2 = await api().post('/api/v1/payments/verify').set(student.auth).send({ orderId });
    assert.equal(v1.status, 200);
    assert.equal(v1.body.data.order.status, 'paid');
    assert.equal(v2.body.data.order.status, 'paid');

    const detail = await api().get(`/api/v1/courses/${paid.course._id}`).set(student.auth);
    assert.equal(detail.body.data.viewer.isEnrolled, true);
    assert.equal(detail.body.data.course.stats.enrollmentCount, 1, 'counted exactly once');

    const orders = await api().get('/api/v1/users/me/orders').set(student.auth);
    assert.equal(orders.body.data.length, 1);
    assert.equal(orders.body.data[0].instructorEarning, undefined, 'buyers do not see revenue split');

    // Coupon was single-use.
    const another = await createUser();
    const q = await api().post('/api/v1/payments/quote').set(another.auth).send({ courseId: paid.course._id, couponCode: 'LAUNCH25' });
    assert.equal(q.status, 422);
  });

  it('gives enrolled students the full curriculum and tracks progress to a certificate', async () => {
    const cur = await api().get(`/api/v1/courses/${paid.course._id}/curriculum`).set(student.auth);
    assert.equal(cur.status, 200);
    assert.equal(cur.body.data.curriculum[0].lessons[1].videoUrl, 'https://example.com/v.mp4');

    const [l1, l2] = paid.lessons;
    const p1 = await api().post(`/api/v1/courses/${paid.course._id}/lessons/${l1._id}/complete`).set(student.auth);
    assert.equal(p1.body.data.progress.percent, 50);
    assert.equal(p1.body.data.certificate, null);

    const undo = await api().delete(`/api/v1/courses/${paid.course._id}/lessons/${l1._id}/complete`).set(student.auth);
    assert.equal(undo.body.data.progress.percent, 0);

    await api().post(`/api/v1/courses/${paid.course._id}/lessons/${l1._id}/complete`).set(student.auth);
    const done = await api().post(`/api/v1/courses/${paid.course._id}/lessons/${l2._id}/complete`).set(student.auth);
    assert.equal(done.body.data.progress.percent, 100);
    assert.ok(done.body.data.progress.completedAt);
    const code = done.body.data.certificate.code;
    assert.match(code, /^RIV-[A-F0-9]{10}$/);

    const verify = await api().get(`/api/v1/certificates/${code}`);
    assert.equal(verify.status, 200);
    assert.equal(verify.body.data.certificate.courseTitle, paid.course.title);
    assert.equal((await api().get('/api/v1/certificates/RIV-0000000000')).status, 404);

    const mine = await api().get('/api/v1/users/me/certificates').set(student.auth);
    assert.equal(mine.body.data.length, 1);

    const enrollments = await api().get('/api/v1/users/me/enrollments').set(student.auth);
    assert.equal(enrollments.body.data.length, 2);
    assert.ok(enrollments.body.data[0].course.title);
  });

  it('lets enrolled students review once and keeps course rating in sync', async () => {
    const outsider = await createUser();
    assert.equal((await api().post(`/api/v1/courses/${paid.course._id}/reviews`).set(outsider.auth).send({ rating: 1 })).status, 403);

    const r = await api().post(`/api/v1/courses/${paid.course._id}/reviews`).set(student.auth).send({ rating: 4, comment: 'Great' });
    assert.equal(r.status, 201);
    assert.equal((await api().post(`/api/v1/courses/${paid.course._id}/reviews`).set(student.auth).send({ rating: 5 })).status, 409);

    const second = await createUser();
    await api().post('/api/v1/admin/enrollments').set(admin.auth).send({ userId: second.user._id, courseId: paid.course._id });
    await api().post(`/api/v1/courses/${paid.course._id}/reviews`).set(second.auth).send({ rating: 1 });

    let list = await api().get(`/api/v1/courses/${paid.course._id}/reviews`);
    assert.equal(list.body.meta.ratingAvg, 2.5);
    assert.equal(list.body.meta.ratingCount, 2);
    assert.deepEqual(list.body.meta.distribution, { 1: 1, 2: 0, 3: 0, 4: 1, 5: 0 });

    const reviewId = r.body.data.review._id;
    assert.equal((await api().patch(`/api/v1/reviews/${reviewId}`).set(second.auth).send({ rating: 5 })).status, 403);
    await api().patch(`/api/v1/reviews/${reviewId}`).set(student.auth).send({ rating: 5 });
    list = await api().get(`/api/v1/courses/${paid.course._id}/reviews`);
    assert.equal(list.body.meta.ratingAvg, 3);

    const reply = await api().put(`/api/v1/reviews/${reviewId}/reply`).set(instructor.auth).send({ text: 'Thanks!' });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.review.instructorReply.text, 'Thanks!');
    assert.equal((await api().put(`/api/v1/reviews/${reviewId}/reply`).set(student.auth).send({ text: 'x' })).status, 403);
  });

  it('manages a wishlist', async () => {
    const s = await createUser();
    assert.equal((await api().put(`/api/v1/users/me/wishlist/${paid.course._id}`).set(s.auth)).status, 204);
    assert.equal((await api().put(`/api/v1/users/me/wishlist/${paid.course._id}`).set(s.auth)).status, 204);
    let list = await api().get('/api/v1/users/me/wishlist').set(s.auth);
    assert.equal(list.body.data.length, 1);
    const detail = await api().get(`/api/v1/courses/${paid.course._id}`).set(s.auth);
    assert.equal(detail.body.data.viewer.isWishlisted, true);
    await api().delete(`/api/v1/users/me/wishlist/${paid.course._id}`).set(s.auth);
    list = await api().get('/api/v1/users/me/wishlist').set(s.auth);
    assert.equal(list.body.data.length, 0);
  });

  it('a 100% coupon enrolls without payment', async () => {
    await api().post('/api/v1/coupons').set(admin.auth).send({ code: 'FREEBIE', type: 'percent', value: 100 });
    const s = await createUser();
    const res = await api().post('/api/v1/payments/checkout').set(s.auth).send({ courseId: paid.course._id, couponCode: 'FREEBIE' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.requiresPayment, false);
    assert.equal(res.body.data.order.status, 'paid');
    assert.equal(res.body.data.enrollment.source, 'purchase');
  });

  it('shows instructor stats and students, and refuses to delete a course with students', async () => {
    const stats = await api().get('/api/v1/instructor/stats').set(instructor.auth);
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.courses.published, 2);
    assert.ok(stats.body.data.students >= 3);
    const inr = stats.body.data.revenue.find((r) => r.currency === 'INR');
    assert.equal(inr.gross, 75000);
    assert.equal(inr.earnings, 60000);
    assert.equal(stats.body.data.monthly.length, 1);
    assert.equal(stats.body.data.perCourse[0].course.title, paid.course.title);

    const students = await api().get(`/api/v1/courses/${paid.course._id}/students`).set(instructor.auth);
    assert.ok(students.body.data.length >= 3);
    assert.equal((await api().get(`/api/v1/courses/${paid.course._id}/students`).set(student.auth)).status, 403);

    const del = await api().delete(`/api/v1/courses/${paid.course._id}`).set(instructor.auth);
    assert.equal(del.status, 409);
    assert.equal(del.body.error.code, 'COURSE_HAS_STUDENTS');
  });

  it('archived courses leave the catalog but enrolled students keep access', async () => {
    await api().post(`/api/v1/courses/${free.course._id}/archive`).set(instructor.auth);
    const catalog = await api().get('/api/v1/courses');
    assert.ok(!catalog.body.data.some((c) => c._id === free.course._id));
    assert.equal((await api().get(`/api/v1/courses/${free.course._id}`)).status, 404);
    assert.equal((await api().get(`/api/v1/courses/${free.course._id}/curriculum`).set(student.auth)).status, 200);
  });

  it('admin refund revokes access and appears in stats', async () => {
    const orders = await api().get('/api/v1/admin/orders').set(admin.auth).query({ status: 'paid' });
    const order = orders.body.data.find((o) => o.user._id === String(student.user._id));
    const refund = await api().post(`/api/v1/admin/orders/${order._id}/refund`).set(admin.auth);
    assert.equal(refund.status, 200);
    assert.equal(refund.body.data.order.status, 'refunded');
    assert.equal((await api().post(`/api/v1/admin/orders/${order._id}/refund`).set(admin.auth)).status, 409);
    assert.equal((await api().get(`/api/v1/courses/${paid.course._id}/progress`).set(student.auth)).status, 403);

    const stats = await api().get('/api/v1/admin/stats').set(admin.auth);
    assert.equal(stats.status, 200);
    assert.ok(stats.body.data.users.byRole.student >= 1);
    assert.equal((await api().get('/api/v1/admin/stats').set(student.auth)).status, 403);
  });
});
