// Small RFC-4180 CSV parser (quotes, commas, newlines inside quotes, BOM).
function parseCsv(text) {
  const s = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const HEADER_MAP = {
  name: ['name', 'naam', 'नाम', 'student', 'student name', 'बच्चे का नाम'],
  className: ['class', 'kaksha', 'क्लास', 'कक्षा', 'class name', 'section'],
  guardianPhone: ['mobile', 'phone', 'parent mobile', 'parent phone', 'मोबाइल', 'माँ-बाप का मोबाइल', 'अभिभावक मोबाइल', 'guardian phone'],
  guardianName: ['parent', 'parent name', 'guardian', 'guardian name', 'अभिभावक', 'माता/पिता', 'पिता का नाम'],
  rollNo: ['roll', 'roll no', 'roll number', 'रोल', 'रोल नंबर'],
};

function mapHeader(cells) {
  const idx = {};
  cells.forEach((c, i) => {
    const k = c.trim().toLowerCase();
    for (const [field, names] of Object.entries(HEADER_MAP)) if (names.includes(k) && idx[field] === undefined) idx[field] = i;
  });
  return idx;
}

module.exports = { parseCsv, mapHeader };
