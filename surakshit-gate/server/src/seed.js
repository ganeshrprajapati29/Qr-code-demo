// FAKE demo data only (names, numbers, photos are all made up).
// Usage: node src/seed.js [--reset]     env: SEED_PASSWORD (else random), SEED_LOGINS_FILE
const fs = require('fs/promises');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const User = require('./models/User');
const Student = require('./models/Student');
const Attendance = require('./models/Attendance');
const Setting = require('./models/Setting');
const { newCardToken } = require('./services/cards');
const { saveRaw } = require('./services/photos');
const { dayKey } = require('./utils/time');

const FIRST = ['आरव', 'सिया', 'कबीर', 'अनन्या', 'रुद्र', 'मीरा', 'यश', 'पायल', 'विवान', 'आध्या', 'अर्जुन', 'इशिता', 'रेयांश', 'तान्या', 'आदित्य', 'काव्या', 'ध्रुव', 'नव्या', 'शौर्य', 'रिया', 'वेदांत', 'साक्षी', 'प्रणव', 'जान्हवी', 'अंश', 'दिव्या', 'हर्ष', 'खुशी', 'लक्ष्य', 'निधि', 'ओम', 'पूजा', 'राघव', 'श्रेया', 'तनुज', 'उर्वी', 'वंश', 'ज़ोया', 'ईशान', 'भूमि'];
const LAST = ['शर्मा', 'वर्मा', 'सिंह', 'यादव', 'मलिक', 'कुमार', 'राणा', 'गुप्ता', 'चौहान', 'जैन'];
const COLORS = ['#d98a1c', '#2f8f89', '#6a5ac8', '#c9546e', '#4a8a36', '#b8622a', '#3070b8', '#9450a8'];
const CLASSES = [['5A', 30], ['6B', 10]];

function avatarSvg(name, color) {
  const initial = [...name][0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="0 0 300 360"><rect width="300" height="360" fill="${color}"/><circle cx="150" cy="140" r="70" fill="#ffffff" fill-opacity=".85"/><rect x="60" y="230" width="180" height="140" rx="70" fill="#ffffff" fill-opacity=".85"/><text x="150" y="165" font-family="sans-serif" font-size="72" font-weight="700" text-anchor="middle" fill="${color}">${initial}</text><text x="150" y="345" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#1b2740">डेमो फोटो</text></svg>`;
}

function weekdaysThisMonthBefore(today) {
  const [y, m, d] = today.split('-').map(Number);
  const out = [];
  for (let i = 1; i < d; i++) {
    const dt = new Date(Date.UTC(y, m - 1, i, 6));
    if (dt.getUTCDay() !== 0) out.push(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return out;
}

async function run() {
  await mongoose.connect(config.mongoUri);
  const reset = process.argv.includes('--reset');
  if (reset) {
    for (const c of ['users', 'sessions', 'students', 'attendances', 'pickups', 'messages', 'alerts', 'parades', 'audits']) await mongoose.connection.db.collection(c).deleteMany({});
    await fs.rm(config.dirs.uploads, { recursive: true, force: true });
    console.log('[seed] wiped');
  }
  const s = await Setting.get();
  s.schoolName = 'सरस्वती पब्लिक स्कूल (डेमो)';
  if (!s.officePhone) s.officePhone = '9000000999';
  await s.save();

  const logins = [];
  if ((await User.countDocuments()) === 0) {
    const people = [
      { name: 'एडमिन (डेमो)', username: 'admin', role: 'admin' },
      { name: 'प्रिंसिपल (डेमो)', username: 'principal', role: 'principal' },
      { name: 'सुनीता मैडम (5A)', username: 'teacher5a', role: 'teacher', classes: ['5A'] },
      { name: 'रमेश सर (6B)', username: 'teacher6b', role: 'teacher', classes: ['6B'] },
      { name: 'गेट गार्ड (डेमो)', username: 'guard', role: 'guard' },
    ];
    for (const p of people) {
      const password = process.env.SEED_PASSWORD || crypto.randomBytes(6).toString('base64url');
      await User.create({ ...p, passwordHash: await bcrypt.hash(password, 11) });
      logins.push({ role: p.role, username: p.username, password });
    }
  }

  if ((await Student.countDocuments()) === 0) {
    let n = 0;
    const docs = [];
    for (const [cls, count] of CLASSES) {
      for (let i = 1; i <= count; i++, n++) {
        const name = `${FIRST[n % FIRST.length]} ${LAST[(n * 3) % LAST.length]}`;
        const photo = await saveRaw('students', `demo-${cls}-${i}.svg`, avatarSvg(name, COLORS[n % COLORS.length]));
        // fake numbers; the last child of 6B gets a "switched off" number to demo the alert
        const phone = cls === '6B' && i === count ? '9000000000' : `90000${String(10001 + n).slice(-5)}`; // never ends in 0000
        docs.push({ name, className: cls, rollNo: String(i), guardianName: `${LAST[(n * 3) % LAST.length]} जी`, guardianPhone: phone, photo, cardToken: newCardToken() });
      }
    }
    const students = await Student.insertMany(docs);
    // past attendance this month so the monthly report has something to show
    const days = weekdaysThisMonthBefore(dayKey());
    const atts = [];
    for (const day of days) {
      for (const st of students) {
        if (crypto.randomInt(0, 100) < 90) {
          const inAt = new Date(`${day}T02:${String(crypto.randomInt(10, 50)).padStart(2, '0')}:00Z`);
          atts.push({ student: st._id, className: st.className, date: day, inAt, outAt: new Date(`${day}T08:${String(crypto.randomInt(0, 30)).padStart(2, '0')}:00Z`), outMode: 'parent' });
        }
      }
    }
    if (atts.length) await Attendance.insertMany(atts);
    console.log(`[seed] ${students.length} fake students, ${atts.length} past attendance rows`);
  }

  if (logins.length) {
    const lines = ['सुरक्षित गेट - पहली बार के लॉगिन (लॉगिन के बाद पासवर्ड बदलें)', ...logins.map((l) => `${l.role.padEnd(10)} यूज़रनेम: ${l.username.padEnd(10)} पासवर्ड: ${l.password}`)];
    console.log(lines.join('\n'));
    if (process.env.SEED_LOGINS_FILE) await fs.writeFile(process.env.SEED_LOGINS_FILE, lines.join('\n') + '\n', { mode: 0o600 });
  }
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
