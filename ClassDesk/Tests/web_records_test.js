// Checks that the browser port of the DeskHub records rules embedded in Windows-Version/src/index.html
// (canonical JSON, record hash, key encoding with crypto.subtle) matches Hub/js/deskhub-records.js.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'Windows-Version', 'src', 'index.html'), 'utf8');
const m = html.match(/\/\/ <deskhub-records-web>([\s\S]*?)\/\/ <\/deskhub-records-web>/);
if (!m) { console.error('marker block not found'); process.exit(1); }
new Function(m[1]).call(globalThis);          // defines globalThis.DeskHubWeb
const web = globalThis.DeskHubWeb;
const ref = require(path.join(__dirname, '..', '..', 'Hub', 'js', 'deskhub-records.js'));

const samples = [
  { key: 'course:crs-06cef6', deleted: false, value: { id: 'crs-06cef6', name: 'Inglese Aziendale è ñ — 日本語 😀', n: 6, f: 0.1, big: 1e21, neg: -3.5, z: null, arr: [3, 2, { b: 1, a: [true, false] }], nested: { z: 1, a: { y: 2, b: 1 } } } },
  { key: 'student:st-1', deleted: false, value: { firstName: 'José', lastName: "O'Brien \"Q\"", email: 'j@example.com', notes: 'riga1\nriga2\t\\', level: 'B1' } },
  { key: 'settings:general', deleted: false, value: { currency: '€', passThreshold: 6, defaultHourlyRate: 10.5, language: 'it' } },
  { key: 'course:gone', deleted: true, value: null },
  { key: 'k/with spaces & ünïcode:日本', deleted: false, value: [] },
  { key: 'a.b_c-d', deleted: false, value: 0 },
];
(async () => {
  let fail = 0;
  for (const s of samples) {
    const a = await web.hashOf(s.deleted, s.value);
    const b = ref.hashOf(s.deleted, s.value);
    const ra = await web.hashRecord({ deleted: s.deleted, value: s.value });
    const rb = ref.hashRecord({ deleted: s.deleted, value: s.value });
    const ea = web.encodeKey(s.key), eb = ref.encodeKey(s.key);
    const ca = web.canonical(s.value), cb = ref.canonical(s.value);
    const ok = a === b && ra === rb && ea === eb && ca === cb;
    if (!ok) fail++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.key}\n     hash ${a}\n     file ${ea}`);
  }
  console.log(fail ? `FAILED: ${fail}` : `all ${samples.length} samples identical to Hub/js/deskhub-records.js`);
  process.exit(fail ? 1 : 0);
})();
