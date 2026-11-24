'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const lessonSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true },
    section: { type: ObjectId, required: true }, // _id of a Course.sections entry
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: ['video', 'article'], default: 'video' },
    videoUrl: { type: String, default: '' },
    /** Markdown body for articles, or notes shown under a video. */
    content: { type: String, maxlength: 100000, default: '' },
    durationSec: { type: Number, min: 0, default: 0 },
    isPreview: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    resources: [
      {
        _id: false,
        title: { type: String, trim: true, maxlength: 120 },
        url: { type: String, trim: true },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

lessonSchema.index({ course: 1, section: 1, order: 1 });

/** Fields visible in the public curriculum outline (no video/body). */
lessonSchema.statics.OUTLINE_FIELDS = 'course section title type durationSec isPreview order';

module.exports = mongoose.model('Lesson', lessonSchema);
