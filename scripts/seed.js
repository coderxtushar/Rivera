'use strict';

/**
 * Seed the database. Safe to run repeatedly.
 *
 *   npm run seed                 categories + admin (from ADMIN_EMAIL / ADMIN_PASSWORD)
 *   npm run seed -- --demo       …plus a demo instructor, student and published courses
 */
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Category, Course, Lesson } = require('../src/models');
const { uniqueSlug } = require('../src/lib/util');
const { recalcCurriculumStats } = require('../src/services/course.service');

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

const DEMO_COURSES = [
  {
    title: 'Modern JavaScript: From Basics to Async',
    subtitle: 'Learn the language of the web the right way',
    category: 'Web Development',
    level: 'beginner',
    price: 0,
    tags: ['javascript', 'web'],
    outcomes: ['Write modern ES2025 JavaScript', 'Understand promises and async/await', 'Work with modules'],
    sections: [
      ['Getting started', ['Why JavaScript?', 'Setting up your editor', 'Your first script']],
      ['Core language', ['Variables and types', 'Functions and closures', 'Objects and arrays']],
      ['Async JavaScript', ['The event loop', 'Promises', 'async/await in practice']],
    ],
  },
  {
    title: 'Build REST APIs with Node.js and MongoDB',
    subtitle: 'Design, secure and deploy a production-ready API',
    category: 'Web Development',
    level: 'intermediate',
    price: 149900,
    tags: ['node', 'express', 'mongodb', 'api'],
    outcomes: ['Design clean REST endpoints', 'Model data with Mongoose', 'Add auth with JWT and refresh tokens', 'Deploy for free'],
    sections: [
      ['Foundations', ['HTTP and REST refresher', 'Express routing', 'Middleware explained']],
      ['Data', ['MongoDB and Mongoose', 'Schema design', 'Indexes and performance']],
      ['Security & deployment', ['Authentication', 'Rate limiting and CORS', 'Deploying to Render']],
    ],
  },
  {
    title: 'Practical Data Analysis with Python',
    subtitle: 'pandas, plotting and real datasets',
    category: 'Data Science',
    level: 'beginner',
    price: 99900,
    tags: ['python', 'pandas', 'data'],
    outcomes: ['Clean messy data with pandas', 'Visualise results', 'Answer questions with data'],
    sections: [
      ['Python for data', ['Notebooks', 'NumPy essentials']],
      ['pandas', ['DataFrames', 'Grouping and aggregation', 'Joining datasets']],
    ],
  },
];

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

async function seedDemo(categories) {
  const instructor = await upsertUser({
    email: 'instructor@demo.rivera.dev',
    password: DEMO_PASSWORD,
    firstName: 'Maya',
    lastName: 'Rao',
    role: 'instructor',
    instructorStatus: 'approved',
    headline: 'Senior engineer & educator',
    bio: 'Maya has shipped web platforms for a decade and loves teaching fundamentals.',
  });
  await upsertUser({ email: 'student@demo.rivera.dev', password: DEMO_PASSWORD, firstName: 'Sam', lastName: 'Lee' });

  for (const spec of DEMO_COURSES) {
    // eslint-disable-next-line no-await-in-loop
    if (await Course.exists({ title: spec.title })) continue;
    const course = new Course({
      title: spec.title,
      slug: await uniqueSlug(Course, spec.title), // eslint-disable-line no-await-in-loop
      subtitle: spec.subtitle,
      description: `${spec.subtitle}. This hands-on course walks you through every concept with real examples, exercises and a final project you can show off.`,
      instructor: instructor._id,
      category: categories[spec.category]._id,
      level: spec.level,
      price: spec.price,
      currency: env.DEFAULT_CURRENCY,
      tags: spec.tags,
      outcomes: spec.outcomes,
      requirements: ['A computer with internet access', 'Curiosity'],
      status: 'published',
      publishedAt: new Date(),
      sections: spec.sections.map(([title], order) => ({ title, order })),
    });
    // eslint-disable-next-line no-await-in-loop
    await course.save();
    const lessons = course.sections.flatMap((section, si) =>
      spec.sections[si][1].map((title, order) => ({
        course: course._id,
        section: section._id,
        title,
        order,
        type: 'video',
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        durationSec: 300 + order * 120,
        isPreview: si === 0 && order === 0,
        content: `Notes for **${title}**.`,
      })),
    );
    // eslint-disable-next-line no-await-in-loop
    await Lesson.insertMany(lessons);
    // eslint-disable-next-line no-await-in-loop
    await recalcCurriculumStats(course._id);
  }
  console.log(`✓ demo data — sign in as instructor@demo.rivera.dev or student@demo.rivera.dev / ${DEMO_PASSWORD}`);
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
