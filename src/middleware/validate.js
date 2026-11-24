'use strict';

const { z } = require('zod');
const { isObjectId } = require('../lib/util');

/**
 * Validate and coerce request input with zod. Parsed values land on
 * `req.valid.{body,query,params}`; `req.body` is replaced too. Unknown body keys
 * are stripped, which also blocks mass-assignment of protected fields.
 */
function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      // Throws ZodError → rendered as 400 by the error handler.
      req.valid[part] = schemas[part].parse(req[part] ?? {});
    }
    if (req.valid.body) req.body = req.valid.body;
    next();
  };
}

// Shared building blocks
const objectId = z.string().refine(isObjectId, 'Invalid id');
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};
const url = z.union([z.url({ protocol: /^https?$/ }).max(2000), z.literal('')]);
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const email = z.email().max(254).transform((v) => v.toLowerCase().trim());

module.exports = { validate, z, objectId, pagination, url, password, email };
