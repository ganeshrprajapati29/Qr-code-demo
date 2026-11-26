// Parent message texts in Hindi and English.
// vars = WhatsApp template variables (same order in both languages).
const t = {
  arrival: ({ school, name, cls, time }, lang) => ({
    vars: [name, cls, time, school],
    text: lang === 'en'
      ? `${school}: ${name} (Class ${cls}) reached school at ${time}.`
      : `${school}: ${name} (क्लास ${cls}) ${time} पर स्कूल पहुँच गए हैं।`,
  }),
  exit: ({ school, name, cls, time }, lang) => ({
    vars: [name, cls, time, school],
    text: lang === 'en'
      ? `${school}: ${name} (Class ${cls}) left school at ${time} (with parents).`
      : `${school}: ${name} (क्लास ${cls}) ${time} पर स्कूल से निकल गए (माँ-बाप के साथ)।`,
  }),
  pickup_request: ({ school, name, picker, relation, link, otp, ttl }, lang) => {
    const who = picker + (relation ? ` (${relation})` : '');
    return {
      vars: [who, name, link, otp, String(ttl), school],
      text: lang === 'en'
        ? `⚠ ${school}: ${who} has come to pick up your child ${name}. Should we send the child? See the photo and tap Yes/No: ${link} — OTP: ${otp} (share it only if you agree, valid ${ttl} min)`
        : `⚠ ${school}: ${who} आपके बच्चे ${name} को लेने आए हैं। क्या बच्चे को भेजना है? फोटो देखकर हाँ/नहीं दबाएँ: ${link} — OTP: ${otp} (भेजना हो तभी लेने वाले को बताएँ, ${ttl} मिनट तक मान्य)`,
    };
  },
  pickup_done: ({ school, name, picker, time }, lang) => ({
    vars: [name, picker, time, school],
    text: lang === 'en'
      ? `${school}: ${name} was handed over to ${picker} at ${time}. OTP was correct.`
      : `${school}: ${name} को ${time} पर ${picker} को सौंपा गया। OTP सही था।`,
  }),
  alert: ({ school, text, textEn }, lang) => ({
    vars: [lang === 'en' ? textEn || text : text, school],
    text: `⚠ ${school}: ${lang === 'en' ? textEn || text : text}`,
  }),
};
module.exports = t;
