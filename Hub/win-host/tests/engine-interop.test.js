// The native HubDesk engine (page/hub-engine.js) against the Electron one (electron/net/hub-net.js), on localhost:
// the native bridges (__hd_fs_*, __hd_tcp_*, __hd_mdns_*) are simulated with node's fs and net. Run: node --test Hub/win-host/tests
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const HERE = path.join(__dirname, '..');
const ELECTRON = path.join(HERE, '..', 'electron');
const { createEngine: createElectronEngine } = require(path.join(ELECTRON, 'net', 'hub-net.js'));

function loadNativeEngine() {
  const mods = { './sync-core': require(path.join(ELECTRON, 'net', 'sync-core.js')), './describe': require(path.join(ELECTRON, 'net', 'describe.js')), crypto: require('crypto') };
  const module = { exports: {} };
  new Function('module', 'exports', 'require', 'window', fs.readFileSync(path.join(HERE, 'page', 'hub-engine.js'), 'utf8'))(module, module.exports, (n) => mods[n], global.window);
  return module.exports;
}

function fakeBridges(dir) {
  const P = (rel) => path.join(dir, ...rel.split('/'));
  const socks = new Map(); let seq = 0;
  const w = {};
  const ev = (e) => setImmediate(() => w.__hd_tcp_on && w.__hd_tcp_on(e));
  const track = (s) => { const id = ++seq; socks.set(id, s); s.setEncoding('utf8'); s.on('data', (t) => ev({ ev: 'data', id, text: t })); s.on('close', () => { socks.delete(id); ev({ ev: 'close', id }); }); s.on('error', () => {}); return id; };
  Object.assign(w, {
    __hd_fs_list: async (rel) => { try { return fs.readdirSync(P(rel), { withFileTypes: true }).map((d) => { const st = fs.statSync(path.join(P(rel), d.name)); return { n: d.name, s: st.size, m: String(st.mtimeMs), d: d.isDirectory() }; }); } catch { return []; } },
    __hd_fs_read: async (rel) => { try { return fs.readFileSync(P(rel), 'utf8'); } catch { return null; } },
    __hd_fs_write: async (rel, t) => { fs.mkdirSync(path.dirname(P(rel)), { recursive: true }); fs.writeFileSync(P(rel), t); return true; },
    __hd_fs_rm: async (rel) => { try { fs.rmSync(P(rel)); } catch {} return true; },
    __hd_tcp_listen: async (port, local) => new Promise((res) => {
      const srv = net.createServer((s) => { const id = track(s); ev({ ev: 'conn', id, server: sid, addr: s.remoteAddress }); });
      const sid = ++seq; socks.set(sid, srv);
      srv.listen(Number(port) || 0, local === '1' ? '127.0.0.1' : '127.0.0.1', () => res({ id: sid, port: srv.address().port }));
    }),
    __hd_tcp_connect: async (host, port) => new Promise((res) => { const s = net.connect(Number(port), host); s.once('connect', () => res(track(s))); s.once('error', () => res(-1)); }),
    __hd_tcp_send: async (id, t) => { const s = socks.get(Number(id)); if (s && s.write) s.write(t); return true; },
    __hd_tcp_close: async (id) => { const s = socks.get(Number(id)); if (s) { s.destroy ? s.destroy() : s.close(); socks.delete(Number(id)); } return true; },
    __hd_mdns_register: async () => true, __hd_mdns_unregister: async () => true, __hd_mdns_browse: async () => true,
    _closeAll: () => { for (const s of socks.values()) { try { s.destroy ? s.destroy() : s.close(); } catch {} } },
  });
  return w;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(f, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await wait(100); } return false; }
const rec = (app, key, value, device) => ({ key, app, updatedAt: new Date().toISOString(), device, deleted: false, value });
function put(dir, app, key, value, device) {
  const enc = (k) => [...Buffer.from(k)].map((b) => (/[A-Za-z0-9._-]/.test(String.fromCharCode(b)) ? String.fromCharCode(b) : '%' + b.toString(16).toUpperCase().padStart(2, '0'))).join('') + '.json';
  const f = path.join(dir, 'records', app, enc(key)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(rec(app, key, value, device)));
}

test('native engine ↔ Electron engine: hello with the code, records both ways, board relay, local app channel', async () => {
  const dirW = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-win-')), dirM = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-el-'));
  fs.writeFileSync(path.join(dirW, 'settings.json'), JSON.stringify({ deviceId: 'b-win', deviceName: 'Surface', syncCode: 'prova-123', syncEnabled: true }));
  fs.writeFileSync(path.join(dirM, 'settings.json'), JSON.stringify({ deviceId: 'a-mac', deviceName: 'Mac', syncCode: 'prova-123', syncEnabled: true }));
  put(dirW, 'studydesk', 'group:g-win', { name: 'Gruppo del Surface' }, 'b-win');
  put(dirM, 'classdesk', 'course:c-mac', { name: 'Corso del Mac' }, 'a-mac');
  global.window = fakeBridges(dirW);
  const { createEngine } = loadNativeEngine();
  const win = await createEngine({ version: '26.11.0-005', pingMs: 60000 });
  await win.start();
  const mac = createElectronEngine({ dir: dirM, bonjour: false, version: '26.11.0-005', pingMs: 60000 });
  await mac.start();
  try {
    // the lower deviceId connects ('a-mac' < 'b-win'): the Electron engine dials the native one
    await mac.connectTo('127.0.0.1', win.getState().port);
    assert.ok(await until(() => win.getState().peers.some((p) => p.deviceId === 'a-mac' && p.connected)), 'native engine sees the Mac connected');
    assert.ok(await until(() => fs.existsSync(path.join(dirM, 'records', 'studydesk', 'group%3Ag-win.json'))), 'Surface record reached the Mac');
    assert.ok(await until(() => fs.existsSync(path.join(dirW, 'records', 'classdesk', 'course%3Ac-mac.json'))), 'Mac record reached the Surface');
    // a change on the native side travels after the poll
    put(dirW, 'studydesk', 'group:g-win', { name: 'Gruppo rinominato' }, 'b-win');
    assert.ok(await until(() => JSON.parse(fs.readFileSync(path.join(dirM, 'records', 'studydesk', 'group%3Ag-win.json'), 'utf8')).value.name === 'Gruppo rinominato'), 'later change synced');
    // local channel: an app on the Surface connects with runtime.json and its board message reaches the Mac engine
    const rt = JSON.parse(fs.readFileSync(path.join(dirW, 'runtime.json'), 'utf8'));
    assert.ok(rt.port > 0 && rt.token.length === 32 && rt.heartbeat, 'runtime.json for the apps');
    const boards = []; mac.on('board', (b) => boards.push(b));
    const app = net.connect(rt.port, '127.0.0.1'); app.setEncoding('utf8');
    let got = ''; app.on('data', (d) => { got += d; });
    await new Promise((r) => app.once('connect', r));
    app.write(JSON.stringify({ t: 'hello', app: 'studydesk', token: rt.token }) + '\n');
    assert.ok(await until(() => got.includes('"ok":true')), 'app accepted on the local channel');
    app.write(JSON.stringify({ t: 'board', msg: { t: 'clear' } }) + '\n');
    assert.ok(await until(() => boards.some((b) => b.from === 'b-win' && b.msg.t === 'clear')), 'board message relayed to the other device');
    app.destroy();
  } finally {
    await mac.stop(); await win.stop(); window._closeAll();
    fs.rmSync(dirW, { recursive: true, force: true }); fs.rmSync(dirM, { recursive: true, force: true });
  }
});
