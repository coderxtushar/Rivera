'use strict';

/** Category, Review and Certificate. */
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true },
);

const reviewSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    course: { type: ObjectId, ref: 'Course', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 3000, default: '' },
    instructorReply: {
      text: { type: String, trim: true, maxlength: 3000 },
      repliedAt: Date,
    },
  },
  { timestamps: true },
);
reviewSchema.index({ course: 1, user: 1 }, { unique: true });
reviewSchema.index({ course: 1, createdAt: -1 });

const certificateSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // public verification code
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    course: { type: ObjectId, ref: 'Course', required: true },
    // Snapshots, so the certificate stays accurate if names/titles change later.
    studentName: String,
    courseTitle: String,
    instructorName: String,
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
certificateSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = {
  Category: mongoose.model('Category', categorySchema),
  Review: mongoose.model('Review', reviewSchema),
  Certificate: mongoose.model('Certificate', certificateSchema),
};
