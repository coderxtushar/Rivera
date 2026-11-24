'use strict';

const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');

async function main() {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Rivera API listening on port ${env.PORT} (${env.NODE_ENV}, payments: ${env.PAYMENT_PROVIDER})`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectDB().catch(() => {});
      process.exit(0);
    });
    // Don't hang forever on keep-alive connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
