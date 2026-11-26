const fs = require('fs/promises');
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');

const MODELS = ['User', 'Session', 'Student', 'Attendance', 'Pickup', 'Message', 'Alert', 'Parade', 'Setting', 'Audit'];

async function main() {
  for (const d of Object.values(config.dirs)) await fs.mkdir(d, { recursive: true });
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(MODELS.map((m) => require(`./models/${m}`).syncIndexes()));
  await require('./models/Setting').get();
  console.log('[db] connected');
  if (config.schedulerEnabled) require('./services/scheduler').start();

  const server = createApp().listen(config.port, config.host, () => {
    console.log(`[api] Surakshit Gate on http://${config.host}:${config.port} (${config.env}, messages: ${config.messages.provider})`);
  });
  const stop = async (sig) => {
    console.log(`[api] ${sig}, shutting down`);
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error('[api] failed to start:', e.message);
  process.exit(1);
});
