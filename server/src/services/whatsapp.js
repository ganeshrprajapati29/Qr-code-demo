const config = require('../config');
const HttpError = require('../utils/httpError');

// Sends a message through the official WhatsApp Cloud API (Meta).
// Business-initiated messages need an approved *template*; set WA_TEMPLATE_NAME
// to a utility template with 2 body variables: {{1}} = name, {{2}} = amount.
async function sendWhatsApp({ phone, name, amountText, text }) {
  const wa = config.whatsapp;
  if (!wa.enabled) {
    throw new HttpError(
      501,
      'WhatsApp Cloud API अभी चालू नहीं है। सर्वर पर WA_TOKEN और WA_PHONE_NUMBER_ID सेट करने होंगे। तब तक "WhatsApp पर भेजें" या "SMS भेजें" बटन इस्तेमाल करें।',
      { reason: 'WHATSAPP_NOT_CONFIGURED' }
    );
  }

  const body = wa.templateName
    ? {
        messaging_product: 'whatsapp',
        to: `91${phone}`,
        type: 'template',
        template: {
          name: wa.templateName,
          language: { code: wa.templateLang },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: name }, { type: 'text', text: amountText }] },
          ],
        },
      }
    : { messaging_product: 'whatsapp', to: `91${phone}`, type: 'text', text: { body: text } };

  const res = await fetch(`https://graph.facebook.com/${wa.apiVersion}/${wa.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wa.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new HttpError(502, `WhatsApp ने मैसेज नहीं लिया: ${msg}`, { reason: 'WHATSAPP_API_ERROR' });
  }
  return { messageId: data?.messages?.[0]?.id || null };
}

module.exports = { sendWhatsApp };
