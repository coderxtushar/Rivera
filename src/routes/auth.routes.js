'use strict';

const { Router } = require('express');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');
const { sendMail } = require('../lib/mailer');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { validate, z, email, password } = require('../middleware/validate');
const tokens = require('../services/token.service');

const router = Router();

/**
 * Clients that can't rely on cookies (mobile apps, or browsers blocking
 * third-party cookies when API and frontend are on different sites) send
 * `X-Auth-Transport: token` to also get the refresh token in the body.
 */
const wantsTokenInBody = (req) => req.get('x-auth-transport') === 'token';

function sessionPayload(req, user, accessToken, refreshToken) {
  return { user, accessToken, ...(wantsTokenInBody(req) ? { refreshToken } : {}) };
}

async function startSession(req, res, user, status = 200) {
  const accessToken = tokens.signAccessToken(user);
  const refreshToken = await tokens.issueRefreshToken(user._id, req);
  tokens.setAuthCookies(res, { accessToken, refreshToken });
  res.status(status).json({ data: sessionPayload(req, user, accessToken, refreshToken) });
}

async function sendVerification(user) {
  const token = await tokens.createOneTimeToken(user._id, 'email_verify');
  sendMail(user.email, 'verifyEmail', { name: user.firstName, url: `${env.CLIENT_URL}/verify-email?token=${token}` });
}

router.post(
  '/signup',
  authLimiter,
  validate({
    body: z.object({
      email,
      password,
      firstName: z.string().trim().min(1).max(60),
      lastName: z.string().trim().max(60).optional().default(''),
    }),
  }),
  async (req, res) => {
    const { email: mail, password: pw, firstName, lastName } = req.valid.body;
    if (await User.exists({ email: mail })) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    const user = new User({ email: mail, firstName, lastName });
    await user.setPassword(pw);
    await user.save();
    await sendVerification(user);
    await startSession(req, res, user, 201);
  },
);

router.post(
  '/signin',
  authLimiter,
  validate({ body: z.object({ email, password: z.string().min(1).max(128) }) }),
  async (req, res) => {
    const user = await User.findOne({ email: req.valid.body.email }).select('+passwordHash');
    // Same error for unknown email and wrong password, to avoid account enumeration.
    if (!user || !(await user.checkPassword(req.valid.body.password))) {
      throw ApiError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
    }
    if (user.status !== 'active') throw ApiError.forbidden('This account is suspended', 'ACCOUNT_SUSPENDED');
    user.lastLoginAt = new Date();
    await user.save();
    await startSession(req, res, user);
  },
);

router.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().max(200).optional() }).optional().default({}) }),
  async (req, res) => {
    const raw = req.cookies?.[tokens.REFRESH_COOKIE] || req.valid.body.refreshToken;
    try {
      const { user, accessToken, refreshToken } = await tokens.rotateRefreshToken(raw, req);
      tokens.setAuthCookies(res, { accessToken, refreshToken });
      res.json({ data: sessionPayload(req, user, accessToken, refreshToken) });
    } catch (err) {
      tokens.clearAuthCookies(res);
      throw err;
    }
  },
);

router.post(
  '/signout',
  validate({ body: z.object({ refreshToken: z.string().max(200).optional() }).optional().default({}) }),
  async (req, res) => {
  await tokens.revokeRefreshToken(req.cookies?.[tokens.REFRESH_COOKIE] || req.valid.body.refreshToken);
  tokens.clearAuthCookies(res);
  res.status(204).end();
  },
);

router.post('/signout-all', authenticate, async (req, res) => {
  await tokens.revokeAllForUser(req.user._id, { bumpVersion: true });
  tokens.clearAuthCookies(res);
  res.status(204).end();
});

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ data: { user } });
});

router.post('/verify-email', validate({ body: z.object({ token: z.string().min(10) }) }), async (req, res) => {
  const userId = await tokens.consumeOneTimeToken(req.valid.body.token, 'email_verify');
  const user = await User.findByIdAndUpdate(userId, { isEmailVerified: true }, { returnDocument: 'after' });
  res.json({ data: { user } });
});

router.post('/resend-verification', authLimiter, authenticate, async (req, res) => {
  if (req.user.isEmailVerified) throw ApiError.conflict('Email is already verified', 'ALREADY_VERIFIED');
  await sendVerification(req.user);
  res.json({ data: { sent: true } });
});

router.post('/forgot-password', authLimiter, validate({ body: z.object({ email }) }), async (req, res) => {
  const user = await User.findOne({ email: req.valid.body.email, status: 'active' });
  if (user) {
    const token = await tokens.createOneTimeToken(user._id, 'password_reset');
    sendMail(user.email, 'resetPassword', { name: user.firstName, url: `${env.CLIENT_URL}/reset-password?token=${token}` });
  }
  // Identical response either way so this can't be used to discover accounts.
  res.json({ data: { message: 'If an account exists for that email, a reset link has been sent.' } });
});

router.post(
  '/reset-password',
  authLimiter,
  validate({ body: z.object({ token: z.string().min(10), password }) }),
  async (req, res) => {
    const userId = await tokens.consumeOneTimeToken(req.valid.body.token, 'password_reset');
    const user = await User.findById(userId);
    if (!user) throw ApiError.badRequest('This link is invalid or has expired', undefined, 'TOKEN_INVALID');
    await user.setPassword(req.valid.body.password);
    user.isEmailVerified = true; // they proved inbox ownership
    await user.save();
    await tokens.revokeAllForUser(user._id);
    tokens.clearAuthCookies(res);
    res.json({ data: { message: 'Password updated. Please sign in.' } });
  },
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: password }) }),
  async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(req.valid.body.currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect', undefined, 'INVALID_CREDENTIALS');
    }
    await user.setPassword(req.valid.body.newPassword);
    await user.save();
    // Sign out every other device, keep this one signed in with fresh tokens.
    await tokens.revokeAllForUser(user._id);
    await startSession(req, res, user);
  },
);

module.exports = router;
