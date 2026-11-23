const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');

async function main() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([require('./models/Customer').syncIndexes(), require('./models/Transaction').syncIndexes()]);
  console.log(`[db] connected`);

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`[api] Udhar Khata API listening on http://${config.host}:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
