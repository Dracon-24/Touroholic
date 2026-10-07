const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env', quiet: true });
process.env.NODE_ENV ||= 'development';
const app = require('./app');
let server;

const start = async () => {
  for (const name of ['DATABASE', 'JWT_SECRET']) {
    if (!process.env[name]) throw new Error(`${name} is required. See config.env.example.`);
  }
  process.env.JWT_EXPIRES_IN ||= '90d';
  process.env.JWT_COOKIE_EXPIRES_IN ||= '90';
  await mongoose.connect(process.env.DATABASE, { serverSelectionTimeoutMS: 10000 });
  console.log('Database connected.');
  server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Touroholic running on port ${process.env.PORT || 3000}.`);
  });
};

const stop = async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
};
process.on('SIGTERM', () => stop().then(() => process.exit(0)));
process.on('SIGINT', () => stop().then(() => process.exit(0)));
process.on('unhandledRejection', error => {
  console.error('Unhandled error:', error.message);
  stop().finally(() => process.exit(1));
});
start().catch(error => {
  console.error('Unable to start Touroholic:', error.message);
  process.exit(1);
});
