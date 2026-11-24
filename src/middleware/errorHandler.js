'use strict';

const { ZodError } = require('zod');
const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
}

/** Translate known library errors into ApiErrors. */
function normalise(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return ApiError.badRequest('Validation failed', details, 'VALIDATION_ERROR');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', details, 'VALIDATION_ERROR');
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`, undefined, 'INVALID_ID');
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`, 'DUPLICATE');
  }
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body', undefined, 'INVALID_JSON');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  if (err?.status && err.status >= 400 && err.status < 500 && err.expose) {
    return new ApiError(err.status, 'BAD_REQUEST', err.message);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const apiErr = normalise(err);

  if (!apiErr) {
    req.log?.error({ err }, 'Unhandled error');
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        ...(env.isProd ? {} : { debug: err.message }),
      },
    });
  }

  if (apiErr.status >= 500) req.log?.error({ err }, apiErr.message);
  return res.status(apiErr.status).json({
    error: { code: apiErr.code, message: apiErr.message, ...(apiErr.details ? { details: apiErr.details } : {}) },
  });
}

module.exports = { notFound, errorHandler };
