'use strict';

/** Enrollment, Order and Coupon — the models involved in getting access to a course. */
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    course: { type: ObjectId, ref: 'Course', required: true, index: true },
    order: { type: ObjectId, ref: 'Order' },
    source: { type: String, enum: ['free', 'purchase', 'admin_grant'], required: true },
    pricePaid: { type: Number, default: 0 },
    currency: String,
    progress: {
      completedLessons: [{ type: ObjectId, ref: 'Lesson' }],
      lastLesson: { type: ObjectId, ref: 'Lesson' },
      lastAccessedAt: Date,
      percent: { type: Number, default: 0 },
      completedAt: Date,
    },
  },
  { timestamps: true },
);
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ user: 1, updatedAt: -1 });

/**
 * created → paid → refunded
 *         ↘ failed (payment failed / abandoned / auto-cancelled with no money taken)
 * refund_pending: money was captured but access couldn't be granted and the
 * automatic refund failed — an admin must refund it manually.
 */
const ORDER_STATUSES = ['created', 'paid', 'failed', 'refunded', 'refund_pending'];

const orderSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    course: { type: ObjectId, ref: 'Course', required: true },
    instructor: { type: ObjectId, ref: 'User', required: true, index: true },
    courseTitle: String, // snapshot for receipts

    originalAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // what the buyer pays (minor units)
    currency: { type: String, required: true },
    platformFee: { type: Number, default: 0 },
    instructorEarning: { type: Number, default: 0 },

    coupon: { type: ObjectId, ref: 'Coupon' },
    couponCode: String,

    provider: { type: String, enum: ['mock', 'razorpay', 'stripe', 'none'], required: true },
    providerOrderId: { type: String, index: true },
    providerPaymentId: String,
    status: { type: String, enum: ORDER_STATUSES, default: 'created', index: true },
    /** Unpaid orders stop being honoured after this, so old prices/coupons can't be locked in. */
    expiresAt: Date,
    couponRedeemed: { type: Boolean, default: false },
    paidAt: Date,
    refundingAt: Date, // claim marker so concurrent refunds only hit the provider once
    refundedAt: Date,
    failureReason: String,
  },
  { timestamps: true },
);
orderSchema.index({ instructor: 1, status: 1, paidAt: -1 });
orderSchema.index({ status: 1, paidAt: -1 });
orderSchema.index({ user: 1, course: 1, status: 1 });

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 3, maxlength: 32 },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    /** Percent (1–100) or a fixed amount in minor units. */
    value: { type: Number, required: true, min: 1 },
    /** Restrict to a course. Null = any course (admin-created coupons only). */
    course: { type: ObjectId, ref: 'Course', index: true },
    createdBy: { type: ObjectId, ref: 'User', required: true, index: true },
    maxRedemptions: { type: Number, min: 1 },
    redemptionCount: { type: Number, default: 0 },
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = {
  Enrollment: mongoose.model('Enrollment', enrollmentSchema),
  Order: mongoose.model('Order', orderSchema),
  Coupon: mongoose.model('Coupon', couponSchema),
  ORDER_STATUSES,
};
