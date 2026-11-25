'use strict';

/**
 * Razorpay + Stripe flows with the HTTP layer stubbed. Exercises the real
 * request building, signature verification and webhook fulfilment.
 */
process.env.PAYMENT_PROVIDER = 'razorpay';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setup, teardown, api, createUser, createPublishedCourse } = require('./helpers');

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

const calls = [];
const realFetch = globalThis.fetch;

describe('payment providers', () => {
  let instructor;
  let paid;

  before(async () => {
    await setup();
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/v1/orders')) {
        return new Response(JSON.stringify({ id: `order_rz_${calls.length}` }), { status: 200 });
      }
      // Payment lookup: report "authorized" so the API has to capture it.
      if (/\/v1\/payments\/[^/]+$/.test(String(url)) && init?.method === 'GET') {
        return new Response(JSON.stringify({ id: 'pay_1', status: 'authorized' }), { status: 200 });
      }
      if (String(url).endsWith('/capture')) {
        return new Response(JSON.stringify({ id: 'pay_1', status: 'captured' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'rfnd_1' }), { status: 200 });
    };
    instructor = await createUser({ role: 'instructor' });
    paid = await createPublishedCourse(instructor, { price: 50000 });
  });
  after(async () => {
    globalThis.fetch = realFetch;
    await teardown();
  });

  it('creates a Razorpay order and verifies the client signature', async () => {
    const s = await createUser();
    const res = await api().post('/api/v1/payments/checkout').set(s.auth).send({ courseId: paid.course._id });
    assert.equal(res.status, 201);
    const { payment, order } = res.body.data;
    assert.equal(payment.provider, 'razorpay');
    assert.equal(payment.keyId, 'rzp_test_key');
    assert.equal(payment.amount, 50000);

    const sent = JSON.parse(calls.at(-1).init.body);
    assert.equal(sent.amount, 50000);
    assert.equal(sent.currency, 'INR');
    assert.match(calls.at(-1).init.headers.Authorization, /^Basic /);

    const forged = await api().post('/api/v1/payments/verify').set(s.auth).send({
      orderId: order._id,
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'deadbeef',
    });
    assert.equal(forged.status, 400);
    assert.equal(forged.body.error.code, 'BAD_SIGNATURE');

    const ok = await api().post('/api/v1/payments/verify').set(s.auth).send({
      orderId: order._id,
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: 'pay_1',
      razorpay_signature: hmac('rzp_test_secret', `${payment.razorpayOrderId}|pay_1`),
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.order.status, 'paid');
    assert.equal(ok.body.data.order.providerPaymentId, 'pay_1');
    const capture = calls.find((c) => c.url.endsWith('/payments/pay_1/capture'));
    assert.ok(capture, 'authorized payment was captured');
    assert.deepEqual(JSON.parse(capture.init.body), { amount: 50000, currency: 'INR' });
  });

  it('fulfils a Razorpay order from a signed webhook (and rejects unsigned ones)', async () => {
    const s = await createUser();
    const res = await api().post('/api/v1/payments/checkout').set(s.auth).send({ courseId: paid.course._id });
    const rzOrderId = res.body.data.payment.razorpayOrderId;
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh', order_id: rzOrderId } } },
    });

    const unsigned = await api().post('/api/v1/payments/webhooks/razorpay').set('Content-Type', 'application/json').send(body);
    assert.equal(unsigned.status, 400);

    const signed = await api()
      .post('/api/v1/payments/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', hmac('rzp_webhook_secret', body))
      .send(body);
    assert.equal(signed.status, 200);
    assert.equal(signed.body.handled, true);

    const order = await api().get(`/api/v1/payments/orders/${res.body.data.order._id}`).set(s.auth);
    assert.equal(order.body.data.order.status, 'paid');
  });

  it('captures and fulfils an authorized-only payment from the webhook (buyer closed the tab)', async () => {
    const s = await createUser();
    const res = await api().post('/api/v1/payments/checkout').set(s.auth).send({ courseId: paid.course._id });
    const rzOrderId = res.body.data.payment.razorpayOrderId;
    const body = JSON.stringify({
      event: 'payment.authorized',
      payload: { payment: { entity: { id: 'pay_auth', order_id: rzOrderId, status: 'authorized' } } },
    });
    const send = () =>
      api()
        .post('/api/v1/payments/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', hmac('rzp_webhook_secret', body))
        .send(body);

    const first = await send();
    assert.equal(first.status, 200);
    const captures = () => calls.filter((c) => c.url.endsWith('/payments/pay_auth/capture')).length;
    assert.equal(captures(), 1, 'the authorized payment was captured');
    const order = await api().get(`/api/v1/payments/orders/${res.body.data.order._id}`).set(s.auth);
    assert.equal(order.body.data.order.status, 'paid');
    const detail = await api().get(`/api/v1/courses/${paid.course._id}`).set(s.auth);
    assert.equal(detail.body.data.viewer.isEnrolled, true);

    // Razorpay retries and also sends payment.captured: nothing is captured or granted twice.
    assert.equal((await send()).status, 200);
    assert.equal(captures(), 1);
  });

  it('fulfils a Stripe checkout session from a signed webhook', async () => {
    const { Order } = require('../src/models');
    const s = await createUser();
    const order = await Order.create({
      user: s.user._id,
      course: paid.course._id,
      instructor: instructor.user._id,
      originalAmount: 50000,
      amount: 50000,
      currency: 'INR',
      provider: 'stripe',
      providerOrderId: 'cs_test_123',
    });
    const body = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123', payment_status: 'paid', payment_intent: 'pi_123' } },
    });
    const t = Math.floor(Date.now() / 1000);

    const stale = await api()
      .post('/api/v1/payments/webhooks/stripe')
      .set('Stripe-Signature', `t=${t - 3600},v1=${hmac('whsec_test', `${t - 3600}.${body}`)}`)
      .send(body);
    assert.equal(stale.status, 400, 'old timestamps are rejected (replay protection)');

    const res = await api()
      .post('/api/v1/payments/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', `t=${t},v1=${hmac('whsec_test', `${t}.${body}`)}`)
      .send(body);
    assert.equal(res.status, 200);
    const updated = await Order.findById(order._id).lean();
    assert.equal(updated.status, 'paid');
    assert.equal(updated.providerPaymentId, 'pi_123');
    const detail = await api().get(`/api/v1/courses/${paid.course._id}`).set(s.auth);
    assert.equal(detail.body.data.viewer.isEnrolled, true);
  });

  it('calls the provider refund API on admin refund', async () => {
    const admin = await createUser({ role: 'admin' });
    const { Order } = require('../src/models');
    const order = await Order.findOne({ provider: 'razorpay', status: 'paid' });
    const before = calls.length;
    const res = await api().post(`/api/v1/admin/orders/${order._id}/refund`).set(admin.auth);
    assert.equal(res.status, 200);
    assert.equal(calls.length, before + 1);
    assert.match(calls.at(-1).url, /\/payments\/pay_.*\/refund$/);
  });

  it('exposes public payment config for the frontend', async () => {
    const res = await api().get('/api/v1/payments/config');
    assert.deepEqual(res.body.data, { provider: 'razorpay', currency: 'INR', razorpayKeyId: 'rzp_test_key' });
  });
});
