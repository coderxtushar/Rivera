'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

/**
 * Refresh tokens are opaque random strings stored hashed. Each login starts a
 * `family`; every refresh rotates the token within that family. Presenting a
 * token that was already rotated means it leaked, so the whole family is revoked.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    userAgent: String,
    ip: String,
  },
  { timestamps: true },
);
// MongoDB deletes expired tokens on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Single-use tokens for email verification and password reset. */
const oneTimeTokenSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['email_verify', 'password_reset'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true },
);
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
  RefreshToken: mongoose.model('RefreshToken', refreshTokenSchema),
  OneTimeToken: mongoose.model('OneTimeToken', oneTimeTokenSchema),
};
