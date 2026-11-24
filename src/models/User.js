'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['student', 'instructor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, trim: true, maxlength: 60, default: '' },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    isEmailVerified: { type: Boolean, default: false },

    // Profile (public for instructors)
    avatarUrl: { type: String, default: '' },
    headline: { type: String, trim: true, maxlength: 120, default: '' },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    website: { type: String, trim: true, maxlength: 200, default: '' },

    instructorStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

    /** Bumped to invalidate every outstanding access token (password change, sign-out-all). */
    tokenVersion: { type: Number, default: 0 },
    passwordChangedAt: Date,
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

userSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
    this.tokenVersion += 1;
  }
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Fields safe to show other users (e.g. instructor cards). */
userSchema.statics.PUBLIC_FIELDS = 'firstName lastName avatarUrl headline bio website role';
userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
