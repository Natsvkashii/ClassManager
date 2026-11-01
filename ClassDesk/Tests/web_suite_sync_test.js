// Runs the Windows (index.html) Suite sync methods in node against a fake native bridge backed by temp folders:
// device A exports, HubDesk copies records to device B, B applies (with pre-sync backup), deletion propagates by tombstone.
const fs = require('fs'), os = require('os'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'Windows-Version', 'src', 'index.html'), 'utf8');
const lib = html.match(/\/\/ <deskhub-records-web>([\s\S]*?)\/\/ <\/deskhub-records-web>/)[1];
new Function(lib).call(globalThis);
const a0 = html.indexOf('// ===== ClassDesk Suite (Hub/HUBDESK.md)');
const a1 = html.indexOf('            renderHubSettingsPanel() {');
const methods = html.slice(a0, a1);
const Base = new Function('DeskHubWeb', 'IS_UNSTABLE_BUILD', 'INITIAL_DATA', `return class App {
  constructor(){ this.state={courses:[],studentsDirectory:[],rubrics:[],billingContacts:[],deletedItems:[],settings:{language:'it',currency:'$'},activeCourseId:'',version:'x'}; this.toasts=[]; }
  ensureDataMigration(){} selectLatestLevelAndModule(){} renderAll(){} showToast(m){this.toasts.push(m);} t(k){return k;}
  async persist(){ this.state.lastUpdated=new Date().toISOString(); this.suiteStateSaved(); }
  ${methods}
}`)(globalThis.DeskHubWeb, 1, { version: 'x' });

function bridge(hub, backups) {
  const full = (rel) => { if (rel.split(/[\\/]/).includes('..')) throw new Error('path escape'); return path.join(hub, rel); };
  return {
    deskhubList: async (rel) => { try { return fs.readdirSync(full(rel)).filter(n => fs.statSync(path.join(full(rel), n)).isFile()).map(n => { const st = fs.statSync(path.join(full(rel), n)); return { n, s: st.size, m: String(st.mtimeMs) }; }); } catch { return []; } },
    deskhubRead: async (rel) => { try { return fs.readFileSync(full(rel), 'utf8'); } catch { return null; } },
    deskhubWrite: async (rel, text) => { const f = full(rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', text); fs.renameSync(f + '.tmp', f); return true; },
    saveAutoBackup: async (name, text) => { backups.push(name); return { success: true }; },
  };
}
const mk = (hub, loadedStamp) => { const app = new Base(); const backups = []; global.window = globalThis; globalThis.window.electronAPI = bridge(hub, backups); app.backups = backups; app._suiteLoadedStamp = loadedStamp; app._suiteApi = window.electronAPI; return app; };
const use = (app) => { globalThis.window.electronAPI = app._suiteApi; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails++; };

(async () => {
  globalThis.localStorage = (() => { let st = {}; return { getItem: k => st[k] ?? null, setItem: (k, v) => { st[k] = v; }, clear: () => { st = {}; } }; })();
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'cdweb-'));
  const hubA = path.join(T, 'hubA'), hubB = path.join(T, 'hubB');
  // device A
  const A = mk(hubA, '');
  A.state.courses.push({ id: 'crs-1', name: 'Inglese è ñ', levels: [] }, { id: 'crs-2', name: 'Spagnolo', levels: [] });
  A.state.studentsDirectory.push({ id: 'st-1', firstName: 'José', lastName: 'Núñez' }, { id: 'st-2', firstName: 'Giulia', lastName: 'Rossi' });
  A.state.settings.googleAccessToken = 'SECRET'; A.state.settings.currency = '€';
  use(A); await A.suiteStart(); clearInterval(A._suiteTimer); clearInterval(A._suiteStatusTimer);
  const files = fs.readdirSync(path.join(hubA, 'records', 'classdesk')).sort();
  console.log('A record files:', files.join(', '));
  check('A exported 5 records', files.length === 5);
  check('no token in records', !files.some(f => fs.readFileSync(path.join(hubA, 'records', 'classdesk', f), 'utf8').includes('SECRET')));
  // HubDesk copies A -> B
  fs.mkdirSync(path.join(hubB, 'records'), { recursive: true });
  fs.cpSync(path.join(hubA, 'records', 'classdesk'), path.join(hubB, 'records', 'classdesk'), { recursive: true });
  globalThis.localStorage.clear();
  const B = mk(hubB, '');
  use(B); await B.suiteStart(); clearInterval(B._suiteTimer); clearInterval(B._suiteStatusTimer);
  console.log('B courses:', B.state.courses.map(c => c.name), 'students:', B.state.studentsDirectory.map(s => s.firstName), 'currency:', B.state.settings.currency, 'backups:', B.backups);
  check('B has the same courses/students/currency', B.state.courses.length === 2 && B.state.studentsDirectory.length === 2 && B.state.settings.currency === '€');
  check('B made exactly one pre-sync backup before applying', B.backups.length === 1);
  const snap = () => fs.readdirSync(path.join(hubB, 'records', 'classdesk')).sort().map(f => f + fs.statSync(path.join(hubB, 'records', 'classdesk', f)).mtimeMs).join();
  const before = snap();
  await sleep(20); use(B); await B.suiteReconcile();
  check('no echo: B record files untouched by a new reconcile', snap() === before);
  // A deletes a course and a student
  use(A); A.state.courses = A.state.courses.filter(c => c.id !== 'crs-2'); A.state.studentsDirectory = A.state.studentsDirectory.filter(s => s.id !== 'st-1');
  await A.suiteExport();
  const tomb = ['course%3Acrs-2.json', 'student%3Ast-1.json'].map(f => JSON.parse(fs.readFileSync(path.join(hubA, 'records', 'classdesk', f), 'utf8')));
  check('tombstones written on A', tomb.every(r => r.deleted === true && r.value === null));
  fs.cpSync(path.join(hubA, 'records', 'classdesk'), path.join(hubB, 'records', 'classdesk'), { recursive: true });
  use(B); await B.suiteReconcile();
  console.log('B after tombstones: courses', B.state.courses.map(c => c.name), 'students', B.state.studentsDirectory.map(s => s.firstName), 'backups', B.backups.length);
  check('deletion propagated to B', B.state.courses.length === 1 && B.state.studentsDirectory.length === 1 && B.backups.length === 1);
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
