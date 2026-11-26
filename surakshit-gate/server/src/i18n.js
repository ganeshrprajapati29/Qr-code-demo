// Server messages are written in Hindi; this turns them into English when the app asks for it
// (header `x-sg-lang: en`). Fixed strings use DICT, messages with names/numbers use PATTERNS.

const FIELDS = {
  'बच्चे का नाम': "child's name",
  'क्लास': 'class',
  'रोल नंबर': 'roll number',
  'रोल': 'roll number',
  'अभिभावक का नाम': "parent's name",
  'अभिभावक': "parent's name",
  'लेने वाले का नाम': "the person's name",
  'रिश्ता': 'relation',
  'नाम': 'name',
  'यूज़रनेम': 'username',
  'स्कूल का नाम': 'school name',
  'OTP समय': 'OTP time',
  'जवाब का समय': 'reply time',
  'फोटो रखने के दिन': 'photo retention days',
  'बैकअप का समय': 'backup hour',
  'सत्र का नाम': 'session name',
  'परेड गिनती': 'parade count',
  'नोट': 'note',
  'दोबारा स्कैन की छूट': 'repeat-scan grace minutes',
};

const DICT = {
  'कृपया लॉगिन करें': 'Please log in',
  'आपको इस हिस्से की अनुमति नहीं है': 'You do not have permission for this section',
  'अनुरोध अस्वीकार': 'Request refused',
  'यह API मौजूद नहीं है': 'This API does not exist',
  'भरी गई जानकारी सही नहीं है': 'Some of the entered details are not valid',
  'गलत ID': 'Invalid ID',
  'यह यूज़रनेम पहले से है': 'This username already exists',
  'यह जानकारी पहले से मौजूद है': 'This entry already exists',
  'गलत JSON': 'Invalid JSON',
  'फ़ाइल बहुत बड़ी है': 'File is too large',
  'सर्वर में दिक्कत आई, दोबारा कोशिश करें': 'Server problem, please try again',
  'अमान्य अनुरोध': 'Invalid request',
  'ऑफिस का फोन नंबर सही नहीं': 'Office phone number is not valid',
  'छुट्टी का समय HH:MM में लिखें (जैसे 12:30)': 'Enter home time as HH:MM (e.g. 12:30)',
  'जवाब का समय OTP के समय से ज़्यादा नहीं हो सकता': 'Reply time cannot be longer than the OTP time',
  'एक ही क्लास को बदलना और हटाना दोनों नहीं हो सकता': 'A class cannot be both moved and removed',
  'एक क्लास एक बार ही बदलें': 'Move each class only once',
  'पुष्टि के लिए RESTORE लिखें': 'Type RESTORE to confirm',
  'बैकअप चुनें': 'Choose a backup',
  'सिर्फ डेमो मोड में': 'Only in demo mode',
  'बहुत ज़्यादा कोशिशें हुईं। 10 मिनट बाद फिर कोशिश करें।': 'Too many attempts. Try again in 10 minutes.',
  'यूज़रनेम और पासवर्ड डालें': 'Enter username and password',
  'यह लॉगिन बंद कर दिया गया है। एडमिन से संपर्क करें।': 'This login has been disabled. Contact the admin.',
  'यूज़रनेम या पासवर्ड गलत है': 'Wrong username or password',
  'पासवर्ड डालें': 'Enter the password',
  'मौजूदा पासवर्ड गलत है': 'Current password is wrong',
  'नया पासवर्ड कम से कम 8 अक्षर का हो': 'New password must be at least 8 characters',
  'यह स्कूल का QR कार्ड नहीं है': "This is not the school's QR card",
  'यह कार्ड सिस्टम में नहीं है — नकली कार्ड हो सकता है': 'This card is not in the system — it may be a fake card',
  'यह कार्ड बंद कर दिया गया है (खोया/पुराना कार्ड)। बच्चे को न जाने दें, ऑफिस को बताएँ।': 'This card has been blocked (lost/old card). Do not let the child go; inform the office.',
  'यह बच्चा स्कूल की सूची से हटाया जा चुका है।': 'This child has been removed from the school list.',
  'बच्चा नहीं मिला': 'Child not found',
  'इस बच्चे का पिकअप चल रहा है। पहले उसे पूरा या रद्द करें।': 'A pickup is in progress for this child. Complete or cancel it first.',
  'बच्चा पहले ही निकल चुका है': 'The child has already left',
  'आज इस बच्चे का आना दर्ज नहीं है — पहले कार्ड स्कैन करें': "Today's arrival is not recorded for this child — scan the card first",
  'पिकअप नहीं मिला': 'Pickup not found',
  'लेने वाले की फोटो लें': 'Take a photo of the person',
  'इस बच्चे का एक पिकअप पहले से चल रहा है': 'A pickup for this child is already in progress',
  'फोटो मिटाई जा चुकी है': 'Photo has been deleted',
  'OTP के अंक डालें': 'Enter the OTP digits',
  'यह OTP पहले ही इस्तेमाल हो चुका है': 'This OTP has already been used',
  'OTP का समय खत्म हो गया। “नया OTP भेजें” दबाएँ।': 'OTP has expired. Tap “Send new OTP”.',
  'माँ-बाप ने मना किया है। बच्चे को न सौंपें।': 'Parents have refused. Do NOT hand over the child.',
  'बहुत बार गलत OTP डाला गया। पिकअप बंद। ऑफिस को बताएँ।': 'Wrong OTP too many times. Pickup locked. Inform the office.',
  'यह पिकअप रद्द हो चुका है': 'This pickup has been cancelled',
  'बहुत बार गलत OTP। पिकअप बंद — बच्चे को न सौंपें, ऑफिस को बताएँ।': 'Wrong OTP too many times. Pickup locked — do NOT hand over the child, inform the office.',
  'OTP सही है, पर माँ-बाप ने अभी “हाँ” नहीं कहा। बच्चे को न सौंपें।': 'OTP is correct, but the parents have not said “Yes” yet. Do NOT hand over the child.',
  'यह OTP अब मान्य नहीं है': 'This OTP is no longer valid',
  'इस पिकअप पर नया OTP नहीं भेजा जा सकता': 'A new OTP cannot be sent for this pickup',
  'यह पिकअप रद्द नहीं हो सकता': 'This pickup cannot be cancelled',
  'हाँ या नहीं चुनें': 'Choose Yes or No',
  'इस पिकअप पर अब फैसला नहीं हो सकता': 'A decision can no longer be made on this pickup',
  'यह लिंक सही नहीं है': 'This link is not valid',
  'यह लिंक सही नहीं है या पुराना हो चुका है': 'This link is not valid or has expired',
  'लिंक खत्म हो चुका है': 'This link has expired',
  'फोटो नहीं है': 'No photo',
  'नहीं मिला': 'Not found',
  'समय खत्म हो गया। स्कूल से नया लिंक माँगें।': 'Time is over. Ask the school for a new link.',
  'आपका जवाब पहले ही दर्ज हो चुका है': 'Your answer has already been recorded',
  'यह पिकअप अब खुला नहीं है': 'This pickup is no longer open',
  'यह आपकी क्लास नहीं है': 'This is not your class',
  'माँ-बाप का सही 10 अंकों का मोबाइल नंबर डालें': "Enter the parent's valid 10-digit mobile number",
  'हटाए गए बच्चे का कार्ड नहीं बन सकता': 'A card cannot be made for a removed child',
  'CSV फ़ाइल खाली है': 'The CSV file is empty',
  'CSV में हेडर और कम से कम एक बच्चा होना चाहिए': 'The CSV needs a header row and at least one child',
  'CSV के पहले लाइन में ये कॉलम होने चाहिए: name, class, mobile': 'The first line of the CSV must have these columns: name, class, mobile',
  'एक बार में 2000 बच्चों तक जोड़ें': 'Add at most 2000 children at a time',
  'पासवर्ड कम से कम 8 अक्षर का हो': 'Password must be at least 8 characters',
  'भूमिका चुनें': 'Choose a role',
  'क्लास की सूची सही नहीं': 'Class list is not valid',
  'यूज़र नहीं मिला': 'User not found',
  'यूज़रनेम में सिर्फ a-z, 0-9, . _ - हों': 'Username may only contain a-z, 0-9, . _ -',
  'आप अपनी एडमिन भूमिका नहीं हटा सकते': 'You cannot remove your own admin role',
  'आप खुद का लॉगिन बंद नहीं कर सकते': 'You cannot disable your own login',
  'बैकअप का नाम सही नहीं': 'Backup name is not valid',
  'नंबर पर मैसेज नहीं पहुँचा (डेमो: नंबर बंद/गलत)': 'Message not delivered (demo: number off/wrong)',
  'नंबर गलत या बंद है': 'Number is wrong or switched off',
  'मैसेज नहीं पहुँचा': 'Message not delivered',
  'WhatsApp API सेट नहीं है (WA_TOKEN / WA_PHONE_NUMBER_ID)': 'WhatsApp API is not set up (WA_TOKEN / WA_PHONE_NUMBER_ID)',
  'फोटो नहीं मिली': 'Photo not found',
  'फोटो JPG/PNG होनी चाहिए': 'Photo must be JPG/PNG',
  'फोटो बहुत बड़ी है (1.5 MB तक)': 'Photo is too large (max 1.5 MB)',
  'फोटो फ़ाइल सही नहीं है': 'Photo file is not valid',
  'क्लास जैसे 5A, 6-B, Nursery लिखें': 'Write the class like 5A, 6-B, Nursery',
};

const f = (hi) => FIELDS[hi] || hi;
const PATTERNS = [
  [/^(.+) भरें$/, (m) => `Please enter ${f(m[1])}`],
  [/^(.+) सही नहीं है$/, (m) => `${cap(f(m[1]))} is not valid`],
  [/^(.+) कम से कम (\d+) अक्षर का हो$/, (m) => `${cap(f(m[1]))} must be at least ${m[2]} characters`],
  [/^(.+) बहुत लंबा है$/, (m) => `${cap(f(m[1]))} is too long`],
  [/^(.+) (\d+) से (\d+) के बीच की संख्या हो$/, (m) => `${cap(f(m[1]))} must be a number from ${m[2]} to ${m[3]}`],
  [/^बार-बार गलत पासवर्ड। यह लॉगिन (\d+) मिनट के लिए बंद है।$/, (m) => `Too many wrong passwords. This login is locked for ${m[1]} minutes.`],
  [/^OTP गलत है। बच्चे को न सौंपें। \((\d+)\/(\d+)\)$/, (m) => `Wrong OTP. Do NOT hand over the child. (${m[1]}/${m[2]})`],
  [/^बैकअप वापस नहीं आ सका: (.*)$/s, (m) => `Backup could not be restored: ${translate(m[1], 'en')}`],
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function translate(text, lang) {
  if (lang !== 'en' || typeof text !== 'string') return text;
  if (DICT[text]) return DICT[text];
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

const langOf = (req) => (req.headers['x-sg-lang'] === 'en' ? 'en' : 'hi');

module.exports = { translate, langOf, DICT, FIELDS };
