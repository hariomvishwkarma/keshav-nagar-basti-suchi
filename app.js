const SHEET_ID = '1qajWuycAZywGNo9H3h0sARakBwbH7i5oE3BpW0knY0A';
const SHEET_NAME = 'Website';   // 'Website' टैब न हो तो Google अपने आप पहला टैब (Form Responses 1) दे देता है
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'rss-suchi-cache-v2';
const MOHALLE = ['सेक्टर A', 'सेक्टर B', 'सेक्टर C', 'कुशवाह श्री नगर', 'गंगा बाग', 'विशाल नगर'];

// data.js (पुराना सेव किया डेटा) सिर्फ़ तब काम आता है जब इंटरनेट/शीट न मिले
let DATA = typeof SWAYAMSEVAK !== 'undefined' ? SWAYAMSEVAK : [];
try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.length) DATA = c; } catch (e) {}

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DEV = '०१२३४५६७८९';
const toEn = s => String(s || '').replace(/[०-९]/g, d => DEV.indexOf(d)).trim();

/* ---------- शीट पढ़ना (टाइप वाला JSON: तारीख़ सीधी मिलती है, दिन/महीने की उलझन नहीं) ---------- */
function cellText(c) {
  if (!c || c.v == null) return '';
  const v = c.v;
  if (Array.isArray(v)) return `${v[0]}:${String(v[1]).padStart(2, '0')}`;           // समय वाला सेल
  const d = typeof v === 'string' && v.match(/^Date\((\d+),(\d+),(\d+)/);
  if (d) return `${d[3]}/${+d[2] + 1}/${d[1]}`;                                          // तारीख़ → d/m/yyyy
  return String(v);
}

function galiOf(raw) {
  const a = toEn(raw);
  let m = a.match(/^(\d{1,2})\/(\d{1,2})\/20\d\d$/);          // शीट ने "1/1" को तारीख बना दिया
  if (m) return [m[1] + '/' + m[2], String(+m[2])];
  if (a.includes('हनुमान')) return [a, 'हनुमान गली'];
  if (a.includes('मेन रोड')) return [a, 'मेन रोड'];
  m = a.match(/(\d+)\s*\/\s*0*(\d+)/);
  if (m) return [a, m[2]];
  m = a.match(/^गली\s*(\d+)/);
  if (m) return [a, m[1]];
  return [a, 'अन्य'];
}

/* ---------- सफ़ाई: जैसा भी भरा हो, एक जैसा दिखे ---------- */
function fixMohalla(s) {
  s = s.trim().replace(/\s+/g, ' ');
  const m = s.match(/^(?:sector|सेक्टर)\s*([a-c])$/i);
  if (m) return 'सेक्टर ' + m[1].toUpperCase();
  return s.replace('गंगा बाग़', 'गंगा बाग').replace(/^गंगाबाग$/, 'गंगा बाग');
}

// जन्म दिनांक → dd/mm/yyyy ; महीना 12 से ऊपर हो तो दिन-महीना पलटा जाता है; 1077/0971 जैसे साल 19xx माने जाते हैं
function fixDob(s) {
  s = toEn(s).replace(/\s+/g, '');
  if (!s || /^\d{4}$/.test(s)) return s;                                // खाली या सिर्फ़ साल
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{3,4})$/);
  if (!m) return s;
  let [, d, mo, y] = m; d = +d; mo = +mo; y = +y;
  if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  if (y < 1000) y += 1000;
  if (y < 1900) y = 1900 + (y % 100);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return s;
  return `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
}

// व्यवसाय समय → "9:00 – 8:00" ; सिर्फ़ शुरुआत हो तो "10:00 से"
function fixTime(s) {
  let t = toEn(s).replace(/\s+/g, ' ');
  if (!t || /^(-+|no|na|n\/a|on|nil|none)$/i.test(t)) return '';
  if (/^shift$/i.test(t)) return 'शिफ्ट';
  const nums = [...t.matchAll(/(\d{1,2})\s*(?:[:.]+\s*(\d{1,2}))?/g)]
    .map(m => [+m[1], m[2] === undefined || +m[2] > 59 ? 0 : +m[2] * (m[2].length === 1 ? 10 : 1)])
    .filter(n => n[0] <= 24);
  if (!nums.length) return t;                                              // "निजी कार्य", "निवास पर" जैसा लिखा हो तो वैसा ही
  const f = ([h, mi]) => `${h}:${String(mi).padStart(2, '0')}`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t) || nums.length === 1) return `${f(nums[0])} से`;
  return `${f(nums[0])} – ${f(nums[1])}`;
}

// संघ प्रवेश वर्ष: 2023 → "2023" ; "4 वर्ष" / "3 yar" / "12" → "4 वर्ष से"
function fixVarsh(s) {
  s = toEn(s);
  if (!s) return '';
  if (/^(19|20)\d\d$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\s*(?:वर्ष|वर्षों|साल|years?|yrs?|yar|yer)?$/i);
  return m ? `${m[1]} वर्ष से` : s;
}

// रोमन (Hinglish) में लिखे सामान्य शब्द → हिंदी
const WORDS = {
  swayam: 'स्वयं', ka: 'का', ki: 'की', ke: 'के', karya: 'कार्य', karyarat: 'कार्यरत', vyavsay: 'व्यवसाय', vyavsaay: 'व्यवसाय',
  vyapar: 'व्यापार', naukari: 'नौकरी', naukri: 'नौकरी', private: 'निजी', job: 'नौकरी', company: 'कंपनी', mein: 'में',
  me: 'में', se: 'से', sambandhit: 'संबंधित', silai: 'सिलाई', aur: 'और', vidyarthi: 'विद्यार्थी', bidyarthi: 'विद्यार्थी',
  student: 'विद्यार्थी', kirana: 'किराना', kirane: 'किराने', dukaan: 'दुकान', dukan: 'दुकान', shop: 'दुकान', gadi: 'गाड़ी',
  chalate: 'चलाते', hain: 'हैं', hai: 'है', krishak: 'कृषक', kheti: 'खेती', nagar: 'नगर', nigam: 'निगम', readymade: 'रेडीमेड',
  redimade: 'रेडीमेड', redimed: 'रेडीमेड', tailoring: 'सिलाई', tailering: 'सिलाई', riksha: 'रिक्शा', rikshaw: 'रिक्शा',
  driver: 'ड्राइवर', mazdoori: 'मजदूरी', teacher: 'शिक्षक', business: 'व्यवसाय', privet: 'निजी', naukari_: 'नौकरी',
  chali: 'चलाते', sham: 'शाम', subah: 'सुबह', ratri: 'रात्रि', baje: 'बजे', tak: 'तक', rat: 'रात', ko: 'को',
};
// ये शब्द हमेशा हिंदी किए जाते हैं; "private/job/company" जैसे अंग्रेज़ी शब्द तभी जब वाक्य में Hinglish शब्द भी हो
const ALWAYS = new Set(['tailoring', 'tailering', 'riksha', 'rikshaw', 'driver', 'student', 'readymade', 'redimade', 'redimed']);
const WORDS2 = { work: 'कार्य', electric: 'इलेक्ट्रिक', auto: 'ऑटो', loading: 'लोडिंग', child: 'चाइल्ड', water: 'वाटर' };
const fixHinglish = s => {
  const ws = s.match(/[A-Za-z]+/g) || [];
  const hin = ws.some(w => WORDS[w.toLowerCase()] && !['private', 'job', 'company', 'shop', 'business', 'teacher'].includes(w.toLowerCase()) && !ALWAYS.has(w.toLowerCase()));
  return s.replace(/[A-Za-z]+/g, w => {
    const k = w.toLowerCase();
    if (ALWAYS.has(k)) return WORDS[k];
    return hin ? (WORDS[k] || WORDS2[k] || w) : w;
  });
};

const fixNaamBasic = s => s.replace(/\s+/g, ' ').replace(/\bji\b/gi, 'जी').trim();

const CORR = typeof CORRECTIONS !== 'undefined' ? CORRECTIONS : {};   // corrections.js : हाथ से सुधार

function rowsToPeople(rows) {
  const out = [];
  for (const r of rows) {
    const c = i => cellText(r.c[i]);
    const raw = c(1).trim();
    if (!raw) continue;
    const mohalla = fixMohalla(c(3));
    const [pata, gali] = galiOf(c(2));
    const p = {
      naam: fixNaamBasic(raw), pata, mohalla, gali,
      phone: toEn(c(4)).replace(/\D/g, '').slice(-10),
      dob: fixDob(c(5)), kaam: fixHinglish(c(6).trim()), samay: fixTime(c(7)),
      ganvesh: c(8).trim(), varsh: fixVarsh(c(9)), shikshan: c(10).trim(),
    };
    Object.assign(p, CORR[raw] || {});
    out.push(p);
  }
  return dedupe(out);
}

// एक ही व्यक्ति ने फ़ॉर्म दो बार भरा हो तो एक ही रखें: मोबाइल समान + नाम समान।
// (भाई/पिता-पुत्र का मोबाइल या पता एक हो पर नाम अलग हो तो सब रहेंगे)
// बाद वाली एंट्री मान्य, उसके खाली खाने पुरानी एंट्री से भरे जाते हैं।
// नाम की तुलना में "जी", स्पेस और ं/न् (हिरेंद्र = हिरेन्द्र) का फ़र्क नज़रअंदाज़ होता है।
const normName = s => s.replace(/जी|\s|\.|-|़/g, '').replace(/[ंँ]/g, 'न्');
function dedupe(list) {
  const out = [];
  for (const p of list) {
    const i = out.findIndex(o => o.phone === p.phone && normName(o.naam) === normName(p.naam)
      && (p.phone || o.pata.replace(/\s/g, '') === p.pata.replace(/\s/g, '')));
    if (i >= 0) { for (const k in p) if (!p[k]) p[k] = out[i][k]; out.splice(i, 1); }
    out.push(p);
  }
  return out;
}

// पहले से सेव/ऑफ़लाइन सूची में भी दोहराव न दिखें
DATA = dedupe(DATA);

/* ---------- अंग्रेज़ी में लिखे नाम → हिंदी (Google Input Tools; एक बार का नतीजा फ़ोन/ब्राउज़र में याद रहता है) ---------- */
const TR_KEY = 'rss-translit-v1';
let TR = {};
try { TR = JSON.parse(localStorage.getItem(TR_KEY) || '{}'); } catch (e) {}

async function toHindi(word) {
  const k = word.toLowerCase();
  if (TR[k]) return TR[k];
  try {
    const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`);
    const j = await res.json();
    const h = j[0] === 'SUCCESS' && j[1][0][1][0];
    if (h) { TR[k] = h; try { localStorage.setItem(TR_KEY, JSON.stringify(TR)); } catch (e) {} return h; }
  } catch (e) {}
  return word;                                  // न मिले तो जैसा था वैसा
}

function applyTranslit(people) {
  let changed = false;
  for (const p of people) {
    if (CORR[p.naam] && CORR[p.naam].naam) continue;
    const n = p.naam.replace(/\b[A-Za-z]{2,}\b/g, w => /^ji$/i.test(w) ? 'जी' : (TR[w.toLowerCase()] || w));
    if (n !== p.naam) { p.naam = n; changed = true; }
  }
  return changed;
}

async function fixEnglishNames(people) {
  const words = new Set();
  people.forEach(p => (p.naam.match(/\b[A-Za-z]{2,}\b/g) || []).forEach(w => { if (!/^ji$/i.test(w) && !TR[w.toLowerCase()]) words.add(w); }));
  await Promise.all([...words].map(toHindi));
  return applyTranslit(people);
}

/* ---------- बैकअप (GitHub में हर घंटे जमा होता है: backup/rows.json) ---------- */
const BK_ON = 'rss-backup-on';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

function backupUrls() {
  const m = location.hostname.match(/^(.+)\.github\.io$/), repo = location.pathname.split('/')[1];
  return [...(m && repo ? [`https://raw.githubusercontent.com/${m[1]}/${repo}/main/backup/rows.json`] : []), 'backup/rows.json'];
}
async function loadBackup() {
  for (const u of backupUrls()) {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) continue;
      const j = await res.json();
      return Object.entries(j.rows || {}).map(([key, e]) => ({ key, v: e.v }));
    } catch (e) {}
  }
  return [];
}
const liveKey = c => (c[0] && (c[0].f || c[0].v)) ? String(c[0].f || c[0].v) : `${cellText(c[1]).trim()}|${cellText(c[4])}`;
const bkRow = b => ({ c: b.v.map(v => ({ v })) });

async function loadSheet() {
  const status = $('status');
  let live = null;
  try {
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const txt = await res.text();
    live = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)).table.rows.filter(r => r.c && r.c[1] && r.c[1].v);
    if (!live.length) live = null;
  } catch (e) { live = null; }
  const bk = await loadBackup();

  let rows, note, time = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  if (live) {
    const keys = new Set(live.map(r => liveKey(r.c)));
    const missing = bk.filter(b => !keys.has(b.key));
    const on = lsGet(BK_ON) === '1';
    rows = on ? [...live, ...missing.map(bkRow)] : live;
    note = 'लाइव शीट से अपडेट · ' + time;
    if (missing.length) note += on
      ? ` · बैकअप की ${missing.length} एंट्री भी जुड़ी हैं <a href="#" id="bkToggle">(हटाएँ)</a>`
      : ` · ⚠ बैकअप में ${missing.length} एंट्री हैं जो शीट में नहीं मिलीं <a href="#" id="bkToggle">(बैकअप से जोड़ें)</a>`;
  } else if (bk.length) {
    rows = bk.map(bkRow);
    note = '⚠ शीट नहीं मिली – बैकअप से सूची दिखाई जा रही है';
  } else {
    status.textContent = 'ऑफ़लाइन – पिछली सेव सूची दिखाई जा रही है';
    return;
  }

  const people = rowsToPeople(rows);
  if (!people.length) { status.textContent = 'ऑफ़लाइन – पिछली सेव सूची दिखाई जा रही है'; return; }
  applyTranslit(people);                           // पहले से याद किए नाम तुरंत
  const changed = JSON.stringify(people) !== JSON.stringify(DATA);
  DATA = people;
  if (people.length > 10 && new Set(people.map(p => p.mohalla)).size === 1)
    note += ' · ⚠ सिर्फ़ एक ही मोहल्ले की एंट्री आ रही हैं (शीट में Filter / छुपी पंक्तियाँ हों तो खोलिए)';
  status.innerHTML = note;
  if (changed) render(true);
  if (await fixEnglishNames(people)) render(true);   // नए अंग्रेज़ी नाम हों तो हिंदी करके दोबारा दिखाएँ
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(people)); } catch (e) {}
}

$('status').addEventListener('click', e => {
  if (e.target.id !== 'bkToggle') return;
  e.preventDefault();
  try { localStorage.setItem(BK_ON, lsGet(BK_ON) === '1' ? '0' : '1'); } catch (err) {}
  loadSheet();
});

/* ---------- क्रम (sorting): मोहल्ला → गली नंबर → मकान नंबर ---------- */
const isNum = g => /^\d+$/.test(g);
const galiSort = (a, b) => {
  if (isNum(a) && isNum(b)) return a - b;
  return isNum(a) ? -1 : isNum(b) ? 1 : a.localeCompare(b, 'hi');
};
function houseNo(p) {
  const a = toEn(p.pata);
  if (/^गली/.test(a)) return Infinity;                          // "गली 5, कॉर्नर का मकान" – मकान नंबर नहीं है
  const m = a.match(/(\d+)[\s,\d]*\//) || a.match(/(\d+)/);   // "211/3" → 211, "45 ,46/1" → 45
  return m ? +m[1] : Infinity;
}
function sortPeople(list) {
  const mi = m => { const i = MOHALLE.indexOf(m); return i < 0 ? 99 : i; };
  return [...list].sort((a, b) =>
    mi(a.mohalla) - mi(b.mohalla) || galiSort(a.gali, b.gali) ||
    houseNo(a) - houseNo(b) || a.naam.localeCompare(b.naam, 'hi'));
}

/* ---------- दिखाना ---------- */
const galiLabel = g => isNum(g) ? 'गली ' + g : g;

function block(href, title, count, cls = '') {
  return `<a class="block ${cls}${count ? '' : ' empty'}" href="${href}"><span>${esc(title)}</span><span class="n">${count} स्वयंसेवक</span></a>`;
}

function card(p, n) {
  const call = p.phone
    ? `<a class="call" href="tel:+91${p.phone}">📞 ${p.phone}</a>`
    : `<div class="call none">नंबर उपलब्ध नहीं</div>`;
  const select = `<label class="person-select"><input class="person-checkbox" type="checkbox" data-person="${esc(personKey(p))}" ${SELECTED.has(personKey(p)) ? 'checked' : ''} ${p.phone ? '' : 'disabled'}><span>संदेश के लिए चुनें</span></label>`;
  const rows = [
    ['पता', p.pata], ['जन्म दिनांक', p.dob], ['शिक्षा / व्यवसाय', p.kaam],
    ['व्यवसाय समय', p.samay], ['गणवेश', p.ganvesh], ['संघ प्रवेश वर्ष', p.varsh],
    ['संघ शिक्षण', p.shikshan],
  ].filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('');
  return `<article class="card">
    <div class="person-heading"><h3><span class="no">${n}.</span> ${esc(p.naam)}</h3>${select}</div>
    <span class="tag">${esc(p.mohalla)}</span><span class="tag">${esc(galiLabel(p.gali))}</span>
    ${call}<dl>${rows}</dl></article>`;
}

// लिस्ट में मोहल्ला / गली के शीर्षक: showM = मोहल्ले के शीर्षक, showG = गली के शीर्षक
function groupedCards(people, showM, showG) {
  let html = '', pm = null, pg = null;
  people.forEach((p, i) => {
    if (showM && p.mohalla !== pm) {
      const c = people.filter(x => x.mohalla === p.mohalla).length;
      html += `<h3 class="grp m">${esc(p.mohalla)} <small>(${c})</small></h3>`; pm = p.mohalla; pg = null;
    }
    if (showG && p.gali !== pg) {
      const c = people.filter(x => x.mohalla === p.mohalla && x.gali === p.gali).length;
      html += `<h4 class="grp g">${esc(galiLabel(p.gali))} <small>(${c})</small></h4>`; pg = p.gali;
    }
    html += card(p, i + 1);
  });
  return html;
}

// ऊपर की पंक्ति: कुल सूची + सभी मोहल्ले (हर पेज पर दिखती है, चुना हुआ मोहल्ला हाइलाइट)
function mohBlocks(active) {
  const extra = [...new Set(DATA.map(p => p.mohalla))].filter(m => m && !MOHALLE.includes(m));   // शीट में अलग लिखा नाम भी दिखे
  return block('#/', 'कुल सूची', DATA.length, 'all' + (active == null ? ' active' : ''))
    + [...MOHALLE, ...extra].map(m => block('#/' + encodeURIComponent(m), m, DATA.filter(p => p.mohalla === m).length, m === active ? 'active' : '')).join('');
}

let VIEW = { people: [], heading: '', file: 'suchi' };
const SELECTED = new Set();
const personKey = p => [p.phone, p.naam, p.mohalla, p.gali, p.pata].join('|');
let OUTREACH = { type: '', people: [], index: 0 };
function resetOutreach() {
  OUTREACH = { type: '', people: [], index: 0 };
  $('outreachNext').hidden = true;
}

function updateOutreach() {
  const selected = DATA.filter(p => p.phone && SELECTED.has(personKey(p)));
  const visible = VIEW.people.filter(p => p.phone);
  const visibleSelected = visible.filter(p => SELECTED.has(personKey(p))).length;
  $('selectedCount').textContent = `${selected.length} चुने`;
  $('selectVisible').checked = visible.length > 0 && visibleSelected === visible.length;
  $('selectVisible').indeterminate = visibleSelected > 0 && visibleSelected < visible.length;
  $('selectVisible').disabled = !visible.length;
  $('startWhatsapp').disabled = $('startSms').disabled = $('startCall').disabled = !selected.length;
}

function render(keepScroll) {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const q = $('search').value.trim().toLowerCase();
  const blocks = $('blocks'), galiBlocks = $('galiBlocks'), title = $('listTitle'), crumbs = $('crumbs');
  let people = sortPeople(DATA), heading = '', showM = false, showG = false, file = 'kul-suchi';

  if (q) {
    people = people.filter(p => [p.naam, p.phone, p.pata, p.mohalla, p.kaam].join(' ').toLowerCase().includes(q));
    blocks.innerHTML = galiBlocks.innerHTML = '';
    crumbs.innerHTML = '<a href="#/">← होम</a>';
    heading = `खोज परिणाम – "${$('search').value.trim()}"`; file = 'khoj-parinam';
  } else if (!parts.length) {
    crumbs.innerHTML = '';
    blocks.innerHTML = mohBlocks(null); galiBlocks.innerHTML = '';
    heading = 'कुशवाह नगर बस्ती – कुल सूची'; showM = true; showG = true;
  } else {
    const m = parts[0], g = parts[1];
    const inM = people.filter(p => p.mohalla === m);
    const galis = [...new Set(inM.map(p => p.gali))].sort(galiSort);
    crumbs.innerHTML = `<a href="#/">होम</a><span class="sep">›</span>` +
      (g ? `<a href="#/${encodeURIComponent(m)}">${esc(m)}</a><span class="sep">›</span><b>${esc(galiLabel(g))}</b>` : `<b>${esc(m)}</b>`);
    blocks.innerHTML = mohBlocks(m);
    galiBlocks.innerHTML = block('#/' + encodeURIComponent(m), 'सभी – ' + m, inM.length, 'all' + (g ? '' : ' active'))
      + galis.map(x => block('#/' + encodeURIComponent(m) + '/' + encodeURIComponent(x), galiLabel(x), inM.filter(p => p.gali === x).length, x === g ? 'active' : '')).join('');
    people = g ? inM.filter(p => p.gali === g) : inM;
    heading = `${m}${g ? ' – ' + galiLabel(g) : ' – सभी स्वयंसेवक'}`; showG = !g; file = m + (g ? '-' + galiLabel(g) : '-sabhi');
  }

  title.textContent = `${heading} (${people.length})`;
  $('list').innerHTML = people.length ? groupedCards(people, showM, showG)
    : '<div class="empty-msg">कोई स्वयंसेवक नहीं मिला</div>';
  $('tools').hidden = !people.length;
  $('outreach').hidden = !people.length;
  VIEW = { people, heading, file: file.replace(/[\s\\/:*?"<>|]+/g, '_') };
  updateOutreach();
  if (!q && !keepScroll) window.scrollTo(0, 0);
}

/* ---------- चुने हुए लोगों से एक-एक करके संपर्क ---------- */
const outreachLabels = { whatsapp: 'WhatsApp', sms: 'SMS', call: 'कॉल' };

function launchOutreach(type) {
  resetOutreach();
  const people = DATA.filter(p => p.phone && SELECTED.has(personKey(p)));
  if (!people.length) return;
  if (type !== 'call' && !$('outreachMessage').value.trim()) {
    $('outreachMessage').focus();
    $('outreachStatus').textContent = 'पहले संदेश लिखें।';
    return;
  }
  OUTREACH = { type, people, index: 0 };
  openNextOutreach();
}

function openNextOutreach() {
  const { type, people, index } = OUTREACH;
  if (index >= people.length) return;
  const person = people[index];
  const number = '+91' + person.phone;
  const message = encodeURIComponent($('outreachMessage').value.trim());
  const urls = {
    whatsapp: `https://wa.me/${number.slice(1)}?text=${message}`,
    sms: `sms:${number}?body=${message}`,
    call: `tel:${number}`,
  };
  window.open(urls[type], '_blank');
  OUTREACH.index++;
  $('outreachStatus').textContent = `${person.naam} (${index + 1}/${people.length}) के लिए ${outreachLabels[type]} खुला। वहाँ भेजने/कॉल करने के बाद यहाँ लौटकर अगला चुनें।`;
  const next = $('outreachNext');
  next.hidden = OUTREACH.index >= people.length;
  next.textContent = `अगला ${outreachLabels[type]} (${OUTREACH.index + 1}/${people.length})`;
}

/* ---------- Excel डाउनलोड ---------- */
const COLS = [
  ['क्र.', (p, i) => i + 1, 5], ['नाम', p => p.naam, 24], ['मोहल्ला', p => p.mohalla, 16], ['गली', p => galiLabel(p.gali), 12],
  ['पता', p => p.pata, 18], ['मोबाइल नंबर', p => p.phone, 14], ['जन्म दिनांक', p => p.dob, 13],
  ['शिक्षा / व्यवसाय', p => p.kaam, 26], ['व्यवसाय समय', p => p.samay, 14], ['गणवेश', p => p.ganvesh, 11],
  ['संघ प्रवेश वर्ष', p => p.varsh, 12], ['संघ शिक्षण', p => p.shikshan, 16],
];

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadExcel() {
  const aoa = [COLS.map(c => c[0]), ...VIEW.people.map((p, i) => COLS.map(c => c[1](p, i)))];
  const name = 'RSS-' + VIEW.file;
  if (window.XLSX) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = COLS.map(c => ({ wch: c[2] }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'सूची');
    XLSX.writeFile(wb, name + '.xlsx');
  } else {   // इंटरनेट से लाइब्रेरी न मिले तो CSV (Excel में खुल जाती है)
    const csv = aoa.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), name + '.csv');
  }
}

/* ---------- PDF / प्रिंट (A4) ---------- */
function buildPrint() {
  const full = $('optCols').value === 'full';
  const cols = full
    ? ['क्र.', 'नाम', 'पता', 'मोबाइल', 'जन्म दिनांक', 'शिक्षा / व्यवसाय', 'व्यवसाय समय', 'गणवेश', 'प्रवेश वर्ष', 'संघ शिक्षण']
    : ['क्र.', 'नाम', 'पता', 'मोबाइल'];
  const cells = (p, i) => full
    ? [i, p.naam, p.pata, p.phone, p.dob, p.kaam, p.samay, p.ganvesh, p.varsh, p.shikshan]
    : [i, p.naam, p.pata, p.phone];
  const split = /कुल सूची|सभी|खोज/.test(VIEW.heading);
  const byGali = !/गली/.test(VIEW.heading);
  let body = '', pm = null, pg = null;
  VIEW.people.forEach((p, i) => {
    if (split && !/खोज/.test(VIEW.heading)) {
      if (p.mohalla !== pm && /कुल सूची/.test(VIEW.heading)) { body += `<tr class="gm"><td colspan="${cols.length}">${esc(p.mohalla)}</td></tr>`; pm = p.mohalla; pg = null; }
      if (byGali && p.gali !== pg) { body += `<tr class="gg"><td colspan="${cols.length}">${esc(galiLabel(p.gali))}</td></tr>`; pg = p.gali; }
    }
    body += '<tr>' + cells(p, i + 1).map(v => `<td>${esc(v)}</td>`).join('') + '</tr>';
  });
  const today = new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  $('printArea').innerHTML = `
    <div class="ph"><div class="pt">🚩 कुशवाह नगर बस्ती – स्वयंसेवक सूची</div>
    <div class="ps">${esc(VIEW.heading)} · कुल ${VIEW.people.length} स्वयंसेवक · दिनांक: ${today}</div></div>
    <table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  $('pageStyle').textContent = `@page{size:A4 ${$('optOrient').value};margin:10mm}`;
}

function printPdf() {
  buildPrint();
  const old = document.title;
  document.title = 'RSS-' + VIEW.file;       // PDF की फ़ाइल का नाम यही बनता है
  window.print();
  setTimeout(() => { document.title = old; }, 500);
}

window.addEventListener('hashchange', () => { $('search').value = ''; render(); });
$('search').addEventListener('input', () => render());
$('btnXls').addEventListener('click', downloadExcel);
$('btnPdf').addEventListener('click', printPdf);
$('list').addEventListener('change', e => {
  if (!e.target.classList.contains('person-checkbox')) return;
  resetOutreach();
  if (e.target.checked) SELECTED.add(e.target.dataset.person);
  else SELECTED.delete(e.target.dataset.person);
  updateOutreach();
});
$('selectVisible').addEventListener('change', e => {
  resetOutreach();
  VIEW.people.filter(p => p.phone).forEach(p => {
    if (e.target.checked) SELECTED.add(personKey(p));
    else SELECTED.delete(personKey(p));
  });
  render(true);
});
$('clearSelection').addEventListener('click', () => {
  resetOutreach();
  SELECTED.clear();
  render(true);
});
$('startWhatsapp').addEventListener('click', () => launchOutreach('whatsapp'));
$('startSms').addEventListener('click', () => launchOutreach('sms'));
$('startCall').addEventListener('click', () => launchOutreach('call'));
$('outreachNext').addEventListener('click', openNextOutreach);
render();
loadSheet();
setInterval(loadSheet, REFRESH_MS);
