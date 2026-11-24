'use strict';

const { Router } = require('express');
const ApiError = require('../lib/ApiError');
const { sameId } = require('../lib/util');
const { Review, Course } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validate, z, objectId } = require('../middleware/validate');
const { canManage, recalcRatingStats } = require('../services/course.service');

const router = Router();
router.use(authenticate);

const params = z.object({ id: objectId });

async function loadOwnReview(req) {
  const review = await Review.findById(req.valid.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  if (!sameId(review.user, req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only change your own review');
  }
  return review;
}

router.patch(
  '/:id',
  validate({
    params,
    body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(3000) }).partial(),
  }),
  async (req, res) => {
    const review = await loadOwnReview(req);
    review.set(req.valid.body);
    await review.save();
    await recalcRatingStats(review.course);
    res.json({ data: { review } });
  },
);

router.delete('/:id', validate({ params }), async (req, res) => {
  const review = await loadOwnReview(req);
  await review.deleteOne();
  await recalcRatingStats(review.course);
  res.status(204).end();
});

/** Course instructor replies publicly to a review (send empty text to remove). */
router.put(
  '/:id/reply',
  validate({ params, body: z.object({ text: z.string().trim().max(3000) }) }),
  async (req, res) => {
    const review = await Review.findById(req.valid.params.id);
    if (!review) throw ApiError.notFound('Review not found');
    const course = await Course.findById(review.course).select('instructor').lean();
    if (!canManage(req.user, course)) throw ApiError.forbidden('Only the course instructor can reply');
    review.instructorReply = req.valid.body.text ? { text: req.valid.body.text, repliedAt: new Date() } : undefined;
    await review.save();
    res.json({ data: { review } });
  },
);

module.exports = router;
