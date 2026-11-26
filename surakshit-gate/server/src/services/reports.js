const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Parade = require('../models/Parade');

// classes = null -> all classes
async function today(date, classes) {
  const sFilter = { active: true };
  if (classes) sFilter.className = { $in: classes };
  const students = await Student.find(sFilter).select('name className rollNo photo').sort({ className: 1, rollNo: 1, name: 1 }).collation({ locale: 'en', numericOrdering: true }).lean();
  const ids = students.map((s) => s._id);
  const atts = await Attendance.find({ date, student: { $in: ids } }).lean();
  const byStudent = new Map(atts.map((a) => [String(a.student), a]));
  const parades = await Parade.find({ date, ...(classes && { className: { $in: classes } }) }).lean();
  const paradeBy = new Map(parades.map((p) => [p.className, p]));

  const classMap = new Map();
  for (const s of students) {
    if (!classMap.has(s.className)) classMap.set(s.className, { className: s.className, total: 0, present: 0, inside: 0, left: 0, absent: 0, absentList: [], students: [] });
    const c = classMap.get(s.className);
    const a = byStudent.get(String(s._id));
    c.total += 1;
    let state = 'absent';
    if (a) {
      c.present += 1;
      if (a.outAt) { c.left += 1; state = 'left'; } else { c.inside += 1; state = 'inside'; }
    } else {
      c.absent += 1;
      c.absentList.push({ id: String(s._id), name: s.name, rollNo: s.rollNo });
    }
    c.students.push({ id: String(s._id), name: s.name, rollNo: s.rollNo, state, inAt: a?.inAt || null, outAt: a?.outAt || null, outMode: a?.outMode || null });
  }
  const list = [...classMap.values()].sort((a, b) => a.className.localeCompare(b.className, 'en', { numeric: true }));
  for (const c of list) {
    const p = paradeBy.get(c.className);
    // parade is matched with children inside the school right now (gate count, automatic)
    c.parade = p ? { count: p.count, byName: p.byName, at: p.updatedAt, diff: p.count - c.inside, match: p.count === c.inside } : null;
  }
  const totals = list.reduce((t, c) => ({ total: t.total + c.total, present: t.present + c.present, inside: t.inside + c.inside, left: t.left + c.left, absent: t.absent + c.absent }), { total: 0, present: 0, inside: 0, left: 0, absent: 0 });
  return { date, totals, classes: list };
}

async function monthly(month, classes, uptoDate) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const dateFilter = { $gte: from, $lte: uptoDate && uptoDate < to ? uptoDate : to };
  // school days = days on which the gate recorded anyone
  const days = (await Attendance.distinct('date', { date: dateFilter })).sort();
  const sFilter = { active: true };
  if (classes) sFilter.className = { $in: classes };
  const students = await Student.find(sFilter).select('name className rollNo').sort({ className: 1, rollNo: 1, name: 1 }).collation({ locale: 'en', numericOrdering: true }).lean();
  const counts = await Attendance.aggregate([{ $match: { date: dateFilter, student: { $in: students.map((s) => s._id) } } }, { $group: { _id: '$student', n: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  return {
    month,
    schoolDays: days.length,
    days,
    students: students.map((s) => {
      const present = byId.get(String(s._id)) || 0;
      return { id: String(s._id), name: s.name, className: s.className, rollNo: s.rollNo, present, absent: Math.max(0, days.length - present) };
    }),
  };
}

module.exports = { today, monthly };
