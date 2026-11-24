'use strict';

const { Router } = require('express');
const ApiError = require('../lib/ApiError');
const { paginate, escapeRegex, sameId } = require('../lib/util');
const { User, Course, Order, Enrollment } = require('../models');
const { ORDER_STATUSES } = require('../models/commerce');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, z, objectId, pagination } = require('../middleware/validate');
const tokens = require('../services/token.service');
const { refundOrder } = require('../services/payments/order.service');
const { grantEnrollment, revokeEnrollment } = require('../services/enrollment.service');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', async (_req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const [usersByRole, newUsers, coursesByStatus, revenue, enrollments] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Course.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$currency', gross: { $sum: '$amount' }, platformFees: { $sum: '$platformFee' }, orders: { $sum: 1 } } },
    ]),
    Enrollment.countDocuments(),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json({
    data: {
      users: { byRole: toMap(usersByRole), newLast30Days: newUsers },
      courses: { byStatus: toMap(coursesByStatus) },
      enrollments,
      revenue: revenue.map((r) => ({ currency: r._id, gross: r.gross, platformFees: r.platformFees, orders: r.orders })),
    },
  });
});

/* ------------------------------------------------------------------ users */

router.get(
  '/users',
  validate({
    query: z.object({
      ...pagination,
      q: z.string().trim().max(100).optional(),
      role: z.enum(User.ROLES).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      instructorStatus: z.enum(['none', 'pending', 'approved', 'rejected']).optional(),
    }),
  }),
  async (req, res) => {
    const { q, role, status, instructorStatus } = req.valid.query;
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];
    }
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (instructorStatus) filter.instructorStatus = instructorStatus;
    const [items, total] = await Promise.all([
      User.find(filter).select('-wishlist').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    res.json({ data: items, meta: meta(total) });
  },
);

router.patch(
  '/users/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z
      .object({
        role: z.enum(User.ROLES),
        status: z.enum(['active', 'suspended']),
        instructorStatus: z.enum(['none', 'pending', 'approved', 'rejected']),
      })
      .partial(),
  }),
  async (req, res) => {
    if (sameId(req.valid.params.id, req.user._id)) {
      throw ApiError.badRequest('Admins cannot change their own role or status');
    }
    const user = await User.findById(req.valid.params.id);
    if (!user) throw ApiError.notFound('User not found');
    const body = { ...req.valid.body };
    // Approving an application promotes the user; rejecting leaves them a student.
    if (body.instructorStatus === 'approved' && !body.role && user.role === 'student') body.role = 'instructor';
    if (body.role === 'instructor' && !body.instructorStatus) body.instructorStatus = 'approved';
    user.set(body);
    await user.save();
    if (body.status === 'suspended') await tokens.revokeAllForUser(user._id, { bumpVersion: true });
    res.json({ data: { user } });
  },
);

/* ---------------------------------------------------------------- courses */

router.get(
  '/courses',
  validate({
    query: z.object({ ...pagination, q: z.string().trim().max(100).optional(), status: z.enum(Course.STATUSES).optional() }),
  }),
  async (req, res) => {
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = {};
    if (req.valid.query.status) filter.status = req.valid.query.status;
    if (req.valid.query.q) filter.title = new RegExp(escapeRegex(req.valid.query.q), 'i');
    const [items, total] = await Promise.all([
      Course.find(filter)
        .select('-description -sections')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('instructor', 'firstName lastName email')
        .lean(),
      Course.countDocuments(filter),
    ]);
    res.json({ data: items, meta: meta(total) });
  },
);

router.patch(
  '/courses/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ isFeatured: z.boolean(), status: z.enum(['published', 'archived']) }).partial(),
  }),
  async (req, res) => {
    const course = await Course.findById(req.valid.params.id);
    if (!course) throw ApiError.notFound('Course not found');
    if (req.valid.body.status === 'published' && !course.publishedAt) course.publishedAt = new Date();
    course.set(req.valid.body);
    await course.save();
    res.json({ data: { course } });
  },
);

/* ----------------------------------------------------------------- orders */

router.get(
  '/orders',
  validate({ query: z.object({ ...pagination, status: z.enum(ORDER_STATUSES).optional() }) }),
  async (req, res) => {
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = req.valid.query.status ? { status: req.valid.query.status } : {};
    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName email')
        .populate('course', 'title slug')
        .lean(),
      Order.countDocuments(filter),
    ]);
    res.json({ data: items, meta: meta(total) });
  },
);

router.post('/orders/:id/refund', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const order = await refundOrder(req.valid.params.id);
  res.json({ data: { order } });
});

/* ------------------------------------------------------------ enrollments */

router.post(
  '/enrollments',
  validate({ body: z.object({ userId: objectId, courseId: objectId }) }),
  async (req, res) => {
    const [user, course] = await Promise.all([
      User.exists({ _id: req.valid.body.userId }),
      Course.findById(req.valid.body.courseId),
    ]);
    if (!user) throw ApiError.notFound('User not found');
    if (!course) throw ApiError.notFound('Course not found');
    const { enrollment, created } = await grantEnrollment({ userId: req.valid.body.userId, course, source: 'admin_grant' });
    res.status(created ? 201 : 200).json({ data: { enrollment } });
  },
);

router.delete(
  '/enrollments',
  validate({ body: z.object({ userId: objectId, courseId: objectId }) }),
  async (req, res) => {
    await revokeEnrollment(req.valid.body.userId, req.valid.body.courseId);
    res.status(204).end();
  },
);

module.exports = router;
