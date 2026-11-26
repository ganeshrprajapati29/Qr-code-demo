const express = require('express');
const config = require('../config');
const Message = require('../models/Message');
const wa = require('../services/notify/whatsapp');
const { updateStatus } = require('../services/notify');

const router = express.Router();

// Meta webhook verification
router.get('/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && config.whatsapp.verifyToken && req.query['hub.verify_token'] === config.whatsapp.verifyToken) {
    return res.type('text/plain').send(String(req.query['hub.challenge'] || ''));
  }
  res.sendStatus(403);
});

// delivery statuses: sent / delivered / read / failed
router.post('/whatsapp', async (req, res) => {
  if (!wa.verifySignature(req.rawBody || Buffer.alloc(0), req.headers['x-hub-signature-256'])) return res.sendStatus(401);
  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      for (const st of change?.value?.statuses || []) {
        if (typeof st?.id !== 'string') continue;
        const msg = await Message.findOne({ providerId: st.id });
        if (!msg) continue;
        const at = st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date();
        if (['sent', 'delivered', 'read'].includes(st.status)) await updateStatus(msg, st.status, { at });
        if (st.status === 'failed') {
          const err = st.errors?.[0] || {};
          await updateStatus(msg, 'failed', { at, error: `${err.code || ''} ${err.title || err.message || 'failed'}`.trim(), numberProblem: wa.isNumberError(err.code) });
        }
      }
    }
  }
  res.sendStatus(200);
});

module.exports = router;
