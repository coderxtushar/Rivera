'use strict';

/**
 * Centralised, validated configuration.
 * Every environment variable the app reads is declared here — nothing else
 * should touch process.env directly.
 */
const { z } = require('zod');

const bool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? fallback : ['true', '1', 'yes'].includes(v)));

const csv = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .map((s) => s.trim().replace(/\/$/, ''))
          .filter(Boolean)
      : [],
  );

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Secrets must be strong in production; dev/test get throwaway defaults.
const secret = (devDefault) =>
  isProd ? z.string().min(32, 'must be at least 32 characters in production') : z.string().min(1).default(devDefault);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: secret('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: secret('dev-refresh-secret-change-me'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CLIENT_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: csv,
  COOKIE_SECURE: bool(isProd),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),

  RATE_LIMIT_ENABLED: bool(!isTest),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  INSTRUCTOR_AUTO_APPROVE: bool(true),
  REQUIRE_EMAIL_VERIFICATION: bool(false),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(20),
  DEFAULT_CURRENCY: z
    .string()
    .length(3)
    .default('INR')
    .transform((v) => v.toUpperCase()),

  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay', 'stripe']).default('mock'),
  ALLOW_MOCK_PAYMENTS: bool(!isProd),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Rivera <no-reply@rivera.local>'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${lines.join('\n')}`);
  process.exit(1);
}

const env = parsed.data;

// Cross-field checks that zod object schemas can't express cleanly.
const problems = [];
if (env.PAYMENT_PROVIDER === 'razorpay' && !(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)) {
  problems.push('PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
}
if (env.PAYMENT_PROVIDER === 'stripe' && !env.STRIPE_SECRET_KEY) {
  problems.push('PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY');
}
if (env.PAYMENT_PROVIDER === 'mock' && isProd && !env.ALLOW_MOCK_PAYMENTS) {
  problems.push(
    'PAYMENT_PROVIDER=mock lets anyone buy courses for free. Configure a real provider, or set ALLOW_MOCK_PAYMENTS=true deliberately.',
  );
}
if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
  problems.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers reject it otherwise)');
}
if (problems.length) {
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

module.exports = Object.freeze({
  ...env,
  isProd,
  isTest,
  isDev: env.NODE_ENV === 'development',
  corsOrigins: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : [env.CLIENT_URL.replace(/\/$/, '')],
  features: Object.freeze({
    email: Boolean(env.SMTP_HOST),
    uploads: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  }),
});
