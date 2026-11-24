'use strict';

const { Router } = require('express');
const ApiError = require('../lib/ApiError');
const { paginate, sameId } = require('../lib/util');
const { Coupon, Course } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, z, objectId, pagination } = require('../middleware/validate');

/** Coupons: instructors create them for their own courses; admins may create site-wide ones. */
const router = Router();
router.use(authenticate, requireRole('instructor', 'admin'));

const couponBody = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, 'Use 3–32 letters, digits, - or _'),
    type: z.enum(['percent', 'fixed']),
    value: z.number().int().min(1),
    course: objectId.nullable().optional(),
    maxRedemptions: z.number().int().min(1).nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'Percent coupons must be 1–100', path: ['value'] });

async function assertCourseAccess(user, courseId) {
  if (!courseId) {
    if (user.role !== 'admin') throw ApiError.badRequest('Instructors must attach a coupon to one of their courses');
    return;
  }
  const course = await Course.findById(courseId).select('instructor').lean();
  if (!course) throw ApiError.badRequest('Course not found');
  if (user.role !== 'admin' && !sameId(course.instructor, user._id)) {
    throw ApiError.forbidden('You can only create coupons for your own courses');
  }
}

async function loadCoupon(req) {
  const coupon = await Coupon.findById(req.valid.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  if (req.user.role !== 'admin' && !sameId(coupon.createdBy, req.user._id)) throw ApiError.notFound('Coupon not found');
  return coupon;
}

router.get(
  '/',
  validate({ query: z.object({ ...pagination, course: objectId.optional() }) }),
  async (req, res) => {
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    if (req.valid.query.course) filter.course = req.valid.query.course;
    const [items, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('course', 'title slug').lean(),
      Coupon.countDocuments(filter),
    ]);
    res.json({ data: items, meta: meta(total) });
  },
);

router.post('/', validate({ body: couponBody }), async (req, res) => {
  await assertCourseAccess(req.user, req.valid.body.course);
  const coupon = await Coupon.create({ ...req.valid.body, createdBy: req.user._id });
  res.status(201).json({ data: { coupon } });
});

router.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z
      .object({
        maxRedemptions: z.number().int().min(1).nullable(),
        expiresAt: z.coerce.date().nullable(),
        isActive: z.boolean(),
      })
      .partial(),
  }),
  async (req, res) => {
    const coupon = await loadCoupon(req);
    coupon.set(req.valid.body);
    await coupon.save();
    res.json({ data: { coupon } });
  },
);

router.delete('/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const coupon = await loadCoupon(req);
  // Keep redeemed coupons for order history; just deactivate them.
  if (coupon.redemptionCount > 0) {
    coupon.isActive = false;
    await coupon.save();
  } else {
    await coupon.deleteOne();
  }
  res.status(204).end();
});

module.exports = router;
