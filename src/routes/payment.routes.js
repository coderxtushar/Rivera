'use strict';

const express = require('express');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');
const { Order } = require('../models');
const { authenticate, requireVerifiedEmail } = require('../middleware/auth');
const { validate, z, objectId } = require('../middleware/validate');
const { getViewableCourse } = require('../services/course.service');
const orders = require('../services/payments/order.service');

/**
 * Webhooks need the exact raw bytes for signature checks, so they are mounted
 * in app.js *before* the JSON body parser.
 */
const webhookRouter = express.Router();
webhookRouter.post('/:provider', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const provider = req.params.provider;
  if (!['razorpay', 'stripe'].includes(provider)) throw ApiError.notFound('Unknown webhook');
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw ApiError.badRequest('Empty webhook body');
  const result = await orders.handleWebhook(provider, req.body, req.headers);
  res.json({ received: true, ...result });
});

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    data: {
      provider: env.PAYMENT_PROVIDER,
      currency: env.DEFAULT_CURRENCY,
      ...(env.PAYMENT_PROVIDER === 'razorpay' ? { razorpayKeyId: env.RAZORPAY_KEY_ID } : {}),
    },
  });
});

router.post(
  '/quote',
  authenticate,
  validate({ body: z.object({ courseId: z.string().min(1), couponCode: z.string().trim().max(32).optional() }) }),
  async (req, res) => {
    const course = await getViewableCourse(req.user, req.valid.body.courseId);
    const q = await orders.quote(course, req.valid.body.couponCode, req.user._id);
    res.json({
      data: {
        originalAmount: q.originalAmount,
        discount: q.discount,
        amount: q.amount,
        currency: q.currency,
        coupon: q.coupon ? { code: q.coupon.code, type: q.coupon.type, value: q.coupon.value } : null,
      },
    });
  },
);

router.post(
  '/checkout',
  authenticate,
  requireVerifiedEmail,
  validate({ body: z.object({ courseId: z.string().min(1), couponCode: z.string().trim().max(32).optional() }) }),
  async (req, res) => {
    const course = await getViewableCourse(req.user, req.valid.body.courseId);
    const result = await orders.startCheckout({ user: req.user, course, couponCode: req.valid.body.couponCode });
    res.status(201).json({ data: result });
  },
);

/** Client-side confirmation (Razorpay handler response, or mock provider). */
router.post(
  '/verify',
  authenticate,
  validate({
    body: z
      .object({
        orderId: objectId,
        razorpay_order_id: z.string().optional(),
        razorpay_payment_id: z.string().optional(),
        razorpay_signature: z.string().optional(),
      })
      .passthrough(),
  }),
  async (req, res) => {
    const order = await orders.verifyClientPayment({ user: req.user, orderId: req.valid.body.orderId, body: req.valid.body });
    res.json({ data: { order } });
  },
);

router.get('/orders/:id', authenticate, validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const order = await Order.findOne({ _id: req.valid.params.id, user: req.user._id })
    .select('-instructor -platformFee -instructorEarning')
    .populate('course', 'title slug thumbnailUrl')
    .lean();
  if (!order) throw ApiError.notFound('Order not found');
  res.json({ data: { order } });
});

module.exports = { paymentRouter: router, webhookRouter };
