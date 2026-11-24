'use strict';

const crypto = require('node:crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const { sendMail } = require('../lib/mailer');
const { Enrollment, Course, Lesson, Certificate, User, Review } = require('../models');

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Idempotently grant a user access to a course. Returns `{ enrollment, created }`.
 * Relies on the unique (user, course) index so concurrent calls can't double-enroll.
 */
async function grantEnrollment({ userId, course, source, order }) {
  let enrollment;
  let created = false;
  try {
    enrollment = await Enrollment.create({
      user: userId,
      course: course._id,
      source,
      order: order?._id,
      pricePaid: order?.amount || 0,
      currency: order?.currency || course.currency,
    });
    created = true;
  } catch (err) {
    if (err.code !== 11000) throw err;
    enrollment = await Enrollment.findOne({ user: userId, course: course._id });
  }

  if (created) {
    await Course.updateOne({ _id: course._id }, { $inc: { 'stats.enrollmentCount': 1 } });
    const user = await User.findById(userId).select('email firstName').lean();
    if (user) {
      sendMail(user.email, 'enrollmentConfirmed', {
        name: user.firstName,
        courseTitle: course.title,
        url: `${env.CLIENT_URL}/learn/${course.slug}`,
        amountText: order?.amount ? formatMoney(order.amount, order.currency) : '',
      });
    }
  }
  return { enrollment, created };
}

/**
 * Remove a student's access, plus the review and certificate that came with it.
 * With `orderId`, only an enrollment created by that order is removed, so
 * refunding one order never revokes access granted some other way.
 */
async function revokeEnrollment(userId, courseId, { orderId } = {}) {
  const filter = { user: userId, course: courseId, ...(orderId ? { order: orderId } : {}) };
  const res = await Enrollment.deleteOne(filter);
  if (!res.deletedCount) return false;
  await Course.updateOne({ _id: courseId, 'stats.enrollmentCount': { $gt: 0 } }, { $inc: { 'stats.enrollmentCount': -1 } });
  await Certificate.deleteOne({ user: userId, course: courseId });
  const review = await Review.findOneAndDelete({ user: userId, course: courseId });
  if (review) {
    // Lazy require: course.service ↔ enrollment.service would otherwise be circular.
    await require('./course.service').recalcRatingStats(review.course);
  }
  return true;
}

/**
 * Recompute every student's percent after lessons are added or removed, and
 * award certificates to anyone who is now at 100%.
 */
async function recalcCourseProgress(courseId) {
  const total = await Lesson.countDocuments({ course: courseId });
  await Enrollment.updateMany({ course: courseId }, [
    {
      $set: {
        'progress.percent': total
          ? { $min: [100, { $round: [{ $multiply: [{ $divide: [{ $size: '$progress.completedLessons' }, total] }, 100] }, 0] }] }
          : 0,
      },
    },
  ], { updatePipeline: true }); // Mongoose 9 requires opting in to pipeline updates
  if (!total) return;
  const finished = await Enrollment.find({ course: courseId, 'progress.percent': 100, 'progress.completedAt': null })
    .select('user')
    .lean();
  if (!finished.length) return;
  const course = await Course.findById(courseId);
  await Enrollment.updateMany({ _id: { $in: finished.map((e) => e._id) } }, { 'progress.completedAt': new Date() });
  for (const e of finished) {
    // eslint-disable-next-line no-await-in-loop
    await issueCertificate(e.user, course).catch((err) => logger.error({ err }, 'Failed to issue certificate'));
  }
}

async function issueCertificate(userId, course) {
  const existing = await Certificate.findOne({ user: userId, course: course._id });
  if (existing) return existing;
  const [user, instructor] = await Promise.all([
    User.findById(userId).select('firstName lastName email').lean(),
    User.findById(course.instructor).select('firstName lastName').lean(),
  ]);
  const code = `RIV-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  try {
    const cert = await Certificate.create({
      code,
      user: userId,
      course: course._id,
      studentName: fullName(user),
      courseTitle: course.title,
      instructorName: fullName(instructor),
    });
    if (user) {
      sendMail(user.email, 'certificateIssued', {
        name: user.firstName,
        courseTitle: course.title,
        url: `${env.CLIENT_URL}/certificates/${code}`,
      });
    }
    return cert;
  } catch (err) {
    if (err.code === 11000) return Certificate.findOne({ user: userId, course: course._id });
    throw err;
  }
}

/**
 * Mark a lesson complete/incomplete and recompute progress. Issues a
 * certificate the first time a student completes every lesson.
 */
async function setLessonCompletion({ enrollment, course, lessonId, completed }) {
  const update = completed
    ? { $addToSet: { 'progress.completedLessons': lessonId } }
    : { $pull: { 'progress.completedLessons': lessonId } };
  update.$set = { 'progress.lastLesson': lessonId, 'progress.lastAccessedAt': new Date() };

  const updated = await Enrollment.findByIdAndUpdate(enrollment._id, update, { returnDocument: 'after' });
  const total = await Lesson.countDocuments({ course: course._id });
  const done = updated.progress.completedLessons.length;
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const set = { 'progress.percent': percent };
  let certificate = null;
  if (total > 0 && done >= total) {
    if (!updated.progress.completedAt) set['progress.completedAt'] = new Date();
    try {
      certificate = await issueCertificate(enrollment.user, course);
    } catch (err) {
      logger.error({ err }, 'Failed to issue certificate');
    }
  }
  const final = await Enrollment.findByIdAndUpdate(updated._id, { $set: set }, { returnDocument: 'after' });
  return { enrollment: final, certificate };
}

module.exports = { grantEnrollment, revokeEnrollment, recalcCourseProgress, setLessonCompletion, issueCertificate, formatMoney };
