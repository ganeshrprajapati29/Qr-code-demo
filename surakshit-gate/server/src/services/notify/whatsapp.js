const crypto = require('crypto');
const config = require('../../config');

// Official WhatsApp Cloud API (Meta). Uses approved *utility* templates.
// Delivery / read / failed statuses arrive at POST /api/webhooks/whatsapp.
const NUMBER_ERRORS = new Set([131026, 131021, 131030, 131051, 133010, 1006]);

module.exports = {
  name: 'whatsapp',
  async send(msg) {
    const wa = config.whatsapp;
    if (!wa.token || !wa.phoneNumberId) throw new Error('WhatsApp API सेट नहीं है (WA_TOKEN / WA_PHONE_NUMBER_ID)');
    const template = wa.templates[msg.kind];
    const body = {
      messaging_product: 'whatsapp',
      to: `91${msg.to}`,
      type: 'template',
      template: {
        name: template,
        language: { code: wa.lang },
        components: [{ type: 'body', parameters: msg.vars.map((v) => ({ type: 'text', text: String(v).slice(0, 1000) })) }],
      },
    };
    const res = await fetch(`https://graph.facebook.com/${wa.apiVersion}/${wa.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(data?.error?.message || `WhatsApp HTTP ${res.status}`);
      e.numberProblem = NUMBER_ERRORS.has(data?.error?.code);
      throw e;
    }
    return { providerId: data?.messages?.[0]?.id || null };
  },

  verifySignature(rawBody, header) {
    if (!config.whatsapp.appSecret) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(header || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  isNumberError: (code) => NUMBER_ERRORS.has(Number(code)),
};
