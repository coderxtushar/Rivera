'use strict';

const { Router } = require('express');
const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');
const { paginate, uniqueSlug, isObjectId, sameId, escapeRegex } = require('../lib/util');
const { Course, Lesson, Category, Enrollment, Review, User, Coupon } = require('../models');
const { authenticate, optionalAuth, requireRole, requireVerifiedEmail } = require('../middleware/auth');
const { validate, z, objectId, pagination, url, assetUrl } = require('../middleware/validate');
const courses = require('../services/course.service');
const { startCheckout } = require('../services/payments/order.service');
const { setLessonCompletion } = require('../services/enrollment.service');

const router = Router();
const asId = (v) => new mongoose.Types.ObjectId(String(v));

const idParam = z.object({ id: z.string().min(1).max(120) });
const sectionParams = idParam.extend({ sectionId: objectId });
const lessonParams = idParam.extend({ lessonId: objectId });

const CARD_FIELDS =
  'title slug subtitle thumbnailUrl price currency level language tags category instructor stats isFeatured publishedAt status';

/* ================================================================ catalog */

const listQuery = z.object({
  ...pagination,
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  level: z.enum(Course.LEVELS).optional(),
  language: z.string().trim().max(40).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  instructor: objectId.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  free: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['relevance', 'newest', 'popular', 'rating', 'price_asc', 'price_desc']).optional(),
});

const SORTS = {
  newest: { publishedAt: -1 },
  popular: { 'stats.enrollmentCount': -1, publishedAt: -1 },
  rating: { 'stats.ratingAvg': -1, 'stats.ratingCount': -1 },
  price_asc: { price: 1, publishedAt: -1 },
  price_desc: { price: -1, publishedAt: -1 },
};

async function resolveCategoryId(value) {
  if (isObjectId(value)) return value;
  const cat = await Category.findOne({ slug: value }).select('_id').lean();
  return cat?._id || null;
}

router.get('/', validate({ query: listQuery }), async (req, res) => {
  const q = req.valid.query;
  const { skip, limit, meta } = paginate(q);
  const filter = { status: 'published' };

  if (q.q) filter.$text = { $search: q.q };
  if (q.category) {
    const categoryId = await resolveCategoryId(q.category);
    if (!categoryId) return res.json({ data: [], meta: meta(0) });
    filter.category = categoryId;
  }
  if (q.level) filter.level = q.level;
  if (q.language) filter.language = new RegExp(`^${escapeRegex(q.language)}$`, 'i');
  if (q.tag) filter.tags = q.tag;
  if (q.instructor) filter.instructor = q.instructor;
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.minRating !== undefined) filter['stats.ratingAvg'] = { $gte: q.minRating };
  if (q.free === 'true') filter.price = 0;
  else if (q.free === 'false') filter.price = { $gt: 0 };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {
      ...(typeof filter.price === 'object' ? filter.price : {}),
      ...(q.minPrice !== undefined ? { $gte: q.minPrice } : {}),
      ...(q.maxPrice !== undefined ? { $lte: q.maxPrice } : {}),
    };
  }

  const useRelevance = q.q && (!q.sort || q.sort === 'relevance');
  const projection = useRelevance ? { score: { $meta: 'textScore' } } : {};
  const sort = useRelevance ? { score: { $meta: 'textScore' } } : SORTS[q.sort] || SORTS.newest;

  const [items, total] = await Promise.all([
    Course.find(filter, projection)
      .select(CARD_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'firstName lastName avatarUrl')
      .populate('category', 'name slug')
      .lean(),
    Course.countDocuments(filter),
  ]);
  return res.json({ data: items, meta: meta(total) });
});

router.get('/:id', optionalAuth, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getViewableCourse(req.user, req.valid.params.id);
  await course.populate([
    { path: 'instructor', select: User.PUBLIC_FIELDS },
    { path: 'category', select: 'name slug' },
  ]);
  const curriculum = await courses.buildCurriculum(course);

  let viewer = null;
  if (req.user) {
    const [enrollment, wish] = await Promise.all([
      Enrollment.findOne({ user: req.user._id, course: course._id }).select('progress createdAt').lean(),
      User.exists({ _id: req.user._id, wishlist: course._id }),
    ]);
    viewer = {
      isEnrolled: Boolean(enrollment),
      canManage: courses.canManage(req.user, course),
      isWishlisted: Boolean(wish),
      progress: enrollment?.progress || null,
    };
  }
  res.json({ data: { course, curriculum, viewer } });
});

/* ======================================================= instructor CRUD */

const courseBody = z.object({
  title: z.string().trim().min(5).max(120),
  subtitle: z.string().trim().max(200),
  description: z.string().trim().max(20000),
  category: objectId.nullable(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10),
  level: z.enum(Course.LEVELS),
  language: z.string().trim().min(2).max(40),
  price: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .refine((p) => p === 0 || p >= 100, 'Paid courses must cost at least 1.00 (100 in minor units)'),
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase()),
  thumbnailUrl: assetUrl,
  promoVideoUrl: url,
  requirements: z.array(z.string().trim().min(1).max(200)).max(20),
  outcomes: z.array(z.string().trim().min(1).max(200)).max(20),
});

async function assertCategory(category) {
  if (category && !(await Category.exists({ _id: category }))) throw ApiError.badRequest('Category not found');
}

router.post(
  '/',
  authenticate,
  requireRole('instructor', 'admin'),
  requireVerifiedEmail,
  validate({ body: courseBody.partial().required({ title: true }) }),
  async (req, res) => {
    const body = req.valid.body;
    await assertCategory(body.category);
    const course = await Course.create({
      ...body,
      currency: body.currency || env.DEFAULT_CURRENCY,
      slug: await uniqueSlug(Course, body.title),
      instructor: req.user._id,
    });
    res.status(201).json({ data: { course } });
  },
);

router.patch('/:id', authenticate, validate({ params: idParam, body: courseBody.partial() }), async (req, res) => {
  const course = await courses.getManageableCourse(req.user, req.valid.params.id);
  const body = req.valid.body;
  await assertCategory(body.category);
  // Keep URLs stable once a course has been public.
  if (body.title && body.title !== course.title && !course.publishedAt) {
    course.slug = await uniqueSlug(Course, body.title, course._id);
  }
  course.set(body);
  await course.save();
  res.json({ data: { course } });
});

router.delete('/:id', authenticate, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getManageableCourse(req.user, req.valid.params.id);
  if (await Enrollment.exists({ course: course._id })) {
    throw ApiError.conflict('Courses with enrolled students cannot be deleted; archive it instead', 'COURSE_HAS_STUDENTS');
  }
  await Promise.all([
    Lesson.deleteMany({ course: course._id }),
    Review.deleteMany({ course: course._id }),
    Coupon.deleteMany({ course: course._id }),
    User.updateMany({ wishlist: course._id }, { $pull: { wishlist: course._id } }),
  ]);
  await course.deleteOne();
  res.status(204).end();
});

router.post('/:id/publish', authenticate, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getManageableCourse(req.user, req.valid.params.id);
  const problems = courses.publishProblems(course);
  if (problems.length) throw ApiError.unprocessable('Course is not ready to publish', 'NOT_PUBLISHABLE', problems);
  course.status = 'published';
  course.publishedAt = course.publishedAt || new Date();
  await course.save();
  res.json({ data: { course } });
});

router.post('/:id/archive', authenticate, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getManageableCourse(req.user, req.valid.params.id);
  course.status = 'archived';
  await course.save();
  res.json({ data: { course } });
});

/* ============================================================ curriculum */

/** Full curriculum with video URLs — for enrolled students and course managers. */
router.get('/:id/curriculum', authenticate, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getViewableCourse(req.user, req.valid.params.id);
  const canManage = courses.canManage(req.user, course);
  const enrollment = canManage ? null : await Enrollment.findOne({ user: req.user._id, course: course._id }).lean();
  if (!canManage && !enrollment) throw ApiError.forbidden('Enroll in this course to see its content', 'NOT_ENROLLED');
  const curriculum = await courses.buildCurriculum(course, { full: true });
  // Article bodies can be large; fetch them per lesson.
  for (const s of curriculum) for (const l of s.lessons) delete l.content;
  res.json({ data: { curriculum, progress: enrollment?.progress || null } });
});

router.post(
  '/:id/sections',
  authenticate,
  validate({ params: idParam, body: z.object({ title: z.string().trim().min(1).max(120) }) }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const order = course.sections.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    course.sections.push({ title: req.valid.body.title, order });
    await course.save();
    res.status(201).json({ data: { section: course.sections.at(-1) } });
  },
);

router.patch(
  '/:id/sections/:sectionId',
  authenticate,
  validate({ params: sectionParams, body: z.object({ title: z.string().trim().min(1).max(120) }) }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const section = course.sections.id(req.valid.params.sectionId);
    if (!section) throw ApiError.notFound('Section not found');
    section.title = req.valid.body.title;
    await course.save();
    res.json({ data: { section } });
  },
);

router.delete('/:id/sections/:sectionId', authenticate, validate({ params: sectionParams }), async (req, res) => {
  const course = await courses.getManageableCourse(req.user, req.valid.params.id);
  const section = course.sections.id(req.valid.params.sectionId);
  if (!section) throw ApiError.notFound('Section not found');
  const lessonIds = await Lesson.find({ course: course._id, section: section._id }).distinct('_id');
  await Lesson.deleteMany({ _id: { $in: lessonIds } });
  await Enrollment.updateMany(
    { course: course._id },
    { $pull: { 'progress.completedLessons': { $in: lessonIds } } },
  );
  section.deleteOne();
  await course.save();
  await courses.recalcCurriculumStats(course._id);
  res.status(204).end();
});

router.put(
  '/:id/sections/order',
  authenticate,
  validate({ params: idParam, body: z.object({ sectionIds: z.array(objectId).min(1) }) }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const { sectionIds } = req.valid.body;
    const current = course.sections.map((s) => String(s._id)).sort();
    if (sectionIds.length !== current.length || [...sectionIds].sort().join() !== current.join()) {
      throw ApiError.badRequest('sectionIds must list every section of the course exactly once');
    }
    sectionIds.forEach((id, i) => {
      course.sections.id(id).order = i;
    });
    await course.save();
    res.json({ data: { sections: [...course.sections].sort((a, b) => a.order - b.order) } });
  },
);

const lessonBody = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(['video', 'article']),
  videoUrl: url,
  content: z.string().max(100000),
  durationSec: z.number().int().min(0).max(24 * 3600),
  isPreview: z.boolean(),
  resources: z.array(z.object({ title: z.string().trim().min(1).max(120), url: z.url() })).max(20),
});

router.post(
  '/:id/sections/:sectionId/lessons',
  authenticate,
  validate({ params: sectionParams, body: lessonBody.partial().required({ title: true }) }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const section = course.sections.id(req.valid.params.sectionId);
    if (!section) throw ApiError.notFound('Section not found');
    const last = await Lesson.findOne({ course: course._id, section: section._id }).sort({ order: -1 }).select('order').lean();
    const lesson = await Lesson.create({ ...req.valid.body, course: course._id, section: section._id, order: (last?.order ?? -1) + 1 });
    await courses.recalcCurriculumStats(course._id);
    res.status(201).json({ data: { lesson } });
  },
);

router.put(
  '/:id/sections/:sectionId/lessons/order',
  authenticate,
  validate({ params: sectionParams, body: z.object({ lessonIds: z.array(objectId).min(1) }) }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const { sectionId } = req.valid.params;
    const { lessonIds } = req.valid.body;
    const current = (await Lesson.find({ course: course._id, section: sectionId }).distinct('_id')).map(String).sort();
    if (lessonIds.length !== current.length || [...lessonIds].sort().join() !== current.join()) {
      throw ApiError.badRequest('lessonIds must list every lesson of the section exactly once');
    }
    await Lesson.bulkWrite(lessonIds.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { order: i } } })));
    const lessons = await Lesson.find({ course: course._id, section: sectionId }).select(Lesson.OUTLINE_FIELDS).sort({ order: 1 }).lean();
    res.json({ data: { lessons } });
  },
);

router.get('/:id/lessons/:lessonId', optionalAuth, validate({ params: lessonParams }), async (req, res) => {
  const course = await courses.getViewableCourse(req.user, req.valid.params.id);
  const lesson = await Lesson.findOne({ _id: req.valid.params.lessonId, course: course._id }).lean();
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const canManage = courses.canManage(req.user, course);
  const enrolled = req.user && !canManage && (await Enrollment.exists({ user: req.user._id, course: course._id }));
  if (!(canManage || enrolled || (lesson.isPreview && course.status === 'published'))) {
    throw ApiError.forbidden('Enroll in this course to watch this lesson', 'NOT_ENROLLED');
  }
  if (enrolled) {
    await Enrollment.updateOne(
      { user: req.user._id, course: course._id },
      { 'progress.lastLesson': lesson._id, 'progress.lastAccessedAt': new Date() },
    );
  }
  res.json({ data: { lesson } });
});

router.patch(
  '/:id/lessons/:lessonId',
  authenticate,
  validate({ params: lessonParams, body: lessonBody.extend({ sectionId: objectId }).partial() }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const lesson = await Lesson.findOne({ _id: req.valid.params.lessonId, course: course._id });
    if (!lesson) throw ApiError.notFound('Lesson not found');
    const { sectionId, ...fields } = req.valid.body;
    if (sectionId && !sameId(sectionId, lesson.section)) {
      if (!course.sections.id(sectionId)) throw ApiError.badRequest('Target section not found');
      const last = await Lesson.findOne({ course: course._id, section: sectionId }).sort({ order: -1 }).select('order').lean();
      lesson.section = sectionId;
      lesson.order = (last?.order ?? -1) + 1;
    }
    lesson.set(fields);
    await lesson.save();
    if (fields.durationSec !== undefined) await courses.recalcCurriculumStats(course._id);
    res.json({ data: { lesson } });
  },
);

router.delete('/:id/lessons/:lessonId', authenticate, validate({ params: lessonParams }), async (req, res) => {
  const course = await courses.getManageableCourse(req.user, req.valid.params.id);
  const lesson = await Lesson.findOneAndDelete({ _id: req.valid.params.lessonId, course: course._id });
  if (!lesson) throw ApiError.notFound('Lesson not found');
  await Enrollment.updateMany({ course: course._id }, { $pull: { 'progress.completedLessons': lesson._id } });
  await courses.recalcCurriculumStats(course._id);
  res.status(204).end();
});

/* ======================================================== learning */

/** Enroll in a free course. Paid courses go through POST /payments/checkout. */
router.post('/:id/enroll', authenticate, requireVerifiedEmail, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getViewableCourse(req.user, req.valid.params.id);
  if (course.price > 0) {
    throw new ApiError(402, 'PAYMENT_REQUIRED', 'This is a paid course; use POST /api/v1/payments/checkout');
  }
  const result = await startCheckout({ user: req.user, course });
  res.status(201).json({ data: { enrollment: result.enrollment } });
});

async function requireEnrollment(user, course) {
  const enrollment = await Enrollment.findOne({ user: user._id, course: course._id });
  if (!enrollment) throw ApiError.forbidden('You are not enrolled in this course', 'NOT_ENROLLED');
  return enrollment;
}

router.get('/:id/progress', authenticate, validate({ params: idParam }), async (req, res) => {
  const course = await courses.getViewableCourse(req.user, req.valid.params.id);
  const enrollment = await requireEnrollment(req.user, course);
  res.json({ data: { progress: enrollment.progress, lessonCount: course.stats.lessonCount } });
});

for (const [method, completed] of [
  ['post', true],
  ['delete', false],
]) {
  router[method]('/:id/lessons/:lessonId/complete', authenticate, validate({ params: lessonParams }), async (req, res) => {
    const course = await courses.getViewableCourse(req.user, req.valid.params.id);
    const enrollment = await requireEnrollment(req.user, course);
    if (!(await Lesson.exists({ _id: req.valid.params.lessonId, course: course._id }))) {
      throw ApiError.notFound('Lesson not found');
    }
    const result = await setLessonCompletion({ enrollment, course, lessonId: asId(req.valid.params.lessonId), completed });
    res.json({ data: { progress: result.enrollment.progress, certificate: result.certificate } });
  });
}

/* ========================================================== reviews */

router.get(
  '/:id/reviews',
  validate({ params: idParam, query: z.object({ ...pagination, rating: z.coerce.number().int().min(1).max(5).optional() }) }),
  async (req, res) => {
    const course = await courses.getViewableCourse(undefined, req.valid.params.id);
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = { course: course._id, ...(req.valid.query.rating ? { rating: req.valid.query.rating } : {}) };
    const [items, total, dist] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'firstName lastName avatarUrl').lean(),
      Review.countDocuments(filter),
      Review.aggregate([{ $match: { course: course._id } }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
    ]);
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, dist.find((d) => d._id === r)?.count || 0]));
    res.json({
      data: items,
      meta: { ...meta(total), ratingAvg: course.stats.ratingAvg, ratingCount: course.stats.ratingCount, distribution },
    });
  },
);

router.post(
  '/:id/reviews',
  authenticate,
  validate({
    params: idParam,
    body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(3000).optional().default('') }),
  }),
  async (req, res) => {
    const course = await courses.getViewableCourse(req.user, req.valid.params.id);
    await requireEnrollment(req.user, course);
    if (await Review.exists({ course: course._id, user: req.user._id })) {
      throw ApiError.conflict('You have already reviewed this course; edit your review instead', 'ALREADY_REVIEWED');
    }
    const review = await Review.create({ ...req.valid.body, course: course._id, user: req.user._id });
    await courses.recalcRatingStats(course._id);
    res.status(201).json({ data: { review } });
  },
);

/* ===================================================== instructor views */

router.get(
  '/:id/students',
  authenticate,
  validate({ params: idParam, query: z.object(pagination) }),
  async (req, res) => {
    const course = await courses.getManageableCourse(req.user, req.valid.params.id);
    const { skip, limit, meta } = paginate(req.valid.query);
    const filter = { course: course._id };
    const [items, total] = await Promise.all([
      Enrollment.find(filter)
        .select('user source pricePaid currency progress.percent progress.completedAt progress.lastAccessedAt createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName avatarUrl')
        .lean(),
      Enrollment.countDocuments(filter),
    ]);
    res.json({ data: items, meta: meta(total) });
  },
);

module.exports = router;
