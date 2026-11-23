const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const mongoose = require('mongoose');

const config = require('./config');
const customers = require('./routes/customers');
const transactions = require('./routes/transactions');
const ledger = require('./services/ledger');
const { notFound, errorHandler } = require('./middleware/errors');

mongoose.set('sanitizeFilter', true);

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(compression());
  if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

  if (config.corsOrigin) {
    app.use('/api', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  app.use(express.json({ limit: '20kb' }));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  app.get('/api/config', (req, res) => {
    res.json({ shopName: config.shopName, whatsappApiEnabled: config.whatsapp.enabled });
  });

  app.get('/api/summary', async (req, res) => {
    res.json(await ledger.getSummary());
  });

  app.use('/api/customers', customers);
  app.use('/api/transactions', transactions);
  app.use('/api', notFound);

  // Optionally serve the built React app (when not behind nginx)
  if (config.clientDist && fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { maxAge: '7d', index: false }));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
