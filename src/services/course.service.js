'use strict';

const ApiError = require('../lib/ApiError');
const { isObjectId, sameId } = require('../lib/util');
const { Course, Lesson, Review, Enrollment } = require('../models');

/** Admins manage everything; instructors manage their own courses while they still hold the role. */
function canManage(user, course) {
  if (!user) return false;
  return user.role === 'admin' || (user.role === 'instructor' && sameId(course.instructor, user._id));
}

/** Load a course by id or slug that the current user may edit. */
async function getManageableCourse(user, idOrSlug) {
  const course = await Course.findOne(isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug });
  if (!course) throw ApiError.notFound('Course not found');
  if (!canManage(user, course)) {
    throw ApiError.forbidden(user?.role === 'instructor' || user?.role === 'admin' ? 'You can only manage your own courses' : 'This action requires the instructor role');
  }
  return course;
}

/** Published courses are public; drafts/archived are visible to their owner and admins only. */
async function getViewableCourse(user, idOrSlug) {
  const course = await Course.findOne(isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug });
  if (!course) throw ApiError.notFound('Course not found');
  if (course.status !== 'published' && !canManage(user, course)) {
    // Students who already bought a course that's since been archived keep access.
    const enrolled = user && (await Enrollment.exists({ user: user._id, course: course._id }));
    if (!enrolled) throw ApiError.notFound('Course not found');
  }
  return course;
}

async function recalcCurriculumStats(courseId) {
  const [agg] = await Lesson.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: null, count: { $sum: 1 }, duration: { $sum: '$durationSec' } } },
  ]);
  const before = await Course.findOneAndUpdate(
    { _id: courseId },
    { 'stats.lessonCount': agg?.count || 0, 'stats.totalDurationSec': agg?.duration || 0 },
  ).select('stats.lessonCount');
  // Lesson count changed → every student's percent changes too.
  if (before && before.stats.lessonCount !== (agg?.count || 0)) {
    await require('./enrollment.service').recalcCourseProgress(courseId); // lazy: avoids a require cycle
  }
}

async function recalcRatingStats(courseId) {
  const [agg] = await Review.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Course.updateOne(
    { _id: courseId },
    {
      'stats.ratingAvg': agg ? Math.round(agg.avg * 10) / 10 : 0,
      'stats.ratingCount': agg?.count || 0,
    },
  );
}

/** Sections sorted, each with its lessons sorted. */
async function buildCurriculum(course, { full = false } = {}) {
  const lessons = await Lesson.find({ course: course._id })
    .select(full ? '-__v' : Lesson.OUTLINE_FIELDS)
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const bySection = new Map();
  for (const l of lessons) {
    const key = String(l.section);
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(l);
  }
  return [...course.sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ _id: s._id, title: s.title, order: s.order, lessons: bySection.get(String(s._id)) || [] }));
}

/** Rules a course must satisfy before it can be published. */
function publishProblems(course) {
  const problems = [];
  if (!course.description || course.description.length < 50) problems.push('Description must be at least 50 characters');
  if (!course.sections.length) problems.push('Add at least one section');
  if (!course.stats.lessonCount) problems.push('Add at least one lesson');
  return problems;
}

module.exports = {
  canManage,
  getManageableCourse,
  getViewableCourse,
  recalcCurriculumStats,
  recalcRatingStats,
  buildCurriculum,
  publishProblems,
};
