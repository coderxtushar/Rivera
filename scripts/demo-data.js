'use strict';

/**
 * Demo catalog for `npm run seed -- --demo`: instructors, students, courses
 * (two or more per category) and reviews. All people are fictional.
 * Prices are in paise (49900 = ₹499). Lessons are [title, summary] pairs;
 * prefix a title with "📄 " to make it a written (article) lesson.
 */

const INSTRUCTORS = {
  maya: {
    email: 'instructor@demo.rivera.dev',
    firstName: 'Maya',
    lastName: 'Rao',
    headline: 'Senior engineer and educator',
    bio: 'Maya has shipped web platforms for a decade and loves teaching fundamentals that last longer than frameworks.',
  },
  arjun: {
    email: 'arjun@demo.rivera.dev',
    firstName: 'Arjun',
    lastName: 'Mehta',
    headline: 'Data scientist turned teacher',
    bio: 'Arjun spent eight years building forecasting and recommendation systems before moving into full-time teaching. He explains the maths only as far as you need it.',
  },
  priya: {
    email: 'priya@demo.rivera.dev',
    firstName: 'Priya',
    lastName: 'Nair',
    headline: 'Product designer, design systems lead',
    bio: 'Priya leads design systems for consumer apps used by millions. She teaches design as a craft you can practise, not a talent you are born with.',
  },
  daniel: {
    email: 'daniel@demo.rivera.dev',
    firstName: 'Daniel',
    lastName: 'Okafor',
    headline: 'Platform engineer and mobile developer',
    bio: 'Daniel runs infrastructure for a fintech startup and builds mobile apps on the side. His courses are hands-on: every lesson ends with something running.',
  },
  elena: {
    email: 'elena@demo.rivera.dev',
    firstName: 'Elena',
    lastName: 'García',
    headline: 'Growth marketer and founder',
    bio: 'Elena has launched three small businesses and advised dozens more on marketing. She focuses on what works with small budgets and no big team.',
  },
  kabir: {
    email: 'kabir@demo.rivera.dev',
    firstName: 'Kabir',
    lastName: 'Sethi',
    headline: 'Coach for focus and communication',
    bio: 'Kabir trains engineers and managers in focus, communication and public speaking. Former debate champion, current recovering perfectionist.',
  },
};

const STUDENTS = {
  sam: { email: 'student@demo.rivera.dev', firstName: 'Sam', lastName: 'Lee' },
  ananya: { email: 'ananya@demo.rivera.dev', firstName: 'Ananya', lastName: 'Iyer' },
  rohan: { email: 'rohan@demo.rivera.dev', firstName: 'Rohan', lastName: 'Kapoor' },
  meera: { email: 'meera@demo.rivera.dev', firstName: 'Meera', lastName: 'Pillai' },
  tom: { email: 'tom@demo.rivera.dev', firstName: 'Tom', lastName: 'Becker' },
  fatima: { email: 'fatima@demo.rivera.dev', firstName: 'Fatima', lastName: 'Khan' },
  vikram: { email: 'vikram@demo.rivera.dev', firstName: 'Vikram', lastName: 'Joshi' },
  lucia: { email: 'lucia@demo.rivera.dev', firstName: 'Lucía', lastName: 'Moreno' },
};

const COURSES = [
  /* ------------------------------------------------------- Web Development */
  {
    title: 'Modern JavaScript: From Basics to Async',
    subtitle: 'Learn the language of the web the right way',
    instructor: 'maya',
    category: 'Web Development',
    level: 'beginner',
    price: 0,
    tags: ['javascript', 'web'],
    outcomes: ['Write modern JavaScript with confidence', 'Understand promises and async/await', 'Organise code with modules'],
    sections: [
      ['Getting started', [['Why JavaScript?', 'Where JavaScript runs today and why it is worth learning properly.'], ['Setting up your editor', 'Install VS Code, Node.js and the extensions that save you time.'], ['Your first script', 'Run code in the browser console and in Node, and see the difference.']]],
      ['Core language', [['Variables and types', 'let, const, primitives and objects, and why var is best avoided.'], ['Functions and closures', 'Function declarations, arrow functions and how closures remember scope.'], ['Objects and arrays', 'Destructuring, spread and the array methods you will use every day.']]],
      ['Async JavaScript', [['The event loop', 'How one thread handles timers, network calls and clicks without blocking.'], ['Promises', 'Create, chain and combine promises, and handle errors cleanly.'], ['async/await in practice', 'Rewrite promise chains with async/await and fetch real data.']]],
    ],
    reviews: [['sam', 5, 'Clear explanations, and the async section finally made promises click for me.'], ['ananya', 5, 'Perfect first course. Short lessons that each teach one thing.'], ['tom', 4, 'Great free course. I would have liked one more exercise on closures.']],
    featured: true,
  },
  {
    title: 'Build REST APIs with Node.js and MongoDB',
    subtitle: 'Design, secure and deploy a production-ready API',
    instructor: 'maya',
    category: 'Web Development',
    level: 'intermediate',
    price: 149900,
    tags: ['node', 'express', 'mongodb', 'api'],
    outcomes: ['Design clean REST endpoints', 'Model data with Mongoose', 'Add auth with JWT and refresh tokens', 'Deploy for free'],
    sections: [
      ['Foundations', [['HTTP and REST refresher', 'Methods, status codes and resource naming that other developers expect.'], ['Express routing', 'Routers, params and query strings, organised by feature.'], ['Middleware explained', 'How the request pipeline works and how to write your own middleware.']]],
      ['Data', [['MongoDB and Mongoose', 'Connect, define schemas and run your first queries.'], ['Schema design', 'Embed or reference? Model data around how your app reads it.'], ['Indexes and performance', 'Read explain plans and add the indexes your queries need.']]],
      ['Security and deployment', [['Authentication', 'Hash passwords, issue short-lived tokens and rotate refresh tokens.'], ['Rate limiting and CORS', 'Protect login endpoints and allow only your own frontend.'], ['Deploying to Render', 'Ship the API on a free tier with environment variables and health checks.']]],
    ],
    reviews: [['rohan', 5, 'The refresh-token section alone was worth it. Production advice, not toy examples.'], ['fatima', 4, 'Very practical. The deployment lesson saved me a weekend.']],
    featured: true,
  },
  {
    title: 'React from the Ground Up',
    subtitle: 'Components, state and data fetching without the confusion',
    instructor: 'maya',
    category: 'Web Development',
    level: 'intermediate',
    price: 129900,
    tags: ['react', 'frontend', 'javascript'],
    outcomes: ['Think in components and props', 'Manage state and side effects correctly', 'Fetch, cache and update server data', 'Structure a real React project'],
    requirements: ['Comfortable with modern JavaScript'],
    sections: [
      ['Thinking in React', [['Components and JSX', 'Break a screen into components and describe UI with JSX.'], ['Props and composition', 'Pass data down and compose components instead of copying them.'], ['📄 React mental model cheat sheet', 'A one-page summary of rendering, state and effects to keep open while you work.']]],
      ['State and effects', [['useState in depth', 'Update state safely, including arrays and objects.'], ['When you do not need an effect', 'Derive values during render instead of syncing them with effects.'], ['Forms that feel good', 'Controlled inputs, validation and helpful error messages.']]],
      ['Working with data', [['Fetching data', 'Load data with loading and error states that do not flicker.'], ['Caching with TanStack Query', 'Cache, refetch and invalidate server data with very little code.'], ['Optimistic updates', 'Update the UI before the server answers, and roll back on failure.']]],
    ],
    reviews: [['ananya', 5, 'The lesson on when you do not need an effect changed how I write React.'], ['vikram', 4, 'Well paced. The cheat sheet is now pinned on my wall.'], ['lucia', 5, 'Clearest explanation of state I have found anywhere.']],
  },

  /* ----------------------------------------------------------- Data Science */
  {
    title: 'Practical Data Analysis with Python',
    subtitle: 'pandas, plotting and real datasets',
    instructor: 'arjun',
    category: 'Data Science',
    level: 'beginner',
    price: 99900,
    tags: ['python', 'pandas', 'data'],
    outcomes: ['Clean messy data with pandas', 'Visualise results clearly', 'Answer real questions with data'],
    sections: [
      ['Python for data', [['Notebooks', 'Work in Jupyter notebooks and keep your analysis reproducible.'], ['NumPy essentials', 'Arrays, vectorised maths and why loops are slow.']]],
      ['pandas', [['DataFrames', 'Load CSVs, select columns and filter rows.'], ['Grouping and aggregation', 'Summarise data with groupby, pivot tables and custom aggregations.'], ['Joining datasets', 'Merge tables without duplicating or losing rows.']]],
    ],
    reviews: [['meera', 5, 'I used the grouping lesson at work the very next day.'], ['sam', 4, 'Good pace for beginners. The datasets feel real, not made up.']],
    featured: true,
  },
  {
    title: 'SQL for Analysts',
    subtitle: 'Query any database and answer business questions fast',
    instructor: 'arjun',
    category: 'Data Science',
    level: 'beginner',
    price: 79900,
    tags: ['sql', 'analytics', 'postgres'],
    outcomes: ['Write SELECT queries with filters and sorting', 'Join tables correctly', 'Use window functions for rankings and running totals', 'Turn questions into queries'],
    sections: [
      ['Querying basics', [['Your first SELECT', 'Pick columns, filter rows and sort results.'], ['Filtering like a pro', 'AND, OR, IN, LIKE and the NULL traps that catch everyone.'], ['Aggregations', 'COUNT, SUM, AVG with GROUP BY and HAVING.']]],
      ['Combining data', [['Inner and outer joins', 'Choose the right join and check you did not duplicate rows.'], ['Subqueries and CTEs', 'Break hard questions into readable steps with WITH.'], ['📄 Join debugging checklist', 'Five checks to run when your numbers look wrong after a join.']]],
      ['Analytics patterns', [['Window functions', 'Rankings, running totals and period-over-period changes.'], ['Cohorts and retention', 'Build a retention table from raw event data.'], ['Writing queries others can read', 'Formatting and naming that make queries easy to review.']]],
    ],
    reviews: [['tom', 5, 'Window functions finally make sense. Excellent examples.'], ['fatima', 5, 'The join debugging checklist is gold.'], ['rohan', 4, 'Solid course. Would love a follow-up on query performance.']],
  },
  {
    title: 'Machine Learning Foundations with scikit-learn',
    subtitle: 'Build, evaluate and explain your first real models',
    instructor: 'arjun',
    category: 'Data Science',
    level: 'intermediate',
    price: 199900,
    tags: ['machine learning', 'python', 'scikit-learn'],
    outcomes: ['Frame problems as regression or classification', 'Train and tune models with scikit-learn', 'Evaluate models honestly', 'Explain predictions to non-experts'],
    requirements: ['Basic Python and pandas', 'High-school maths'],
    sections: [
      ['How models learn', [['What machine learning is (and is not)', 'Where ML helps, where simple rules win, and how to tell the difference.'], ['Train, validation and test', 'Split data so your accuracy numbers mean something.'], ['Your first model', 'Fit a linear regression and read its coefficients.']]],
      ['Core algorithms', [['Logistic regression', 'Classify outcomes and understand probabilities.'], ['Decision trees and forests', 'Non-linear models that are surprisingly easy to explain.'], ['Gradient boosting', 'The workhorse of tabular data and how to tune it.']]],
      ['Doing it properly', [['Metrics that matter', 'Precision, recall and choosing a threshold for your use case.'], ['Pipelines and leakage', 'Avoid the mistakes that make models fail in production.'], ['Explaining predictions', 'Feature importance and SHAP values for stakeholders.']]],
    ],
    reviews: [['vikram', 5, 'Honest about evaluation in a way most courses are not. Highly recommended.'], ['meera', 4, 'Challenging but fair. The leakage lesson was eye-opening.']],
  },

  /* ----------------------------------------------------- Mobile Development */
  {
    title: 'Build Mobile Apps with React Native',
    subtitle: 'One codebase for iOS and Android, shipped to real phones',
    instructor: 'daniel',
    category: 'Mobile Development',
    level: 'intermediate',
    price: 179900,
    tags: ['react native', 'expo', 'mobile'],
    outcomes: ['Build screens with React Native components', 'Navigate between screens', 'Store data on the device', 'Publish a test build to your phone'],
    requirements: ['Some React experience'],
    sections: [
      ['Getting set up', [['Expo in ten minutes', 'Create a project and run it on your own phone.'], ['Core components', 'View, Text, Image and ScrollView, and how they differ from the web.'], ['Styling and layout', 'Flexbox on mobile and handling different screen sizes.']]],
      ['App structure', [['Navigation', 'Stacks, tabs and passing data between screens.'], ['Lists that scroll smoothly', 'FlatList, keys and keeping long lists fast.'], ['Device storage', 'Save settings and offline data with secure storage.']]],
      ['Shipping', [['Push notifications', 'Ask permission politely and send your first notification.'], ['Builds and testing', 'Create builds with EAS and share them with testers.'], ['📄 Store submission checklist', 'Screenshots, privacy details and review tips for both stores.']]],
    ],
    reviews: [['rohan', 5, 'Had an app on my phone within the first hour. Great momentum.'], ['lucia', 4, 'Very practical. The store checklist is a nice touch.']],
  },
  {
    title: 'Flutter for Beginners',
    subtitle: 'Build beautiful cross-platform apps with Dart and Flutter',
    instructor: 'daniel',
    category: 'Mobile Development',
    level: 'beginner',
    price: 0,
    tags: ['flutter', 'dart', 'mobile'],
    outcomes: ['Write basic Dart', 'Compose Flutter widgets', 'Manage simple app state', 'Build a complete to-do app'],
    sections: [
      ['Dart basics', [['Hello, Dart', 'Variables, types and functions in Dart.'], ['Classes and null safety', 'Model data safely and avoid null crashes.']]],
      ['Widgets', [['Everything is a widget', 'Stateless and stateful widgets and the widget tree.'], ['Layout widgets', 'Row, Column, Stack and padding without the pain.'], ['Handling input', 'Buttons, text fields and forms.']]],
      ['Your first app', [['Building a to-do app', 'Put it together: add, complete and delete tasks.'], ['Saving tasks', 'Persist tasks so they survive app restarts.']]],
    ],
    reviews: [['sam', 4, 'Great free intro. The to-do project ties it all together.'], ['ananya', 5, 'I had never written Dart before and finished with a working app.']],
  },

  /* --------------------------------------------------------- DevOps & Cloud */
  {
    title: 'Docker and Kubernetes in Practice',
    subtitle: 'Containerise apps and run them reliably in production',
    instructor: 'daniel',
    category: 'DevOps & Cloud',
    level: 'intermediate',
    price: 199900,
    tags: ['docker', 'kubernetes', 'devops'],
    outcomes: ['Write efficient Dockerfiles', 'Run multi-service apps with Compose', 'Deploy to Kubernetes', 'Debug failing pods'],
    requirements: ['Comfortable on the command line'],
    sections: [
      ['Containers', [['Why containers', 'The problems containers solve and the ones they do not.'], ['Writing a Dockerfile', 'Layers, caching and multi-stage builds for small images.'], ['Docker Compose', 'Run an app, a database and a cache together locally.']]],
      ['Kubernetes basics', [['Pods, deployments and services', 'The three objects you need to run anything.'], ['Configuration and secrets', 'ConfigMaps, Secrets and keeping credentials out of images.'], ['Health checks and rollouts', 'Readiness probes and zero-downtime deploys.']]],
      ['Operating it', [['Logs and debugging', 'kubectl commands that find problems fast.'], ['Scaling', 'Horizontal autoscaling and resource limits.'], ['📄 Production readiness checklist', 'What to verify before real traffic arrives.']]],
    ],
    reviews: [['vikram', 5, 'Finally understood Kubernetes without drowning in jargon.'], ['tom', 4, 'Dense but rewarding. The debugging lesson is excellent.'], ['fatima', 5, 'The multi-stage build lesson cut our image size by 80%.']],
    featured: true,
  },
  {
    title: 'Git and GitHub for Teams',
    subtitle: 'Branches, pull requests and a workflow that scales',
    instructor: 'daniel',
    category: 'DevOps & Cloud',
    level: 'beginner',
    price: 0,
    tags: ['git', 'github', 'collaboration'],
    outcomes: ['Commit, branch and merge with confidence', 'Resolve merge conflicts calmly', 'Review code through pull requests', 'Undo mistakes safely'],
    sections: [
      ['Git essentials', [['How Git thinks', 'Commits, snapshots and the three areas of Git.'], ['Branching and merging', 'Create branches, merge them and read the history.']]],
      ['Working with others', [['Remotes and GitHub', 'Push, pull and keep your fork up to date.'], ['Pull requests that get approved', 'Small PRs, clear descriptions and helpful reviews.'], ['Merge conflicts', 'Why they happen and how to resolve them without panic.']]],
      ['Getting out of trouble', [['Undoing things', 'restore, revert and reset, and when to use each.'], ['📄 Git rescue cheat sheet', 'Commands for the ten most common "oh no" moments.']]],
    ],
    reviews: [['meera', 5, 'The rescue cheat sheet has already saved me twice.'], ['lucia', 5, 'Perfect for our whole team. We now use the same workflow.']],
  },

  /* ------------------------------------------------------------------ Design */
  {
    title: 'UI Design Fundamentals',
    subtitle: 'Layout, type and colour for interfaces people enjoy using',
    instructor: 'priya',
    category: 'Design',
    level: 'beginner',
    price: 99900,
    tags: ['ui design', 'typography', 'colour'],
    outcomes: ['Use spacing and alignment to create hierarchy', 'Pair typefaces and set a type scale', 'Build accessible colour palettes', 'Critique and improve your own screens'],
    sections: [
      ['Layout', [['Hierarchy and spacing', 'Guide the eye with size, spacing and grouping.'], ['Grids and alignment', 'Use grids without making every screen look the same.'], ['Designing for small screens', 'Prioritise content when space is tight.']]],
      ['Typography', [['Choosing typefaces', 'Pick one or two families that suit the product.'], ['Type scales', 'Set sizes and line heights that feel consistent.']]],
      ['Colour', [['Building a palette', 'Base colours, accents and tints from a few decisions.'], ['Contrast and accessibility', 'Meet contrast guidelines without dull designs.'], ['📄 Screen critique checklist', 'Questions to ask before you hand a design over.']]],
    ],
    reviews: [['ananya', 5, 'My screens look noticeably better after one week.'], ['rohan', 4, 'Great fundamentals. The critique checklist is very useful.']],
  },
  {
    title: 'Figma for Product Designers',
    subtitle: 'Components, auto layout and prototypes that developers love',
    instructor: 'priya',
    category: 'Design',
    level: 'intermediate',
    price: 129900,
    tags: ['figma', 'design systems', 'prototyping'],
    outcomes: ['Build flexible components with variants', 'Master auto layout', 'Create interactive prototypes', 'Hand off designs developers can build'],
    requirements: ['Basic familiarity with Figma'],
    sections: [
      ['Working faster', [['Frames and constraints', 'Responsive frames that resize the way you expect.'], ['Auto layout in depth', 'Padding, gaps and nesting for layouts that adapt.']]],
      ['Components', [['Components and variants', 'One component, many states, no duplicates.'], ['Design tokens', 'Variables for colour, spacing and type across files.'], ['Building a mini design system', 'A small, documented library your team can reuse.']]],
      ['Prototyping and handoff', [['Interactive prototypes', 'Smart animate, overlays and realistic flows.'], ['Dev mode and handoff', 'Annotate designs so developers build them right.']]],
    ],
    reviews: [['lucia', 5, 'Auto layout finally makes sense. My files are so much cleaner.'], ['vikram', 4, 'Very good. The design tokens lesson was the highlight.']],
  },

  /* ---------------------------------------------------------------- Business */
  {
    title: 'Starting a Small Online Business',
    subtitle: 'From idea to first paying customers on a small budget',
    instructor: 'elena',
    category: 'Business',
    level: 'beginner',
    price: 89900,
    tags: ['entrepreneurship', 'small business', 'startup'],
    outcomes: ['Validate an idea before building it', 'Price your product sensibly', 'Set up payments and basic legal pieces', 'Win your first ten customers'],
    sections: [
      ['Finding the idea', [['Problems worth solving', 'Find problems people already pay to solve.'], ['Validating cheaply', 'Test demand with conversations and a simple landing page.']]],
      ['Setting up', [['Pricing your offer', 'Price on value, not on cost or competitors alone.'], ['Payments and paperwork', 'Accept payments, keep records and stay compliant.'], ['📄 Launch week plan', 'A day-by-day plan for your first week of selling.']]],
      ['First customers', [['Your first ten customers', 'Reach people personally and learn from every sale.'], ['Turning customers into fans', 'Follow-ups, feedback and referrals that compound.']]],
    ],
    reviews: [['fatima', 5, 'Practical and encouraging. I made my first sale in week two.'], ['tom', 4, 'Good, honest advice without hype.']],
  },
  {
    title: 'Product Management Essentials',
    subtitle: 'Decide what to build and get it shipped',
    instructor: 'elena',
    category: 'Business',
    level: 'intermediate',
    price: 149900,
    tags: ['product management', 'strategy', 'roadmaps'],
    outcomes: ['Understand users through interviews', 'Prioritise with clear criteria', 'Write specs engineers appreciate', 'Measure whether features worked'],
    sections: [
      ['Discovery', [['User interviews', 'Ask questions that reveal real behaviour, not opinions.'], ['Opportunity sizing', 'Estimate impact before committing a team.']]],
      ['Delivery', [['Prioritisation frameworks', 'RICE, cost of delay and when to ignore frameworks.'], ['Writing a good spec', 'Problem, goals, scope and the questions you have not answered yet.'], ['Working with engineers', 'Trade-offs, estimates and staying out of the way.']]],
      ['Outcomes', [['Metrics that matter', 'North star metrics and guardrails.'], ['📄 Launch review template', 'A template to learn from every launch.']]],
    ],
    reviews: [['vikram', 5, 'The spec template is now our team standard.'], ['meera', 4, 'Clear and practical, especially the interview lessons.']],
  },

  /* --------------------------------------------------------------- Marketing */
  {
    title: 'SEO That Works',
    subtitle: 'Get found on Google without tricks or big budgets',
    instructor: 'elena',
    category: 'Marketing',
    level: 'all',
    price: 69900,
    tags: ['seo', 'content', 'google'],
    outcomes: ['Research keywords people actually search', 'Write pages that rank and convert', 'Fix the technical basics', 'Track progress in Search Console'],
    sections: [
      ['How search works', [['How Google ranks pages', 'Relevance, quality and why trust matters.'], ['Keyword research', 'Find topics with demand you can realistically win.']]],
      ['On-page', [['Writing pages that rank', 'Match search intent and answer the question fully.'], ['Titles, descriptions and links', 'Small changes that lift clicks.'], ['📄 On-page SEO checklist', 'Everything to check before publishing a page.']]],
      ['Technical and tracking', [['Technical basics', 'Speed, mobile and indexing issues you can fix yourself.'], ['Search Console', 'Read the reports and spot opportunities.']]],
    ],
    reviews: [['sam', 4, 'No fluff. Traffic to my blog is already climbing.'], ['lucia', 5, 'The best SEO course for people who just want results.']],
  },
  {
    title: 'Social Media Marketing for Creators',
    subtitle: 'Grow an audience that actually buys what you make',
    instructor: 'elena',
    category: 'Marketing',
    level: 'beginner',
    price: 59900,
    tags: ['social media', 'content', 'creators'],
    outcomes: ['Pick the right platforms for you', 'Plan a sustainable posting rhythm', 'Write hooks people stop for', 'Turn followers into customers'],
    sections: [
      ['Strategy', [['Choosing your platforms', 'Where your audience is and where you enjoy creating.'], ['Content pillars', 'Three or four themes that keep ideas flowing.']]],
      ['Creating', [['Hooks and formats', 'Openings that earn attention in the first seconds.'], ['Batching and scheduling', 'A weekly routine that avoids burnout.'], ['📄 Thirty content ideas', 'Prompts to fill a month of posts.']]],
      ['Growing', [['Reading your analytics', 'The few numbers worth watching.'], ['From followers to customers', 'Email lists and offers that feel natural.']]],
    ],
    reviews: [['ananya', 5, 'The content pillars idea fixed my blank-page problem.'], ['rohan', 4, 'Useful and realistic about time.']],
  },

  /* --------------------------------------------------- Personal Development */
  {
    title: 'Deep Work and Focus',
    subtitle: 'Do your best work in fewer, calmer hours',
    instructor: 'kabir',
    category: 'Personal Development',
    level: 'all',
    price: 0,
    tags: ['productivity', 'focus', 'habits'],
    outcomes: ['Plan focused work blocks', 'Reduce distractions without becoming unreachable', 'Build habits that stick', 'Review and improve your week'],
    sections: [
      ['Why focus matters', [['The cost of switching', 'What constant interruptions really cost you.'], ['Designing your week', 'Protect time for deep work before the week fills up.']]],
      ['Practices', [['Focus blocks', 'Run a ninety-minute session from start to finish.'], ['Taming notifications', 'Settings and agreements that keep you reachable but undistracted.'], ['📄 Weekly review template', 'A twenty-minute review that keeps you on track.']]],
    ],
    reviews: [['tom', 5, 'Short, practical and genuinely helpful.'], ['fatima', 5, 'The weekly review is now a ritual for me.'], ['meera', 4, 'Simple ideas, well explained.']],
  },
  {
    title: 'Public Speaking with Confidence',
    subtitle: 'Plan, practise and deliver talks people remember',
    instructor: 'kabir',
    category: 'Personal Development',
    level: 'beginner',
    price: 79900,
    tags: ['public speaking', 'communication', 'presentations'],
    outcomes: ['Structure a talk around one clear message', 'Design slides that support you', 'Manage nerves on the day', 'Handle questions calmly'],
    sections: [
      ['Preparing', [['Finding your message', 'Decide the one thing your audience should remember.'], ['Structuring the talk', 'Openings, stories and endings that land.'], ['Slides that help', 'Fewer words, bigger visuals, clearer talks.']]],
      ['Delivering', [['Voice and body language', 'Pace, pauses and where to put your hands.'], ['Handling nerves', 'Practical routines for before and during your talk.'], ['Answering questions', 'Stay calm and honest, even when you do not know.']]],
    ],
    reviews: [['vikram', 5, 'Gave a talk at a meetup a month later. Felt prepared for the first time.'], ['ananya', 4, 'The nerves lesson really helped.']],
  },
];

module.exports = { INSTRUCTORS, STUDENTS, COURSES };
