'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const LEVELS = ['beginner', 'intermediate', 'advanced', 'all'];
const STATUSES = ['draft', 'published', 'archived'];

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  order: { type: Number, default: 0 },
});

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    subtitle: { type: String, trim: true, maxlength: 200, default: '' },
    description: { type: String, trim: true, maxlength: 20000, default: '' },
    instructor: { type: ObjectId, ref: 'User', required: true, index: true },
    category: { type: ObjectId, ref: 'Category', index: true },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    level: { type: String, enum: LEVELS, default: 'all' },
    language: { type: String, trim: true, default: 'English' },

    /** Price in the currency's minor unit (paise / cents). 0 = free. */
    price: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, required: true },

    thumbnailUrl: { type: String, default: '' },
    promoVideoUrl: { type: String, default: '' },
    requirements: [{ type: String, trim: true, maxlength: 200 }],
    outcomes: [{ type: String, trim: true, maxlength: 200 }],

    sections: [sectionSchema],

    status: { type: String, enum: STATUSES, default: 'draft', index: true },
    isFeatured: { type: Boolean, default: false },
    publishedAt: Date,

    // Denormalised counters, maintained by services — never written by clients.
    stats: {
      enrollmentCount: { type: Number, default: 0 },
      ratingAvg: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
      lessonCount: { type: Number, default: 0 },
      totalDurationSec: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
  },
);

courseSchema.virtual('isFree').get(function isFree() {
  return this.price === 0;
});

courseSchema.index(
  { title: 'text', subtitle: 'text', description: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, subtitle: 3, description: 1 }, name: 'course_text' },
);
courseSchema.index({ status: 1, publishedAt: -1 });
courseSchema.index({ status: 1, 'stats.enrollmentCount': -1 });
courseSchema.index({ status: 1, 'stats.ratingAvg': -1 });
courseSchema.index({ status: 1, price: 1 });

courseSchema.statics.LEVELS = LEVELS;
courseSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Course', courseSchema);
