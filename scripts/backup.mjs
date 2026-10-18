// Google Sheet का डेटा padhkar backup/rows.json me JODTA hai (kuchh hatata nahi).
// Chalane ka tareeka:  node scripts/backup.mjs
// GitHub Actions isse har ghante chalata hai (.github/workflows/backup.yml).
import fs from 'node:fs';
import path from 'node:path';

const SHEET_ID = '1qajWuycAZywGNo9H3h0sARakBwbH7i5oE3BpW0knY0A';
const TABS = ['Website', 'Form Responses 1'];            // app.js jaisa hi; Website tab na ho to pehla tab milta hai
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'backup');
const JSON_FILE = path.join(DIR, 'rows.json');
const CSV_FILE = path.join(DIR, 'suchi-backup.csv');
const HEAD = ['Timestamp', 'पुरा नाम', 'पता', 'मोहल्ला', 'मोबाइल नंबर', 'जन्म दिनांक', 'शिक्षा/व्यवसाय', 'व्यवसाय समय', 'गणवेश', 'संघ प्रवेश वर्ष', 'संघ शिक्षण'];

function cellText(c) {            // app.js ke cellText jaisa
  if (!c || c.v == null) return '';
  const v = c.v;
  if (Array.isArray(v)) return `${v[0]}:${String(v[1]).padStart(2, '0')}`;
  const d = typeof v === 'string' && v.match(/^Date\((\d+),(\d+),(\d+)/);
  if (d) return `${d[3]}/${+d[2] + 1}/${d[1]}`;
  return String(v);
}
const rowKey = c => (c[0] && (c[0].f || c[0].v)) ? String(c[0].f || c[0].v) : `${cellText(c[1]).trim()}|${cellText(c[4])}`;

async function fetchLive() {
  for (const tab of TABS) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
    try {
      const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (!res.ok) continue;
      const txt = await res.text();
      const rows = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)).table.rows;
      if (rows.length) return rows;
    } catch (e) { console.log('fetch fail', tab, e.message); }
  }
  return null;
}

const old = fs.existsSync(JSON_FILE) ? JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')) : { rows: {} };
const live = await fetchLive();
if (!live) { console.log('Sheet nahi mili / khali - backup me kuchh nahi badla.'); process.exit(0); }

const today = new Date().toISOString().slice(0, 10);
const liveKeys = new Set();
let added = 0, updated = 0;
for (const r of live) {
  const c = r.c || [];
  if (!cellText(c[1]).trim()) continue;                       // naam nahi to chhodo
  const key = rowKey(c);
  liveKeys.add(key);
  const v = Array.from({ length: 11 }, (_, i) => (i === 0 ? (c[0] && (c[0].f || cellText(c[0]))) || '' : cellText(c[i])));
  const prev = old.rows[key];
  if (!prev) { old.rows[key] = { v, first: today }; added++; }
  else {
    if (JSON.stringify(prev.v) !== JSON.stringify(v)) { prev.v = v; updated++; }
    delete prev.gone;                                          // wapas sheet me aa gayi
  }
}
let gone = 0;
for (const [k, e] of Object.entries(old.rows)) if (!liveKeys.has(k) && !e.gone) { e.gone = today; gone++; }

const sorted = Object.fromEntries(Object.entries(old.rows).sort(([a], [b]) => a.localeCompare(b)));
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(JSON_FILE, JSON.stringify({ rows: sorted }, null, 1) + '\n');

// Excel me seedha khulne wali backup file (hindi ke liye BOM)
const q = s => `"${String(s).replace(/"/g, '""')}"`;
const csv = [[...HEAD, 'sheet me abhi hai?', 'sheet se hata (tarikh)'].map(q).join(',')]
  .concat(Object.values(sorted).map(e => [...e.v, e.gone ? 'NAHI' : 'haan', e.gone || ''].map(q).join(',')));
fs.writeFileSync(CSV_FILE, '﻿' + csv.join('\r\n') + '\r\n');

console.log(`live ${liveKeys.size} | naye ${added} | badle ${updated} | sheet se gayab ${gone} | backup me kul ${Object.keys(sorted).length}`);
