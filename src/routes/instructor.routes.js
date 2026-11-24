'use strict';

const { Router } = require('express');
const mongoose = require('mongoose');
const { paginate } = require('../lib/util');
const { Course, Order, Enrollment } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, z, pagination } = require('../middleware/validate');

const router = Router();
router.use(authenticate, requireRole('instructor', 'admin'));

router.get(
  '/courses',
  validate({ query: z.object({ ...pagination, status: z.enum(Course.STATUSES).optional() }) }),
  async (req, res) => {
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = { instructor: req.user._id, ...(req.valid.query.status ? { status: req.valid.query.status } : {}) };
    const [items, total] = await Promise.all([
      Course.find(filter).select('-description -sections').sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter),
    ]);
    res.json({ data: items, meta: meta(total) });
  },
);

/** Dashboard numbers: totals, revenue by month (last 12) and per-course breakdown. */
router.get('/stats', async (req, res) => {
  const instructor = new mongoose.Types.ObjectId(String(req.user._id));
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11, 1);
  since.setUTCHours(0, 0, 0, 0);

  const courseIds = await Course.find({ instructor }).distinct('_id');

  const [courseAgg, revenueAgg, monthly, perCourse, students] = await Promise.all([
    Course.aggregate([
      { $match: { instructor } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          ratingSum: { $sum: { $multiply: ['$stats.ratingAvg', '$stats.ratingCount'] } },
          ratingCount: { $sum: '$stats.ratingCount' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { instructor, status: 'paid' } },
      { $group: { _id: '$currency', gross: { $sum: '$amount' }, earnings: { $sum: '$instructorEarning' }, sales: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { instructor, status: 'paid', paidAt: { $gte: since } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, currency: '$currency' },
          earnings: { $sum: '$instructorEarning' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]),
    Order.aggregate([
      { $match: { instructor, status: 'paid' } },
      { $group: { _id: '$course', earnings: { $sum: '$instructorEarning' }, sales: { $sum: 1 }, currency: { $first: '$currency' } } },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course', pipeline: [{ $project: { title: 1, slug: 1, stats: 1 } }] } },
      { $unwind: '$course' },
      { $sort: { earnings: -1 } },
    ]),
    Enrollment.distinct('user', { course: { $in: courseIds } }),
  ]);

  const c = courseAgg[0] || { total: 0, published: 0, ratingSum: 0, ratingCount: 0 };
  res.json({
    data: {
      courses: { total: c.total, published: c.published },
      students: students.length,
      rating: { average: c.ratingCount ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : 0, count: c.ratingCount },
      revenue: revenueAgg.map((r) => ({ currency: r._id, gross: r.gross, earnings: r.earnings, sales: r.sales })),
      monthly: monthly.map((m) => ({ month: m._id.month, currency: m._id.currency, earnings: m.earnings, sales: m.sales })),
      perCourse: perCourse.map((p) => ({ course: p.course, earnings: p.earnings, sales: p.sales, currency: p.currency })),
    },
  });
});

router.get('/sales', validate({ query: z.object(pagination) }), async (req, res) => {
  const { skip, limit, meta } = paginate(req.valid.query);
  const filter = { instructor: req.user._id, status: { $in: ['paid', 'refunded'] } };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .select('course courseTitle amount currency instructorEarning status paidAt refundedAt couponCode user')
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName')
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ data: items, meta: meta(total) });
});

module.exports = router;
