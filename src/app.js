'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const pinoHttp = require('pino-http');
const crypto = require('node:crypto');

const env = require('./config/env');
const logger = require('./config/logger');
const { dbState } = require('./config/db');
const { apiLimiter, originCheck } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { webhookRouter } = require('./routes/payment.routes');
const apiRoutes = require('./routes');
const { version } = require('../package.json');

function createApp() {
  const app = express();

  // Render, Railway, Fly etc. sit behind a proxy; needed for correct req.ip / secure cookies.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.get('x-request-id') || crypto.randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server requests (no Origin header) and the allowlist.
        if (!origin || env.corsOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      exposedHeaders: ['x-request-id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(compression());

  app.get('/', (_req, res) => res.json({ name: 'Rivera API', version, docs: '/api/v1' }));
  app.get('/health', (_req, res) => {
    const db = dbState();
    res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()), version });
  });

  // Webhooks first: they need the raw body, before express.json() consumes it.
  app.use('/api/v1/payments/webhooks', webhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter, originCheck);
  app.get('/api/v1', (_req, res) =>
    res.json({
      name: 'Rivera API',
      version,
      features: { payments: env.PAYMENT_PROVIDER, email: env.features.email, uploads: env.features.uploads },
    }),
  );
  app.use('/api/v1', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
