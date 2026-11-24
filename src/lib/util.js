'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

/** Cryptographically random URL-safe token. */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Tokens are stored hashed so a database leak doesn't leak live credentials. */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time string comparison. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function slugify(input) {
  return (
    String(input)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

/** Generate a slug unique within `Model`, appending a short suffix on collision. */
async function uniqueSlug(Model, text, excludeId) {
  const base = slugify(text);
  let candidate = base;
  for (let i = 0; i < 5; i += 1) {
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    // eslint-disable-next-line no-await-in-loop
    if (!(await Model.exists(filter))) return candidate;
    candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) && mongoose.isValidObjectId(value);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalise `?page=&limit=` into skip/limit plus a meta builder. */
function paginate({ page = 1, limit = 12 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 12));
  return {
    page: p,
    limit: l,
    skip: (p - 1) * l,
    meta: (total) => ({ page: p, limit: l, total, totalPages: Math.ceil(total / l) || 0 }),
  };
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a._id || a) === String(b._id || b);
}

module.exports = { randomToken, sha256, hmacSha256Hex, safeEqual, slugify, uniqueSlug, isObjectId, escapeRegex, paginate, sameId };
