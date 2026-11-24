'use strict';

/**
 * Direct-to-Cloudinary uploads. The API never handles file bytes (good for
 * free-tier hosts with small memory/ephemeral disks): it signs upload params,
 * the browser uploads straight to Cloudinary and sends back the resulting URL.
 */
const crypto = require('node:crypto');
const env = require('../config/env');
const ApiError = require('../lib/ApiError');

const FOLDERS = { avatar: 'avatars', thumbnail: 'course-thumbnails', video: 'lesson-videos', resource: 'lesson-resources' };
// Signed, so a signature issued for an avatar can't be replayed to upload videos or arbitrary files.
// For hard size limits, also create signed upload presets in the Cloudinary console.
const FORMATS = {
  avatar: 'jpg,jpeg,png,webp',
  thumbnail: 'jpg,jpeg,png,webp',
  video: 'mp4,webm,mov',
  resource: 'pdf,zip,txt,md,png,jpg',
};

function signUpload({ kind, userId }) {
  if (!env.features.uploads) throw ApiError.unavailable('File uploads are not configured on this server', 'UPLOADS_DISABLED');
  const params = {
    allowed_formats: FORMATS[kind],
    folder: `rivera/${FOLDERS[kind]}/${userId}`,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + env.CLOUDINARY_API_SECRET).digest('hex');
  const resourceType = kind === 'video' ? 'video' : kind === 'resource' ? 'raw' : 'image';
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    fields: { ...params, api_key: env.CLOUDINARY_API_KEY, signature },
  };
}

module.exports = { signUpload, UPLOAD_KINDS: Object.keys(FOLDERS) };
