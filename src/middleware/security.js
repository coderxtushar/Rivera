'use strict';

const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');

/*
 * Rate limiting uses the in-memory store, which is right for a single instance
 * (free tiers). When you run several instances, plug in a shared store such as
 * `rate-limit-redis` so limits are enforced across all of them.
 */
function limiter(max, windowMs = env.RATE_LIMIT_WINDOW_MS) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests, please slow down')),
  });
}

const apiLimiter = limiter(env.RATE_LIMIT_MAX);
const authLimiter = limiter(env.AUTH_RATE_LIMIT_MAX);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests. Browsers always send an
 * Origin header on cross-site state-changing requests, so a mismatch against
 * the allowlist means another site is trying to act with the user's cookies.
 * Bearer-token clients and requests without cookies aren't affected.
 */
function originCheck(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const hasCookies = req.cookies && Object.keys(req.cookies).length > 0;
  const origin = req.get('origin');
  if (hasCookies && origin && !env.corsOrigins.includes(origin.replace(/\/$/, ''))) {
    return next(ApiError.forbidden('Cross-site request blocked', 'BAD_ORIGIN'));
  }
  return next();
}

module.exports = { apiLimiter, authLimiter, originCheck };
