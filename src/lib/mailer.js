'use strict';

/**
 * Transactional email. Uses SMTP when configured (Brevo, Resend, Mailtrap,
 * Gmail app password… all have free tiers). Without SMTP, emails are logged —
 * handy in development because verification/reset links show up in the console.
 * In tests, emails are captured in `outbox` for assertions.
 */
const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

const outbox = [];
let transport;

function getTransport() {
  if (!transport && env.features.email) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
<h2 style="margin-top:0">${escapeHtml(title)}</h2>${bodyHtml}
<p style="color:#888;font-size:12px;margin-top:32px">You received this email because of activity on your Rivera account.</p>
</body></html>`;
}

const button = (url, label) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>
<p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${escapeHtml(url)}</p>`;

const templates = {
  verifyEmail: ({ name, url }) => ({
    subject: 'Verify your email',
    text: `Hi ${name},\n\nConfirm your email address: ${url}\n\nThis link expires in 24 hours.`,
    html: layout('Verify your email', `<p>Hi ${escapeHtml(name)},</p><p>Confirm your email address to finish setting up your account.</p>${button(url, 'Verify email')}<p>This link expires in 24 hours.</p>`),
  }),
  resetPassword: ({ name, url }) => ({
    subject: 'Reset your password',
    text: `Hi ${name},\n\nReset your password: ${url}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
    html: layout('Reset your password', `<p>Hi ${escapeHtml(name)},</p><p>Someone asked to reset your password.</p>${button(url, 'Choose a new password')}<p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`),
  }),
  enrollmentConfirmed: ({ name, courseTitle, url, amountText }) => ({
    subject: `You're enrolled: ${courseTitle}`,
    text: `Hi ${name},\n\nYou now have access to "${courseTitle}".${amountText ? ` Amount paid: ${amountText}.` : ''}\n\nStart learning: ${url}`,
    html: layout("You're enrolled", `<p>Hi ${escapeHtml(name)},</p><p>You now have access to <strong>${escapeHtml(courseTitle)}</strong>.${amountText ? ` Amount paid: ${escapeHtml(amountText)}.` : ''}</p>${button(url, 'Start learning')}`),
  }),
  certificateIssued: ({ name, courseTitle, url }) => ({
    subject: `Certificate earned: ${courseTitle}`,
    text: `Congratulations ${name}! You completed "${courseTitle}". View your certificate: ${url}`,
    html: layout('Congratulations!', `<p>Hi ${escapeHtml(name)},</p><p>You completed <strong>${escapeHtml(courseTitle)}</strong>.</p>${button(url, 'View certificate')}`),
  }),
};

/**
 * Fire-and-forget send. Never throws: an email outage must not fail the
 * request that triggered it.
 */
async function sendMail(to, templateName, data) {
  const message = { to, from: env.MAIL_FROM, ...templates[templateName](data) };
  if (env.isTest) {
    outbox.push({ template: templateName, data, ...message });
    return;
  }
  const t = getTransport();
  if (!t) {
    // Links carry live tokens: show them in dev for convenience, never in production logs.
    logger.info({ to, subject: message.subject, ...(env.isProd ? {} : { data }) }, 'Email (SMTP not configured — not sent)');
    return;
  }
  try {
    await t.sendMail(message);
  } catch (err) {
    logger.error({ err, to, template: templateName }, 'Failed to send email');
  }
}

module.exports = { sendMail, outbox };
