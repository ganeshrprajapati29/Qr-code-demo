const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config');
const { loadUser, requireAppHeader } = require('./middleware/auth');
const noOperators = require('./middleware/noOperators');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          upgradeInsecureRequests: null,
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      hsts: false, // nginx sets HSTS when HTTPS is on
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  if (config.env !== 'test') app.use(morgan(config.env === 'production' ? ':remote-addr :method :url :status :response-time ms' : 'dev'));

  // raw body kept for WhatsApp webhook signature check
  app.use(express.json({ limit: '3mb', verify: (req, res, buf) => { if (req.url.startsWith('/api/webhooks')) req.rawBody = buf; } }));
  app.use('/api', noOperators);
  app.use('/api', rateLimit({ windowMs: 60000, limit: config.env === 'test' ? 100000 : 600, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'down' }));
  app.use('/api/webhooks', require('./routes/webhooks'));
  app.use('/api/public', requireAppHeader, require('./routes/public'));

  app.use('/api', loadUser, requireAppHeader);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/students', require('./routes/students'));
  app.use('/api/gate', require('./routes/gate'));
  app.use('/api/pickups', require('./routes/pickups'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/alerts', require('./routes/alerts'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', notFound);

  if (config.clientDist && fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '7d' }));
    app.get('/{*splat}', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
