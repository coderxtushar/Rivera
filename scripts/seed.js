'use strict';

/**
 * Seed the database. Safe to run repeatedly.
 *
 *   npm run seed                 categories + admin (from ADMIN_EMAIL / ADMIN_PASSWORD)
 *   npm run seed -- --demo       …plus demo instructors, students, courses and reviews (scripts/demo-data.js)
 */
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Category, Course, Lesson, Enrollment, Review } = require('../src/models');
const { uniqueSlug, slugify } = require('../src/lib/util');
const { recalcCurriculumStats, recalcRatingStats } = require('../src/services/course.service');
const { INSTRUCTORS, STUDENTS, COURSES } = require('./demo-data');

const CATEGORIES = [
  ['Web Development', 'Frontend, backend and full-stack web engineering'],
  ['Data Science', 'Analysis, machine learning and AI'],
  ['Mobile Development', 'iOS, Android and cross-platform apps'],
  ['DevOps & Cloud', 'Infrastructure, CI/CD and cloud platforms'],
  ['Design', 'UI/UX, product and graphic design'],
  ['Business', 'Entrepreneurship, management and strategy'],
  ['Marketing', 'Digital marketing, SEO and growth'],
  ['Personal Development', 'Productivity, communication and careers'],
];

const DEMO_PASSWORD = 'password123';

async function upsertUser({ email, password, ...fields }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, isEmailVerified: true, ...fields });
    await user.setPassword(password);
  } else {
    Object.assign(user, fields);
  }
  await user.save();
  return user;
}

async function seedCategories() {
  const byName = {};
  for (const [name, description] of CATEGORIES) {
    // eslint-disable-next-line no-await-in-loop
    let cat = await Category.findOne({ name });
    // eslint-disable-next-line no-await-in-loop
    if (!cat) cat = await Category.create({ name, description, slug: await uniqueSlug(Category, name) });
    byName[name] = cat;
  }
  console.log(`✓ ${CATEGORIES.length} categories`);
  return byName;
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('• Skipping admin (set ADMIN_EMAIL and ADMIN_PASSWORD to create one)');
    return;
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await upsertUser({ email: email.toLowerCase(), password, firstName: 'Admin', role: 'admin' });
  console.log(`✓ admin ${email}`);
}

const VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
/** Covers are served by the website from web/public/covers/<slug>.jpg. */
const coverFor = (title) => `/covers/${slugify(title)}.jpg`;

function lessonNotes(title, summary, courseTitle) {
  return `${summary}\n\n## In this lesson\n\n- What **${title.toLowerCase()}** means in practice\n- A worked example you can follow along with\n- Common mistakes, and how to avoid them\n\n> Try it yourself before moving on. The next lessons in *${courseTitle}* build on this one.`;
}

function articleBody(title, summary) {
  return `# ${title}\n\n${summary}\n\n## Use it like this\n\n1. Read it once now.\n2. Keep it open while you work through the next exercises.\n3. Come back to it when you get stuck.\n\n## Quick reference\n\n- Start with the simplest thing that could work.\n- Check your assumptions with a small example.\n- Write down what you learned so you can reuse it.`;
}

/** Deterministic pseudo-random 0..1 from a string, so re-runs behave the same. */
function rand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

async function createCourse(spec, instructorId, categoryId) {
  const course = new Course({
    title: spec.title,
    slug: await uniqueSlug(Course, spec.title),
    subtitle: spec.subtitle,
    thumbnailUrl: coverFor(spec.title),
    description: `${spec.subtitle}. This hands-on course walks you through every idea with real examples and short exercises, so you finish with skills you can use straight away.\n\n**Who it's for:** anyone who wants a clear, practical path through ${spec.tags.slice(0, 2).join(' and ')}.`,
    instructor: instructorId,
    category: categoryId,
    level: spec.level,
    price: spec.price,
    currency: env.DEFAULT_CURRENCY,
    tags: spec.tags,
    outcomes: spec.outcomes,
    requirements: spec.requirements || ['A computer with internet access', 'Curiosity'],
    status: 'published',
    isFeatured: Boolean(spec.featured),
    publishedAt: new Date(Date.now() - rand(spec.title) * 60 * 86_400_000),
    sections: spec.sections.map(([title], order) => ({ title, order })),
  });
  await course.save();
  const lessons = course.sections.flatMap((section, si) =>
    spec.sections[si][1].map(([rawTitle, summary], order) => {
      const article = rawTitle.startsWith('📄 ');
      const title = article ? rawTitle.slice(3) : rawTitle;
      return {
        course: course._id,
        section: section._id,
        title,
        order,
        type: article ? 'article' : 'video',
        videoUrl: article ? '' : VIDEO,
        durationSec: article ? 180 : 240 + Math.round(rand(title) * 9) * 60,
        isPreview: si === 0 && order === 0,
        content: article ? articleBody(title, summary) : lessonNotes(title, summary, spec.title),
      };
    }),
  );
  await Lesson.insertMany(lessons);
  await recalcCurriculumStats(course._id);
  return course;
}

async function seedDemo(categories) {
  const users = {};
  for (const [key, u] of Object.entries(INSTRUCTORS)) {
    // eslint-disable-next-line no-await-in-loop
    users[key] = await upsertUser({ ...u, password: DEMO_PASSWORD, role: 'instructor', instructorStatus: 'approved' });
  }
  for (const [key, u] of Object.entries(STUDENTS)) {
    // eslint-disable-next-line no-await-in-loop
    users[key] = await upsertUser({ ...u, password: DEMO_PASSWORD });
  }

  let created = 0;
  let reviewsAdded = 0;
  let reassigned = 0;
  for (const spec of COURSES) {
    // eslint-disable-next-line no-await-in-loop
    let course = await Course.findOne({ title: spec.title });
    if (!course) {
      // eslint-disable-next-line no-await-in-loop
      course = await createCourse(spec, users[spec.instructor]._id, categories[spec.category]._id);
      created += 1;
    }
    // Courses from older demo seeds may belong to another demo instructor; reassign
    // them, but never take a course away from a real (non-demo) account.
    const owner = users[spec.instructor];
    if (String(course.instructor) !== String(owner._id)) {
      // eslint-disable-next-line no-await-in-loop
      const current = await User.findById(course.instructor).select('email').lean();
      if (!current || current.email.endsWith('@demo.rivera.dev')) {
        // eslint-disable-next-line no-await-in-loop
        await Course.updateOne({ _id: course._id }, { instructor: owner._id });
        reassigned += 1;
      }
    }
    const lessonIds = (await Lesson.find({ course: course._id }).sort({ order: 1 }).distinct('_id')); // eslint-disable-line no-await-in-loop

    // Reviewers are enrolled students with some progress; some have finished.
    for (const [studentKey, rating, comment] of spec.reviews || []) {
      const userId = users[studentKey]._id;
      const done = Math.round(lessonIds.length * (rating === 5 ? 1 : 0.4 + rand(studentKey + spec.title) * 0.5));
      // eslint-disable-next-line no-await-in-loop
      await Enrollment.updateOne(
        { user: userId, course: course._id },
        {
          $setOnInsert: {
            source: spec.price === 0 ? 'free' : 'admin_grant',
            pricePaid: 0,
            currency: course.currency,
            'progress.completedLessons': lessonIds.slice(0, done),
            'progress.percent': lessonIds.length ? Math.round((done / lessonIds.length) * 100) : 0,
            'progress.lastLesson': lessonIds[Math.max(0, done - 1)],
            'progress.lastAccessedAt': new Date(Date.now() - rand(studentKey) * 20 * 86_400_000),
          },
        },
        { upsert: true },
      );
      // eslint-disable-next-line no-await-in-loop
      const res = await Review.updateOne(
        { user: userId, course: course._id },
        { $setOnInsert: { rating, comment, createdAt: new Date(Date.now() - rand(comment) * 45 * 86_400_000) } },
        { upsert: true, timestamps: false },
      );
      reviewsAdded += res.upsertedCount;
    }
    // Give demo courses their cover, unless someone has set their own image.
    if (!course.thumbnailUrl || course.thumbnailUrl.startsWith('/covers/')) {
      // eslint-disable-next-line no-await-in-loop
      await Course.updateOne({ _id: course._id }, { thumbnailUrl: coverFor(spec.title) });
    }
    // Keep denormalised counters exact.
    // eslint-disable-next-line no-await-in-loop
    const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
    // eslint-disable-next-line no-await-in-loop
    await Course.updateOne({ _id: course._id }, { 'stats.enrollmentCount': enrollmentCount, ...(spec.featured ? { isFeatured: true } : {}) });
    // eslint-disable-next-line no-await-in-loop
    await recalcRatingStats(course._id);
  }
  console.log(`✓ demo data: ${Object.keys(INSTRUCTORS).length} instructors, ${Object.keys(STUDENTS).length} students, ${created} new courses (${COURSES.length} total), ${reviewsAdded} new reviews, ${reassigned} reassigned`);
  console.log(`  sign in as instructor@demo.rivera.dev or student@demo.rivera.dev / ${DEMO_PASSWORD}`);
}

async function main() {
  const demo = process.argv.includes('--demo');
  if (demo && env.isProd && !process.argv.includes('--force')) {
    throw new Error('Refusing to seed demo data in production (pass --force if you really mean it)');
  }
  await connectDB();
  const categories = await seedCategories();
  await seedAdmin();
  if (demo) await seedDemo(categories);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
