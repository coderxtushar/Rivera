'use strict';

/** Categories, certificates and uploads — small public/utility endpoints. */
const { Router } = require('express');
const ApiError = require('../lib/ApiError');
const { uniqueSlug } = require('../lib/util');
const { Category, Course, Certificate } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, z, objectId } = require('../middleware/validate');
const { signUpload, UPLOAD_KINDS } = require('../services/upload.service');

/* ------------------------------------------------------------ categories */

const categoryRouter = Router();

categoryRouter.get('/', async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Course.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({ data: categories.map((c) => ({ ...c, courseCount: byId.get(String(c._id)) || 0 })) });
});

const categoryBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
});

categoryRouter.post('/', authenticate, requireRole('admin'), validate({ body: categoryBody }), async (req, res) => {
  const category = await Category.create({ ...req.valid.body, slug: await uniqueSlug(Category, req.valid.body.name) });
  res.status(201).json({ data: { category } });
});

categoryRouter.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: z.object({ id: objectId }), body: categoryBody.partial() }),
  async (req, res) => {
    const category = await Category.findById(req.valid.params.id);
    if (!category) throw ApiError.notFound('Category not found');
    if (req.valid.body.name && req.valid.body.name !== category.name) {
      category.slug = await uniqueSlug(Category, req.valid.body.name, category._id);
    }
    category.set(req.valid.body);
    await category.save();
    res.json({ data: { category } });
  },
);

categoryRouter.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: z.object({ id: objectId }) }),
  async (req, res) => {
    const category = await Category.findByIdAndDelete(req.valid.params.id);
    if (!category) throw ApiError.notFound('Category not found');
    await Course.updateMany({ category: category._id }, { $unset: { category: 1 } });
    res.status(204).end();
  },
);

/* ---------------------------------------------------------- certificates */

const certificateRouter = Router();

/** Public verification — anyone with the code can confirm a certificate is genuine. */
certificateRouter.get(
  '/:code',
  validate({ params: z.object({ code: z.string().trim().toUpperCase().regex(/^RIV-[A-F0-9]{10}$/) }) }),
  async (req, res) => {
    const cert = await Certificate.findOne({ code: req.valid.params.code })
      .select('code studentName courseTitle instructorName issuedAt course')
      .populate('course', 'slug')
      .lean();
    if (!cert) throw ApiError.notFound('Certificate not found');
    res.json({ data: { certificate: cert } });
  },
);

/* ---------------------------------------------------------------- uploads */

const uploadRouter = Router();

uploadRouter.post(
  '/signature',
  authenticate,
  validate({ body: z.object({ kind: z.enum(UPLOAD_KINDS) }) }),
  (req, res) => {
    const { kind } = req.valid.body;
    if (kind !== 'avatar' && !['instructor', 'admin'].includes(req.user.role)) {
      throw ApiError.forbidden('Only instructors can upload course media');
    }
    res.json({ data: signUpload({ kind, userId: String(req.user._id) }) });
  },
);

module.exports = { categoryRouter, certificateRouter, uploadRouter };
