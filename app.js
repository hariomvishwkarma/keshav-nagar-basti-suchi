const SHEET_ID = '1qajWuycAZywGNo9H3h0sARakBwbH7i5oE3BpW0knY0A';
const SHEET_NAME = 'Form Responses 1';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'rss-suchi-cache-v1';

// data.js (पुराना सेव किया डेटा) सिर्फ़ तब काम आता है जब इंटरनेट/शीट न मिले
let DATA = typeof SWAYAMSEVAK !== 'undefined' ? SWAYAMSEVAK : [];
try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.length) DATA = c; } catch (e) {}

const DEV = '०१२३४५६७८९';
const toEn = s => String(s || '').replace(/[०-९]/g, d => DEV.indexOf(d)).trim();

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
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

function rowsToPeople(rows) {
  const out = [];
  for (const r of rows.slice(1)) {
    const naam = (r[1] || '').trim();
    if (!naam) continue;
    const mohalla = (r[3] || '').trim().replace('गंगा बाग़', 'गंगा बाग');
    const [pata, gali] = galiOf(r[2]);
    out.push({
      naam, pata, mohalla, gali,
      phone: toEn(r[4]).replace(/\D/g, '').slice(-10),
      dob: toEn(r[5]), kaam: (r[6] || '').trim(), samay: (r[7] || '').trim(),
      ganvesh: (r[8] || '').trim(), varsh: toEn(r[9]).replace(/\.0$/, ''), shikshan: (r[10] || '').trim(),
    });
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

async function loadSheet() {
  const status = document.getElementById('status');
  try {
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const people = rowsToPeople(parseCSV(await res.text()));
    if (!people.length) throw new Error('empty');
    const changed = JSON.stringify(people) !== JSON.stringify(DATA);
    DATA = people;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(people)); } catch (e) {}
    status.textContent = 'लाइव शीट से अपडेट · ' + new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
    if (changed) render(true);
  } catch (e) {
    status.textContent = 'ऑफ़लाइन – पिछली सेव सूची दिखाई जा रही है';
  }
}

const MOHALLE = ['सेक्टर A', 'सेक्टर B', 'सेक्टर C', 'कुशवाह श्री नगर', 'गंगा बाग', 'विशाल नगर'];

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const galiLabel = g => /^\d+$/.test(g) ? 'गली ' + g : g;
const galiSort = (a, b) => {
  const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
  if (na && nb) return a - b;
  return na ? -1 : nb ? 1 : a.localeCompare(b, 'hi');
};

function block(href, title, count, cls = '') {
  return `<a class="block ${cls}${count ? '' : ' empty'}" href="${href}"><span>${esc(title)}</span><span class="n">${count} स्वयंसेवक</span></a>`;
}

function card(p) {
  const call = p.phone
    ? `<a class="call" href="tel:+91${p.phone}">📞 ${p.phone}</a>`
    : `<div class="call none">नंबर उपलब्ध नहीं</div>`;
  const rows = [
    ['पता', p.pata], ['जन्म दिनांक', p.dob], ['शिक्षा / व्यवसाय', p.kaam],
    ['व्यवसाय समय', p.samay], ['गणवेश', p.ganvesh], ['संघ प्रवेश वर्ष', p.varsh],
    ['संघ शिक्षण', p.shikshan],
  ].filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('');
  return `<article class="card">
    <h3>${esc(p.naam)}</h3>
    <span class="tag">${esc(p.mohalla)}</span><span class="tag">${esc(galiLabel(p.gali))}</span>
    ${call}<dl>${rows}</dl></article>`;
}

function render(keepScroll) {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const q = $('search').value.trim().toLowerCase();
  const blocks = $('blocks'), title = $('listTitle'), crumbs = $('crumbs');
  let people = DATA, heading = '';

  if (q) {
    people = DATA.filter(p => [p.naam, p.phone, p.pata, p.mohalla, p.kaam].join(' ').toLowerCase().includes(q));
    blocks.innerHTML = '';
    crumbs.innerHTML = '<a href="#/">← होम</a>';
    heading = `खोज परिणाम (${people.length})`;
  } else if (!parts.length) {
    // होम: कुल सूची + मोहल्ले
    crumbs.innerHTML = '';
    blocks.innerHTML = MOHALLE.map(m => block('#/' + encodeURIComponent(m), m, DATA.filter(p => p.mohalla === m).length)).join('');
    heading = `कुशवाह नगर बस्ती – कुल सूची (${people.length})`;
  } else if (parts[0] === 'all') {
    crumbs.innerHTML = '<a href="#/">← होम</a>';
    blocks.innerHTML = '';
    heading = `कुल सूची – सभी स्वयंसेवक (${people.length})`;
  } else {
    const m = parts[0], g = parts[1];
    const inM = DATA.filter(p => p.mohalla === m);
    const galis = [...new Set(inM.map(p => p.gali))].sort(galiSort);
    crumbs.innerHTML = `<a href="#/">होम</a><span class="sep">›</span>` +
      (g ? `<a href="#/${encodeURIComponent(m)}">${esc(m)}</a><span class="sep">›</span><b>${esc(galiLabel(g))}</b>` : `<b>${esc(m)}</b>`);
    blocks.innerHTML = block('#/' + encodeURIComponent(m), 'सभी – ' + m, inM.length, 'all' + (g ? '' : ' active'))
      + galis.map(x => block('#/' + encodeURIComponent(m) + '/' + encodeURIComponent(x), galiLabel(x), inM.filter(p => p.gali === x).length, x === g ? 'active' : '')).join('');
    people = g ? inM.filter(p => p.gali === g) : inM;
    heading = `${m}${g ? ' – ' + galiLabel(g) : ' – सभी स्वयंसेवक'} (${people.length})`;
  }

  title.textContent = heading;
  $('list').innerHTML = people.length ? people.map(card).join('')
    : (heading ? '<div class="empty-msg">कोई स्वयंसेवक नहीं मिला</div>' : '');
  if (!q && !keepScroll) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => { $('search').value = ''; render(); });
$('search').addEventListener('input', render);
render();
loadSheet();
setInterval(loadSheet, REFRESH_MS);
