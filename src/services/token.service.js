'use strict';

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');
const { randomToken, sha256 } = require('../lib/util');
const { RefreshToken, OneTimeToken, User } = require('../models');

const ACCESS_COOKIE = 'rv_access';
const REFRESH_COOKIE = 'rv_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function signAccessToken(user) {
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0 }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'rivera',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'rivera' });
}

function clientInfo(req) {
  return { userAgent: (req.get('user-agent') || '').slice(0, 300), ip: req.ip };
}

async function issueRefreshToken(userId, req, family = crypto.randomUUID()) {
  const raw = randomToken(48);
  await RefreshToken.create({
    user: userId,
    tokenHash: sha256(raw),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    ...clientInfo(req),
  });
  return raw;
}

/**
 * Exchange a refresh token for a new pair. Rotation + reuse detection:
 * a revoked token being replayed revokes every token in its family.
 */
async function rotateRefreshToken(raw, req) {
  if (!raw) throw ApiError.unauthorized('Refresh token missing', 'REFRESH_TOKEN_MISSING');
  const record = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!record || record.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token invalid or expired', 'REFRESH_TOKEN_INVALID');
  }
  if (record.revokedAt) {
    await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Refresh token reuse detected; please sign in again', 'REFRESH_TOKEN_REUSED');
  }

  // Atomically claim the token so two concurrent refreshes can't both succeed.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { revokedAt: new Date() },
  );
  if (!claimed) throw ApiError.unauthorized('Refresh token already used', 'REFRESH_TOKEN_REUSED');

  const user = await User.findById(record.user);
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Account unavailable', 'ACCOUNT_UNAVAILABLE');
  }
  const refreshToken = await issueRefreshToken(user._id, req, record.family);
  return { user, accessToken: signAccessToken(user), refreshToken };
}

async function revokeRefreshToken(raw) {
  if (!raw) return;
  await RefreshToken.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { revokedAt: new Date() });
}

/** Revoke every refresh token; with `bumpVersion`, outstanding access tokens die immediately too. */
async function revokeAllForUser(userId, { bumpVersion = false } = {}) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
  if (bumpVersion) await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

const ONE_TIME_TTL = { email_verify: 24 * 3600_000, password_reset: 3600_000 };

async function createOneTimeToken(userId, type) {
  // Only the newest link of each type stays valid.
  await OneTimeToken.deleteMany({ user: userId, type, usedAt: null });
  const raw = randomToken(32);
  await OneTimeToken.create({
    user: userId,
    type,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + ONE_TIME_TTL[type]),
  });
  return raw;
}

async function consumeOneTimeToken(raw, type) {
  const record = await OneTimeToken.findOneAndUpdate(
    { tokenHash: sha256(raw), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
  );
  if (!record) throw ApiError.badRequest('This link is invalid or has expired', undefined, 'TOKEN_INVALID');
  return record.user;
}

function cookieBase() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
  };
}

function accessTokenMaxAgeMs() {
  const { exp, iat } = jwt.decode(jwt.sign({}, 'x', { expiresIn: env.ACCESS_TOKEN_TTL }));
  return (exp - iat) * 1000;
}
const ACCESS_MAX_AGE = accessTokenMaxAgeMs();

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), path: '/', maxAge: ACCESS_MAX_AGE });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: REFRESH_COOKIE_PATH });
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  createOneTimeToken,
  consumeOneTimeToken,
  setAuthCookies,
  clearAuthCookies,
};
