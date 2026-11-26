const Alert = require('../models/Alert');

// Every alert is stored in Hindi and English, so each viewer sees their own language.
const T = {
  parent_no_response: (d) => [
    `${d.student} (${d.cls}) के पिकअप पर माँ-बाप ने ${d.min} मिनट में जवाब नहीं दिया। ऑफिस से फोन करके पुष्टि करें।`,
    `Pickup of ${d.student} (${d.cls}): parents did not reply in ${d.min} minutes. Office should call them to confirm.`,
  ],
  message_failed: (d) => [
    `${d.student} (${d.cls}) के माँ-बाप (${d.phone}) को मैसेज नहीं पहुँचा: ${d.reasonHi}। नंबर जाँचें।`,
    `Message to the parents of ${d.student} (${d.cls}) (${d.phone}) was not delivered: ${d.reasonEn}. Please check the number.`,
  ],
  wrong_otp: (d) => [
    `${d.student} (${d.cls}) के पिकअप पर गलत OTP डाला गया (${d.n} बार)। लेने वाला: ${d.picker}`,
    `Wrong OTP entered for the pickup of ${d.student} (${d.cls}) (${d.n} time${d.n > 1 ? 's' : ''}). Person: ${d.picker}`,
  ],
  pickup_locked: (d) => [
    `${d.student} (${d.cls}) के पिकअप पर गलत OTP डाला गया (${d.n} बार)। लेने वाला: ${d.picker}। पिकअप बंद कर दिया गया।`,
    `Wrong OTP entered ${d.n} times for the pickup of ${d.student} (${d.cls}). Person: ${d.picker}. Pickup locked.`,
  ],
  parent_denied: (d) => [
    `${d.student} (${d.cls}): माँ-बाप ने ${d.picker} को बच्चा देने से मना किया।`,
    `${d.student} (${d.cls}): parents REFUSED to hand over the child to ${d.picker}.`,
  ],
  parent_denied_office: (d) => [
    `${d.student} (${d.cls}): माँ-बाप ने फोन पर मना किया (ऑफिस: ${d.by})। बच्चा न सौंपें।`,
    `${d.student} (${d.cls}): parents refused on the phone (office: ${d.by}). Do not hand over the child.`,
  ],
  unknown_card: (d) => [
    `गेट पर अनजान कार्ड स्कैन हुआ (${d.time})। नकली कार्ड हो सकता है।`,
    `An unknown card was scanned at the gate (${d.time}). It may be a fake card.`,
  ],
  revoked_card: (d) => [
    `${d.student} (${d.cls}) का बंद/पुराना कार्ड गेट पर स्कैन हुआ (${d.time})। जाँच करें।`,
    `A blocked/old card of ${d.student} (${d.cls}) was scanned at the gate (${d.time}). Please check.`,
  ],
  repeat_scan: (d) => [
    `${d.student} (${d.cls}) का कार्ड आज सुबह ${d.n} बार स्कैन हुआ (पहला ${d.first}, अभी ${d.time}) जबकि बच्चा अंदर है। कार्ड किसी और ने इस्तेमाल किया हो सकता है — जाँच करें।`,
    `Card of ${d.student} (${d.cls}) was scanned ${d.n} times this morning (first ${d.first}, now ${d.time}) while the child is already inside. Someone else may be using the card — please check.`,
  ],
};

async function raise(type, refs, data, storeAs = type) {
  const [text, textEn] = T[type](data);
  return Alert.create({ type: storeAs, text, textEn, student: refs.student || null, pickup: refs.pickup || null, className: refs.className || '' });
}

module.exports = { raise, T };
