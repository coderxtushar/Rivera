'use strict';

const pino = require('pino');
const env = require('./env');

function prettyTransport() {
  if (!env.isDev) return undefined;
  try {
    require.resolve('pino-pretty'); // devDependency — absent in production installs
    return { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } };
  } catch {
    return undefined;
  }
}

const logger = pino({
  level: env.LOG_LEVEL || (env.isTest ? 'silent' : env.isProd ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[redacted]',
  },
  transport: prettyTransport(),
});

module.exports = logger;
