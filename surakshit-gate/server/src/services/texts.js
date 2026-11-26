// Hindi message texts. vars are the template variables for WhatsApp templates (same order).
const t = {
  arrival: ({ school, name, cls, time }) => ({
    vars: [name, cls, time, school],
    text: `${school}: ${name} (क्लास ${cls}) ${time} पर स्कूल पहुँच गए हैं।`,
  }),
  exit: ({ school, name, cls, time }) => ({
    vars: [name, cls, time, school],
    text: `${school}: ${name} (क्लास ${cls}) ${time} पर स्कूल से निकल गए (माँ-बाप के साथ)।`,
  }),
  pickup_request: ({ school, name, picker, relation, link, otp, ttl }) => ({
    vars: [picker + (relation ? ` (${relation})` : ''), name, link, otp, String(ttl), school],
    text: `⚠ ${school}: ${picker}${relation ? ` (${relation})` : ''} आपके बच्चे ${name} को लेने आए हैं। क्या बच्चे को भेजना है? फोटो देखकर हाँ/नहीं दबाएँ: ${link} — OTP: ${otp} (भेजना हो तभी लेने वाले को बताएँ, ${ttl} मिनट तक मान्य)`,
  }),
  pickup_done: ({ school, name, picker, time }) => ({
    vars: [name, picker, time, school],
    text: `${school}: ${name} को ${time} पर ${picker} को सौंपा गया। OTP सही था।`,
  }),
  alert: ({ school, text }) => ({ vars: [text, school], text: `⚠ ${school}: ${text}` }),
};
module.exports = t;
