'use strict';

/**
 * Test harness: in-memory MongoDB + the real Express app.
 * Env vars must be set before any src/ module is required.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder/test';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.PLATFORM_FEE_PERCENT = '20';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongo;
let app;

async function setup() {
  mongo = await MongoMemoryServer.create();
  const { connectDB } = require('../src/config/db');
  await connectDB(mongo.getUri());
  const models = require('../src/models');
  await Promise.all(Object.values(models).map((m) => m.init())); // build unique indexes
  app = require('../src/app').createApp();
  return app;
}

async function teardown() {
  await mongoose.disconnect();
  await mongo?.stop();
}

const api = () => request(app);

let counter = 0;
/** Create a user directly and sign in through the API. Returns { user, token, agent }. */
async function createUser({ role = 'student', password = 'password123', ...rest } = {}) {
  const { User } = require('../src/models');
  counter += 1;
  const user = new User({
    email: `user${counter}-${Date.now()}@example.com`,
    firstName: rest.firstName || `User${counter}`,
    lastName: 'Test',
    role,
    instructorStatus: role === 'instructor' ? 'approved' : 'none',
    isEmailVerified: true,
    ...rest,
  });
  await user.setPassword(password);
  await user.save();
  const res = await api().post('/api/v1/auth/signin').send({ email: user.email, password });
  if (res.status !== 200) throw new Error(`signin failed: ${JSON.stringify(res.body)}`);
  return { user, token: res.body.data.accessToken, auth: { Authorization: `Bearer ${res.body.data.accessToken}` } };
}

/** Instructor + published course with one section and `lessons` lessons. */
async function createPublishedCourse(instructor, { price = 49900, lessons = 2, title } = {}) {
  const c = await api()
    .post('/api/v1/courses')
    .set(instructor.auth)
    .send({
      title: title || `Course ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`,
      description: 'A thorough course description that is definitely longer than fifty characters.',
      price,
    });
  if (c.status !== 201) throw new Error(JSON.stringify(c.body));
  const course = c.body.data.course;
  const s = await api().post(`/api/v1/courses/${course._id}/sections`).set(instructor.auth).send({ title: 'Intro' });
  const section = s.body.data.section;
  const lessonDocs = [];
  for (let i = 0; i < lessons; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const l = await api()
      .post(`/api/v1/courses/${course._id}/sections/${section._id}/lessons`)
      .set(instructor.auth)
      .send({ title: `Lesson ${i + 1}`, videoUrl: 'https://example.com/v.mp4', durationSec: 300, isPreview: i === 0, content: `Body ${i + 1}` });
    lessonDocs.push(l.body.data.lesson);
  }
  const p = await api().post(`/api/v1/courses/${course._id}/publish`).set(instructor.auth);
  if (p.status !== 200) throw new Error(JSON.stringify(p.body));
  return { course: p.body.data.course, section, lessons: lessonDocs };
}

function lastMail(template) {
  const { outbox } = require('../src/lib/mailer');
  return [...outbox].reverse().find((m) => m.template === template);
}

const tokenFromUrl = (url) => new URL(url).searchParams.get('token');

module.exports = { setup, teardown, api, createUser, createPublishedCourse, lastMail, tokenFromUrl };
