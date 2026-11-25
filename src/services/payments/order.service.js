'use strict';

/**
 * Orders: pricing, checkout, fulfilment and refunds.
 *
 * Ground rule: once a provider reports money captured, the order ends up
 * either granting access or refunded — never silently kept. That covers
 * double checkouts, expired orders, exhausted coupons and deleted accounts.
 */
const env = require('../../config/env');
const logger = require('../../config/logger');
const ApiError = require('../../lib/ApiError');
const { sameId } = require('../../lib/util');
const { Order, Coupon, Course, Enrollment, User } = require('../../models');
const { grantEnrollment, revokeEnrollment } = require('../enrollment.service');
const { activeProvider, providerByName } = require('./providers');

/** Unpaid orders are honoured for this long (covers slow UPI/bank flows). */
const ORDER_TTL_MS = 2 * 60 * 60 * 1000;
const NO_MONEY_PROVIDERS = new Set(['mock', 'none']);

/** Check a coupon applies to a course for this user and compute the discount. */
async function resolveCoupon(code, course, userId) {
  if (!code) return { coupon: null, discount: 0 };
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  const invalid = (msg) => ApiError.unprocessable(msg, 'COUPON_INVALID');

  if (!coupon || !coupon.isActive) throw invalid('Coupon code is not valid');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw invalid('Coupon has expired');
  if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) throw invalid('Coupon has been fully redeemed');
  if (coupon.course && !sameId(coupon.course, course._id)) throw invalid('Coupon does not apply to this course');
  if (userId && (await Order.exists({ user: userId, coupon: coupon._id, couponRedeemed: true, status: 'paid' }))) {
    throw invalid('You have already used this coupon');
  }

  const discount =
    coupon.type === 'percent' ? Math.round((course.price * Math.min(coupon.value, 100)) / 100) : Math.min(coupon.value, course.price);
  return { coupon, discount };
}

/** Payment gateways reject tiny charges (Razorpay: ₹1). Discounts stop there unless they make it free. */
const MIN_CHARGE = 100;

async function quote(course, couponCode, userId) {
  const { coupon, discount: raw } = await resolveCoupon(couponCode, course, userId);
  let amount = Math.max(0, course.price - raw);
  if (amount > 0 && amount < MIN_CHARGE) amount = Math.min(MIN_CHARGE, course.price);
  return { originalAmount: course.price, discount: course.price - amount, amount, currency: course.currency, coupon };
}

function splitRevenue(amount) {
  const platformFee = Math.round((amount * env.PLATFORM_FEE_PERCENT) / 100);
  return { platformFee, instructorEarning: amount - platformFee };
}

/** Atomically take one redemption, respecting maxRedemptions and one use per user. */
async function redeemCoupon(order) {
  if (await Order.exists({ _id: { $ne: order._id }, user: order.user, coupon: order.coupon, couponRedeemed: true, status: 'paid' })) {
    return false;
  }
  const res = await Coupon.updateOne(
    {
      _id: order.coupon,
      $or: [{ maxRedemptions: null }, { $expr: { $lt: ['$redemptionCount', '$maxRedemptions'] } }],
    },
    { $inc: { redemptionCount: 1 } },
  );
  if (!res.modifiedCount) return false;
  await Order.updateOne({ _id: order._id }, { couponRedeemed: true });
  return true;
}

/**
 * Undo a paid order that can't be honoured. Real money is refunded through the
 * provider; if that fails the order is parked as `refund_pending` for an admin.
 */
async function cancelPaidOrder(order, reason) {
  logger.warn({ orderId: String(order._id), reason }, 'Cancelling paid order');
  if (order.amount === 0 || NO_MONEY_PROVIDERS.has(order.provider)) {
    return Order.findByIdAndUpdate(order._id, { status: 'failed', failureReason: reason }, { returnDocument: 'after' });
  }
  try {
    await providerByName(order.provider).refund(order);
    return Order.findByIdAndUpdate(
      order._id,
      { status: 'refunded', refundedAt: new Date(), failureReason: `Auto-refunded: ${reason}` },
      { returnDocument: 'after' },
    );
  } catch (err) {
    logger.error({ err, orderId: String(order._id) }, 'Automatic refund failed — needs manual refund');
    return Order.findByIdAndUpdate(
      order._id,
      { status: 'refund_pending', failureReason: `Refund needed: ${reason}` },
      { returnDocument: 'after' },
    );
  }
}

/**
 * Mark an order paid and grant access. Idempotent: the status transition is a
 * conditional update, so a webhook and a client verify racing each other only
 * fulfil once. `failed` orders can still be paid because Razorpay lets buyers
 * retry within the same order after a failed attempt.
 */
async function fulfillOrder(orderId, providerPaymentId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ['created', 'failed'] } },
    { status: 'paid', paidAt: new Date(), providerPaymentId, $unset: { failureReason: 1 } },
    { returnDocument: 'after' },
  );
  if (!order) return Order.findById(orderId); // already handled

  if (order.expiresAt && order.paidAt > order.expiresAt) return cancelPaidOrder(order, 'Order expired before payment');

  const [course, userExists] = await Promise.all([Course.findById(order.course), User.exists({ _id: order.user })]);
  if (!course) return cancelPaidOrder(order, 'Course no longer exists');
  if (!userExists) return cancelPaidOrder(order, 'Account no longer exists');

  if (order.coupon && !(await redeemCoupon(order))) return cancelPaidOrder(order, 'Coupon no longer available');

  const { created } = await grantEnrollment({ userId: order.user, course, source: 'purchase', order });
  if (!created) {
    // Already enrolled (second tab, earlier purchase, or admin grant): don't keep the money.
    if (order.couponRedeemed) await Coupon.updateOne({ _id: order.coupon, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
    return cancelPaidOrder(order, 'Duplicate purchase — already enrolled');
  }
  logger.info({ orderId: String(order._id), amount: order.amount }, 'Order paid');
  return Order.findById(order._id);
}

async function startCheckout({ user, course, couponCode }) {
  if (course.status !== 'published') throw ApiError.unprocessable('This course is not available for purchase', 'COURSE_UNAVAILABLE');
  if (sameId(course.instructor, user._id)) throw ApiError.unprocessable('You cannot buy your own course', 'OWN_COURSE');
  if (await Enrollment.exists({ user: user._id, course: course._id })) {
    throw ApiError.conflict('You are already enrolled in this course', 'ALREADY_ENROLLED');
  }

  if (course.price === 0) {
    const { enrollment } = await grantEnrollment({ userId: user._id, course, source: 'free' });
    return { order: null, enrollment, requiresPayment: false };
  }

  const q = await quote(course, couponCode, user._id);
  const base = {
    user: user._id,
    course: course._id,
    instructor: course.instructor,
    courseTitle: course.title,
    originalAmount: q.originalAmount,
    discount: q.discount,
    amount: q.amount,
    currency: q.currency,
    coupon: q.coupon?._id,
    couponCode: q.coupon?.code,
    expiresAt: new Date(Date.now() + ORDER_TTL_MS),
    ...splitRevenue(q.amount),
  };

  // Abandon this buyer's earlier unpaid orders for the course. If one gets paid
  // anyway, fulfilment sees the existing enrollment and refunds it.
  await Order.updateMany(
    { user: user._id, course: course._id, status: 'created' },
    { status: 'failed', failureReason: 'Superseded by a newer checkout' },
  );

  // A 100% coupon: no payment step, but keep the order as a record of the redemption.
  if (q.amount === 0) {
    const order = await Order.create({ ...base, provider: 'none' });
    const result = await fulfillOrder(order._id, null);
    if (result.status !== 'paid') throw ApiError.unprocessable(result.failureReason || 'Could not apply coupon', 'COUPON_INVALID');
    const enrollment = await Enrollment.findOne({ user: user._id, course: course._id });
    return { order: result, enrollment, requiresPayment: false };
  }

  const provider = activeProvider();
  const order = await Order.create({ ...base, provider: provider.name });
  try {
    const { providerOrderId, clientPayload } = await provider.createCheckout({ order, course, user });
    order.providerOrderId = providerOrderId;
    await order.save();
    return { order, requiresPayment: true, payment: clientPayload };
  } catch (err) {
    order.status = 'failed';
    order.failureReason = err.message;
    await order.save();
    throw err;
  }
}

async function verifyClientPayment({ user, orderId, body }) {
  const order = await Order.findOne({ _id: orderId, user: user._id });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'created' && order.status !== 'failed') return order;
  // Mock orders are only payable while the mock provider is active (never after switching to a real one).
  if (order.provider === 'mock' && env.PAYMENT_PROVIDER !== 'mock') throw ApiError.conflict('This order can no longer be paid', 'ORDER_UNPAYABLE');
  if (NO_MONEY_PROVIDERS.has(order.provider) && order.status === 'failed') throw ApiError.conflict('This order can no longer be paid', 'ORDER_UNPAYABLE');
  const providerPaymentId = await providerByName(order.provider).verifyClientPayment(order, body);
  return fulfillOrder(order._id, providerPaymentId);
}

async function handleWebhook(providerName, rawBody, headers) {
  const parsed = providerByName(providerName).parseWebhook(rawBody, headers);
  if (!parsed?.providerOrderId) return { handled: false };

  const order = await Order.findOne({ provider: providerName, providerOrderId: parsed.providerOrderId });
  if (!order) {
    logger.warn({ provider: providerName, providerOrderId: parsed.providerOrderId }, 'Webhook for unknown order');
    return { handled: false };
  }
  if (parsed.event === 'paid') await fulfillOrder(order._id, parsed.providerPaymentId);
  if (parsed.event === 'failed') {
    await Order.updateOne({ _id: order._id, status: 'created' }, { status: 'failed', failureReason: parsed.reason });
  }
  return { handled: true };
}

/** Admin refund. Claimed atomically so the provider is only called once. */
async function refundOrder(orderId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ['paid', 'refund_pending'] }, refundingAt: null },
    { refundingAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!order) {
    if (!(await Order.exists({ _id: orderId }))) throw ApiError.notFound('Order not found');
    throw ApiError.conflict('Only paid orders can be refunded (or a refund is already in progress)');
  }
  try {
    if (order.amount > 0 && !NO_MONEY_PROVIDERS.has(order.provider)) await providerByName(order.provider).refund(order);
  } catch (err) {
    await Order.updateOne({ _id: order._id }, { $unset: { refundingAt: 1 } });
    throw err;
  }
  const wasPaid = order.status === 'paid';
  const refunded = await Order.findByIdAndUpdate(
    order._id,
    { status: 'refunded', refundedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (wasPaid) {
    if (order.couponRedeemed) {
      await Coupon.updateOne({ _id: order.coupon, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
    }
    // Only revoke access this order granted (not a separate grant or purchase).
    await revokeEnrollment(order.user, order.course, { orderId: order._id });
  }
  return refunded;
}

module.exports = { quote, startCheckout, verifyClientPayment, handleWebhook, refundOrder, fulfillOrder, ORDER_TTL_MS };
