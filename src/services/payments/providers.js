'use strict';

/**
 * Payment providers behind one interface:
 *
 *   createCheckout({ order, course, user }) → { providerOrderId, clientPayload }
 *   verifyClientPayment(order, body)        → providerPaymentId   (throws if invalid)
 *   parseWebhook(rawBody, headers)          → { event, providerOrderId, providerPaymentId } | null
 *   refund(order)                           → void
 *
 * Razorpay and Stripe are called through their REST APIs with `fetch`, so no
 * SDKs are needed. Both offer free test modes.
 */
const env = require('../../config/env');
const ApiError = require('../../lib/ApiError');
const { hmacSha256Hex, safeEqual, randomToken } = require('../../lib/util');

async function callApi(url, { method = 'POST', headers, body }) {
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', `Payment provider unreachable: ${err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description || data?.error?.message || `HTTP ${res.status}`;
    throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', `Payment provider error: ${msg}`);
  }
  return data;
}

/* ------------------------------------------------------------------ mock */

const mock = {
  name: 'mock',
  async createCheckout({ order }) {
    const providerOrderId = `mock_order_${randomToken(9)}`;
    return {
      providerOrderId,
      clientPayload: {
        provider: 'mock',
        hint: 'Development provider: POST /api/v1/payments/verify with { orderId } to simulate a successful payment.',
        orderId: String(order._id),
      },
    };
  },
  async verifyClientPayment() {
    return `mock_pay_${randomToken(9)}`;
  },
  parseWebhook() {
    return null;
  },
  async refund() {},
};

/* -------------------------------------------------------------- razorpay */

const razorpayAuth = () =>
  `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;

const razorpay = {
  name: 'razorpay',
  async createCheckout({ order, course, user }) {
    const rzOrder = await callApi('https://api.razorpay.com/v1/orders', {
      headers: { Authorization: razorpayAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: order.amount,
        currency: order.currency,
        receipt: String(order._id),
        notes: { orderId: String(order._id), courseId: String(course._id) },
      }),
    });
    return {
      providerOrderId: rzOrder.id,
      clientPayload: {
        provider: 'razorpay',
        orderId: String(order._id),
        // Pass these straight to Razorpay Checkout (checkout.razorpay.com/v1/checkout.js).
        keyId: env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzOrder.id,
        amount: order.amount,
        currency: order.currency,
        name: 'Rivera',
        description: course.title,
        prefill: { name: [user.firstName, user.lastName].filter(Boolean).join(' '), email: user.email },
      },
    };
  },
  /** Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature } from the Checkout handler. */
  async verifyClientPayment(order, body) {
    const { razorpay_order_id: rzOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (!rzOrderId || !paymentId || !signature) {
      throw ApiError.badRequest('razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
    }
    if (rzOrderId !== order.providerOrderId) throw ApiError.badRequest('Payment does not belong to this order');
    const expected = hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${rzOrderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) throw ApiError.badRequest('Invalid payment signature', undefined, 'BAD_SIGNATURE');
    return paymentId;
  },
  parseWebhook(rawBody, headers) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) throw ApiError.unavailable('Razorpay webhook secret not configured');
    const signature = headers['x-razorpay-signature'];
    if (!safeEqual(hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature || '')) {
      throw ApiError.badRequest('Invalid webhook signature', undefined, 'BAD_SIGNATURE');
    }
    const evt = JSON.parse(rawBody.toString('utf8'));
    const payment = evt.payload?.payment?.entity;
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
      return {
        event: 'paid',
        providerOrderId: evt.payload?.order?.entity?.id || payment?.order_id,
        providerPaymentId: payment?.id,
      };
    }
    if (evt.event === 'payment.failed') {
      return { event: 'failed', providerOrderId: payment?.order_id, reason: payment?.error_description };
    }
    return null;
  },
  async refund(order) {
    if (!order.providerPaymentId) return;
    await callApi(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.providerPaymentId)}/refund`, {
      headers: { Authorization: razorpayAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: order.amount }),
    });
  },
};

/* ---------------------------------------------------------------- stripe */

const stripeForm = (obj) => new URLSearchParams(obj).toString();
const stripeHeaders = () => ({
  Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
  'Content-Type': 'application/x-www-form-urlencoded',
});

/** Verify a `Stripe-Signature` header (t=…,v1=…) against the raw body. */
function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.groupBy(String(header || '').split(','), (p) => p.split('=')[0]);
  const t = parts.t?.[0]?.slice(2);
  const sigs = (parts.v1 || []).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = hmacSha256Hex(secret, `${t}.${rawBody.toString('utf8')}`);
  return sigs.some((s) => safeEqual(expected, s));
}

const stripe = {
  name: 'stripe',
  async createCheckout({ order, course, user }) {
    const session = await callApi('https://api.stripe.com/v1/checkout/sessions', {
      headers: stripeHeaders(),
      body: stripeForm({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': order.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(order.amount),
        'line_items[0][price_data][product_data][name]': course.title,
        customer_email: user.email,
        client_reference_id: String(order._id),
        expires_at: String(Math.floor((order.expiresAt?.getTime() || Date.now() + 3600_000) / 1000)),
        'metadata[orderId]': String(order._id),
        success_url: `${env.CLIENT_URL}/checkout/success?orderId=${order._id}`,
        cancel_url: `${env.CLIENT_URL}/courses/${course.slug}?checkout=cancelled`,
      }),
    });
    return {
      providerOrderId: session.id,
      clientPayload: { provider: 'stripe', orderId: String(order._id), checkoutUrl: session.url },
    };
  },
  async verifyClientPayment() {
    // Stripe completes via webhook; the client polls GET /payments/orders/:id.
    throw ApiError.badRequest('Stripe payments are confirmed by webhook; poll the order status instead');
  },
  parseWebhook(rawBody, headers) {
    if (!env.STRIPE_WEBHOOK_SECRET) throw ApiError.unavailable('Stripe webhook secret not configured');
    if (!verifyStripeSignature(rawBody, headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)) {
      throw ApiError.badRequest('Invalid webhook signature', undefined, 'BAD_SIGNATURE');
    }
    const evt = JSON.parse(rawBody.toString('utf8'));
    const session = evt.data?.object;
    if (
      (evt.type === 'checkout.session.completed' && session?.payment_status === 'paid') ||
      evt.type === 'checkout.session.async_payment_succeeded'
    ) {
      return { event: 'paid', providerOrderId: session.id, providerPaymentId: session.payment_intent };
    }
    if (evt.type === 'checkout.session.expired' || evt.type === 'checkout.session.async_payment_failed') {
      return { event: 'failed', providerOrderId: session.id, reason: evt.type };
    }
    return null;
  },
  async refund(order) {
    if (!order.providerPaymentId) return;
    await callApi('https://api.stripe.com/v1/refunds', {
      headers: stripeHeaders(),
      body: stripeForm({ payment_intent: order.providerPaymentId }),
    });
  },
};

const providers = { mock, razorpay, stripe };

function activeProvider() {
  return providers[env.PAYMENT_PROVIDER];
}

function providerByName(name) {
  const p = providers[name];
  if (!p) throw ApiError.badRequest(`Unknown payment provider: ${name}`);
  return p;
}

module.exports = { activeProvider, providerByName, verifyStripeSignature };
