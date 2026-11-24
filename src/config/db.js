'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

mongoose.set('strictQuery', true);

let closing = false;

async function connectDB(uri = env.MONGODB_URI) {
  mongoose.connection.on('disconnected', () => (closing ? logger.info : logger.warn).call(logger, 'MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    // Free-tier clusters (Atlas M0) cap connections at 500 across all clients.
    maxPoolSize: 10,
  });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose.connection;
}

async function disconnectDB() {
  closing = true;
  await mongoose.disconnect();
}

function dbState() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDB, disconnectDB, dbState };
