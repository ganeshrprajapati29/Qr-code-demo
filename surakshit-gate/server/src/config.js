const path = require('path');
require('dotenv').config({ quiet: true });

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : d);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5070),
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/surakshit_gate',
  // public base URL used inside parent links, e.g. https://gate.72-60-110-25.sslip.io
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  clientDist: process.env.CLIENT_DIST || '',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
  timeZone: 'Asia/Kolkata',
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : (process.env.PUBLIC_URL || '').startsWith('https://'),
  sessionHours: num(process.env.SESSION_HOURS, 12),
  backupKeep: num(process.env.BACKUP_KEEP, 14),
  schedulerEnabled: process.env.SCHEDULER !== 'off',

  messages: {
    provider: process.env.MESSAGE_PROVIDER || 'demo', // demo | whatsapp
    demoDeliverMs: num(process.env.DEMO_DELIVER_MS, 800),
  },
  whatsapp: {
    token: process.env.WA_TOKEN || '',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WA_API_VERSION || 'v21.0',
    appSecret: process.env.WA_APP_SECRET || '',
    verifyToken: process.env.WA_VERIFY_TOKEN || '',
    lang: process.env.WA_TEMPLATE_LANG || 'hi',
    templates: {
      arrival: process.env.WA_TPL_ARRIVAL || 'gate_arrival',
      exit: process.env.WA_TPL_EXIT || 'gate_exit',
      pickup_request: process.env.WA_TPL_PICKUP || 'pickup_request',
      pickup_done: process.env.WA_TPL_PICKUP_DONE || 'pickup_done',
      alert: process.env.WA_TPL_ALERT || 'gate_alert',
    },
  },
};

config.dirs = {
  uploads: path.join(config.dataDir, 'uploads'),
  students: path.join(config.dataDir, 'uploads', 'students'),
  pickups: path.join(config.dataDir, 'uploads', 'pickups'),
  backups: path.join(config.dataDir, 'backups'),
};

module.exports = config;
