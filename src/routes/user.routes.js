'use strict';

const { Router } = require('express');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');
const { paginate } = require('../lib/util');
const { User, Course, Lesson, Coupon, Enrollment, Order, Certificate, RefreshToken, Review } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validate, z, objectId, pagination, url } = require('../middleware/validate');
const tokens = require('../services/token.service');
const { recalcRatingStats } = require('../services/course.service');
const { revokeEnrollment } = require('../services/enrollment.service');

const router = Router();

const COURSE_CARD = 'title slug subtitle thumbnailUrl price currency level instructor stats status';

/* ------------------------------------------------------------- public */

router.get('/:id/profile', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const user = await User.findOne({ _id: req.valid.params.id, status: 'active' }).select(User.PUBLIC_FIELDS).lean();
  if (!user) throw ApiError.notFound('User not found');
  const courses =
    user.role === 'student'
      ? []
      : await Course.find({ instructor: user._id, status: 'published' }).select(COURSE_CARD).sort({ publishedAt: -1 }).lean();
  const totals = courses.reduce(
    (acc, c) => ({
      students: acc.students + c.stats.enrollmentCount,
      reviews: acc.reviews + c.stats.ratingCount,
    }),
    { students: 0, reviews: 0 },
  );
  res.json({ data: { user, courses, stats: { courses: courses.length, ...totals } } });
});

/* ----------------------------------------------------------------- me */

router.use(authenticate);

router.patch(
  '/me',
  validate({
    body: z
      .object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().max(60),
        headline: z.string().trim().max(120),
        bio: z.string().trim().max(2000),
        website: url,
        avatarUrl: url,
      })
      .partial(),
  }),
  async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, req.valid.body, { returnDocument: 'after', runValidators: true });
    res.json({ data: { user } });
  },
);

router.delete(
  '/me',
  validate({ body: z.object({ password: z.string().min(1) }) }),
  async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(req.valid.body.password))) {
      throw ApiError.badRequest('Password is incorrect', undefined, 'INVALID_CREDENTIALS');
    }
    // Students who paid for an instructor's courses must keep access, so those courses block deletion.
    const ownCourses = await Course.find({ instructor: user._id }).distinct('_id');
    if (ownCourses.length && (await Enrollment.exists({ course: { $in: ownCourses } }))) {
      throw ApiError.conflict(
        'You have courses with enrolled students. Contact support to transfer them before deleting your account.',
        'HAS_ENROLLED_STUDENTS',
      );
    }
    // Courses nobody is enrolled in go with the account.
    if (ownCourses.length) {
      await Promise.all([
        Lesson.deleteMany({ course: { $in: ownCourses } }),
        Review.deleteMany({ course: { $in: ownCourses } }),
        Coupon.deleteMany({ course: { $in: ownCourses } }),
        User.updateMany({ wishlist: { $in: ownCourses } }, { $pull: { wishlist: { $in: ownCourses } } }),
      ]);
      await Course.deleteMany({ _id: { $in: ownCourses } });
    }
    // Revoke enrollments one by one so course counters, reviews and certificates stay consistent.
    const enrolledIn = await Enrollment.find({ user: user._id }).distinct('course');
    for (const courseId of enrolledIn) {
      // eslint-disable-next-line no-await-in-loop
      await revokeEnrollment(user._id, courseId);
    }
    const reviewed = await Review.distinct('course', { user: user._id });
    await Review.deleteMany({ user: user._id });
    await Promise.all(reviewed.map((c) => recalcRatingStats(c)));
    // Orders are kept for accounting; unpaid ones are cancelled. A late payment for one is auto-refunded.
    await Promise.all([
      Order.updateMany({ user: user._id, status: 'created' }, { status: 'failed', failureReason: 'Account deleted' }),
      Certificate.deleteMany({ user: user._id }),
      RefreshToken.deleteMany({ user: user._id }),
    ]);
    await user.deleteOne();
    tokens.clearAuthCookies(res);
    res.status(204).end();
  },
);

router.post(
  '/me/become-instructor',
  validate({
    body: z
      .object({ headline: z.string().trim().max(120), bio: z.string().trim().max(2000) })
      .partial()
      .optional()
      .default({}),
  }),
  async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user.role !== 'student') throw ApiError.conflict(`You are already an ${user.role}`, 'ALREADY_INSTRUCTOR');
    if (user.instructorStatus === 'pending') throw ApiError.conflict('Your application is pending review', 'APPLICATION_PENDING');
    Object.assign(user, req.valid.body);
    if (env.INSTRUCTOR_AUTO_APPROVE) {
      user.role = 'instructor';
      user.instructorStatus = 'approved';
    } else {
      user.instructorStatus = 'pending';
    }
    await user.save();
    // Role is embedded in the access token, so hand back a fresh one.
    const accessToken = tokens.signAccessToken(user);
    res.json({ data: { user, accessToken } });
  },
);

router.get('/me/enrollments', validate({ query: z.object(pagination) }), async (req, res) => {
  const { skip, limit, meta } = paginate(req.valid.query);
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ 'progress.lastAccessedAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'course', select: COURSE_CARD, populate: { path: 'instructor', select: 'firstName lastName' } })
      .lean(),
    Enrollment.countDocuments(filter),
  ]);
  res.json({ data: items, meta: meta(total) });
});

router.get('/me/orders', validate({ query: z.object(pagination) }), async (req, res) => {
  const { skip, limit, meta } = paginate(req.valid.query);
  const filter = { user: req.user._id, status: { $ne: 'created' } };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .select('-instructor -platformFee -instructorEarning')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('course', 'title slug thumbnailUrl')
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ data: items, meta: meta(total) });
});

router.get('/me/certificates', async (req, res) => {
  const items = await Certificate.find({ user: req.user._id })
    .sort({ issuedAt: -1 })
    .populate('course', 'title slug thumbnailUrl')
    .lean();
  res.json({ data: items });
});

router.get('/me/sessions', async (req, res) => {
  const items = await RefreshToken.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('userAgent ip createdAt expiresAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ data: items });
});

/* ------------------------------------------------------------ wishlist */

router.get('/me/wishlist', async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('wishlist')
    .populate({
      path: 'wishlist',
      match: { status: 'published' },
      select: COURSE_CARD,
      populate: { path: 'instructor', select: 'firstName lastName' },
    })
    .lean();
  res.json({ data: user.wishlist.filter(Boolean) });
});

router.put('/me/wishlist/:courseId', validate({ params: z.object({ courseId: objectId }) }), async (req, res) => {
  const { courseId } = req.valid.params;
  if (!(await Course.exists({ _id: courseId, status: 'published' }))) throw ApiError.notFound('Course not found');
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: courseId } });
  res.status(204).end();
});

router.delete('/me/wishlist/:courseId', validate({ params: z.object({ courseId: objectId }) }), async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.valid.params.courseId } });
  res.status(204).end();
});

module.exports = router;
