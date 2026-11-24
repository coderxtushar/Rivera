'use strict';

const env = require('../config/env');
const ApiError = require('../lib/ApiError');
const { User } = require('../models');
const { ACCESS_COOKIE, verifyAccessToken } = require('../services/token.service');

const AUTH_USER_FIELDS = 'email firstName lastName role status isEmailVerified tokenVersion instructorStatus avatarUrl';

function extractToken(req) {
  const header = req.get('authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[ACCESS_COOKIE] || null;
}

/**
 * Resolve the current user from the access token. The user is re-read from the
 * database on every request so suspensions, role changes and password changes
 * take effect immediately rather than when the JWT expires.
 */
async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    throw ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID');
  }

  const user = await User.findById(payload.sub).select(AUTH_USER_FIELDS).lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'TOKEN_INVALID');
  if (user.status !== 'active') throw ApiError.forbidden('This account is suspended', 'ACCOUNT_SUSPENDED');
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
    throw ApiError.unauthorized('Session revoked; please sign in again', 'TOKEN_REVOKED');
  }
  return user;
}

async function authenticate(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
}

/** Attach req.user when a valid token is present; stay anonymous otherwise. */
async function optionalAuth(req, _res, next) {
  try {
    req.user = (await resolveUser(req)) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`This action requires the ${roles.join(' or ')} role`);
    }
    next();
  };
}

function requireVerifiedEmail(req, _res, next) {
  if (env.REQUIRE_EMAIL_VERIFICATION && !req.user?.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email address first', 'EMAIL_NOT_VERIFIED');
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireRole, requireVerifiedEmail };
