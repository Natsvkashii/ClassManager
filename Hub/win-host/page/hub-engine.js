// =====================================================================================
// HubDesk for Windows, native: the network engine in the page. Port of Hub/electron/net/hub-net.js (same protocol PROTO 2,
// same files in DeskHub, same rules), asynchronous because files and sockets go through the native host:
//   files   window.__hd_fs_list / __hd_fs_read / __hd_fs_write / __hd_fs_rm   (paths relative to %APPDATA%\DeskHub)
//   TCP     window.__hd_tcp_listen / __hd_tcp_connect / __hd_tcp_send / __hd_tcp_close + events window.__hd_tcp_on
//   mDNS    window.__hd_mdns_register / __hd_mdns_unregister / __hd_mdns_browse  (+ events 'found' / 'lost')
// Conceived and created by Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com) – GPL-3.0
// =====================================================================================
// Loaded as a CommonJS module by page/hubdesk-native.js (bundled by build.py): require('./sync-core'), require('./describe')
// and require('crypto') (shim with a synchronous SHA-256) resolve to the bundled Hub/electron/net files.
const { secretFor, plan, mergeBase, sha256 } = require('./sync-core');
const { describeKey, summarize, splitKey } = require('./describe');
const crypto = require('crypto');

const SERVICE = 'deskhub';
const PROTO = 2;
const MAX_LINE = 128 * 1024 * 1024;
const BATCH = 100;
// big records (StudyDesk book pieces, ~1.4 MB each) go a few at a time so no message nears MAX_LINE
const BIG_KEY = /\/book(chunk|file):/;
const BIG_BATCH = 4;   // ~6 MB per reply: under the 8 MB line of HubDesk 012's native reader too
const PUT_BYTES = 12 * 1024 * 1024;
/** Keys in request groups: small records BATCH at a time, big ones BIG_BATCH at a time. */
function keyBatches(keys) {
  const out = [], small = keys.filter((k) => !BIG_KEY.test(k)), big = keys.filter((k) => BIG_KEY.test(k));
  for (let i = 0; i < small.length; i += BATCH) out.push(small.slice(i, i + BATCH));
  for (let i = 0; i < big.length; i += BIG_BATCH) out.push(big.slice(i, i + BIG_BATCH));
  return out;
}
const APP_RE = /^[A-Za-z0-9._-]{1,64}$/;

// StudyDesk book transfer records (bookfile: / bookchunk:) are copies any device may publish:
// two of them differing is not a conflict for the user. The copy with the higher rev wins, then the newer one.
const isTransferKey = (k) => BIG_KEY.test(k);
function transferWins(remoteRec, localRec) {
  const rv = remoteRec?.value?.rev || 0, lv = localRec?.value?.rev || 0;
  if (rv !== lv) return rv > lv;
  return String(remoteRec?.updatedAt || '') > String(localRec?.updatedAt || '');
}
const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- record helpers (Hub/js/deskhub-records.js)
function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = canonicalize(v[k]); return o; }
  return v;
}
function hashOf(deleted, value) { const o = { deleted: !!deleted }; if (value !== null && value !== undefined) o.value = value; return sha256(JSON.stringify(canonicalize(o))); }
const hashRecord = (r) => hashOf(r && r.deleted, r && r.value);
function encodeKey(key) {
  let out = '';
  for (const b of new TextEncoder().encode(String(key))) {
    const ok = (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x2e || b === 0x5f || b === 0x2d;
    out += ok ? String.fromCharCode(b) : '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out + '.json';
}

// ---------------------------------------------------------------- native file access (async)
const fsx = {
  list: async (rel) => (await window.__hd_fs_list(rel)) || [],
  dirs: async (rel) => ((await window.__hd_fs_list(rel)) || []).filter((f) => f.d).map((f) => f.n),
  async readJSON(rel) { const t = await window.__hd_fs_read(rel); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } },
  writeJSON: (rel, v) => window.__hd_fs_write(rel, JSON.stringify(v, null, 2)),
  rm: (rel) => window.__hd_fs_rm(rel),
};

// ---------------------------------------------------------------- sockets (one dispatcher for every native socket)
const sockets = new Map(); // id -> {onData, onClose} or server id -> {onConn}
const earlyEvents = new Map(); // id -> Array<e> for events arriving before Sock(id) is registered
const prevTcp = window.__hd_tcp_on;
const mdnsHandlers = new Set();
window.__hd_tcp_on = (e) => {
  if (e.ev === 'found' || e.ev === 'lost') { mdnsHandlers.forEach((f) => f(e)); return; }
  if (e.ev === 'conn') { const srv = sockets.get(e.server); if (srv && srv.onConn) srv.onConn(e.id, e.addr); return; }
  const s = sockets.get(e.id);
  if (!s) {
    if (e.ev === 'data' || e.ev === 'close') {
      const q = earlyEvents.get(e.id) || [];
      q.push(e);
      earlyEvents.set(e.id, q);
    }
    return;
  }
  if (e.ev === 'data' && s.onData) s.onData(e.text);
  else if (e.ev === 'close') { sockets.delete(e.id); if (s.onClose) s.onClose(); }
  if (prevTcp) prevTcp(e);
};
/** A native socket with the small part of node's net.Socket the engine needs. */
function Sock(id, remoteAddress = '') {
  const s = { id, remoteAddress, closed: false, _data: [], _close: [] };
  sockets.set(id, { onData: (t) => s._data.forEach((f) => f(t)), onClose: () => { s.closed = true; s._close.forEach((f) => f()); } });
  const flushEarly = () => {
    const q = earlyEvents.get(id);
    if (!q || !s._data.length) return;
    earlyEvents.delete(id);
    for (const e of q) window.__hd_tcp_on(e);
  };
  s.on = (ev, f) => { if (ev === 'data') { s._data.push(f); flushEarly(); } else if (ev === 'close') s._close.push(f); return s; };
  s.write = (text) => { if (!s.closed) window.__hd_tcp_send(String(id), text); };
  s.destroy = () => { if (s.closed) return; s.closed = true; earlyEvents.delete(id); window.__hd_tcp_close(String(id)); const h = sockets.get(id); sockets.delete(id); if (h) h.onClose(); };
  return s;
}

class Emitter {
  constructor() { this._l = {}; }
  on(e, f) { (this._l[e] = this._l[e] || []).push(f); return this; }
  emit(e, ...a) { (this._l[e] || []).slice().forEach((f) => { try { f(...a); } catch (x) { console.error(x); } }); return true; }
}

/** One TCP connection: line JSON, request/response by id/re, ping every 15 s (3 unanswered = dead). */
class Conn extends Emitter {
  constructor(sock, { onRequest, pingMs = 15000 } = {}) {
    super();
    this.sock = sock; this.onRequest = onRequest; this.nextId = 1; this.pending = new Map(); this.closed = false; this.missed = 0; this.buf = '';
    sock.on('data', (d) => {
      this.missed = 0; this.buf += d;
      if (this.buf.length > MAX_LINE) return this.close();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1);
        if (!line.trim()) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m && typeof m === 'object') this._incoming(m);
      }
    });
    sock.on('close', () => this._end());
    this.pingTimer = setInterval(async () => { try { await this.request({ t: 'ping' }, pingMs); this.missed = 0; } catch { if (++this.missed >= 3) this.close(); } }, pingMs);
  }
  _incoming(m) {
    if (m.re !== undefined) {
      const p = this.pending.get(m.re); if (!p) return;
      this.pending.delete(m.re); clearTimeout(p.timer);
      if (m.t === 'error') p.reject(new Error(m.message || 'errore')); else p.resolve(m);
    } else if (m.id !== undefined) {
      Promise.resolve().then(() => this.onRequest(m, this)).then(
        (reply) => { if (reply) this.send({ ...reply, re: m.id }); },
        (e) => this.send({ t: 'error', re: m.id, message: String((e && e.message) || e) }));
    } else this.emit('event', m);
  }
  send(m) { if (!this.closed) this.sock.write(JSON.stringify(m) + '\n'); }
  request(m, ms = 60000) {
    if (this.closed) return Promise.reject(new Error('Connessione chiusa'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Tempo scaduto')); }, ms);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ ...m, id });
    });
  }
  _end() {
    if (this.closed && !this.pingTimer) return;
    this.closed = true; clearInterval(this.pingTimer); this.pingTimer = null;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Connessione chiusa')); }
    this.pending.clear();
    this.emit('close');
  }
  close() { this.closed = true; this.sock.destroy(); this._end(); }
}

async function createEngine(opts = {}) {
  const platform = 'windows';
  const version = opts.version || '26.11.0-001';
  const heartbeatMs = opts.heartbeatMs || 5000, pingMs = opts.pingMs || 15000, reconnectMs = opts.reconnectMs || 10000, periodicMs = opts.periodicSyncMs || 60000;
  const ev = new Emitter();

  const defaults = { syncEnabled: true, channel: 'unstable', autoBoard: true, syncCode: '' };
  let cfg = { ...defaults, ...((await fsx.readJSON('settings.json')) || {}) };
  if (!cfg.deviceId) cfg.deviceId = crypto.randomUUID();
  if (!cfg.deviceName) cfg.deviceName = opts.deviceName || 'Windows';
  const saveCfg = async (patch) => { cfg = { ...defaults, ...((await fsx.readJSON('settings.json')) || {}), ...cfg, ...patch }; await fsx.writeJSON('settings.json', cfg); };
  await saveCfg({});

  const logLines = [];
  function log(msg) { const line = { at: nowIso(), msg }; logLines.push(line); if (logLines.length > 300) logLines.shift(); ev.emit('log', line); }

  // ---------------------------------------------------------------- peers + connections
  const peers = new Map(), conns = new Map(), connecting = new Set(), seen = new Map(), syncState = new Map();
  for (const p of ((await fsx.readJSON('peers.json')) || {}).peers || []) if (p.deviceId) peers.set(p.deviceId, { ...p, connected: undefined });
  let conflicts = (await fsx.readJSON('conflicts.json')) || [];
  if (!Array.isArray(conflicts)) conflicts = [];
  conflicts = conflicts.filter((c) => !isTransferKey(c.key || ''));   // settled automatically now
  const peerView = (p) => ({ deviceId: p.deviceId, name: p.name, platform: p.platform || '', version: p.version || '', host: p.host || '', port: p.port || 0,
    connected: conns.has(p.deviceId), lastSeen: p.lastSeen || '', lastSync: p.lastSync || '' });
  const peerList = () => [...peers.values()].map(peerView);
  let peersTimer = null;
  function persistPeers() { clearTimeout(peersTimer); peersTimer = setTimeout(() => { fsx.writeJSON('peers.json', { updatedAt: nowIso(), self: { deviceId: cfg.deviceId, deviceName: cfg.deviceName }, peers: peerList() }).catch(() => {}); }, 50); }
  function peersChanged() { persistPeers(); toClients({ t: 'peers', peers: peerList() }); ev.emit('state', getState()); }
  const saveConflicts = () => { fsx.writeJSON('conflicts.json', conflicts).catch(() => {}); ev.emit('state', getState()); };

  // ---------------------------------------------------------------- local records
  const scanCache = new Map();
  let known = null;
  async function scan() {
    const out = {}, seenFiles = new Set();
    for (const app of (await fsx.dirs('records')).filter((a) => APP_RE.test(a))) {
      for (const f of await fsx.list(`records/${app}`)) {
        if (f.d || !f.n.endsWith('.json')) continue;
        const file = `records/${app}/${f.n}`;
        seenFiles.add(file);
        let c = scanCache.get(file);
        if (!c || c.m !== f.m || c.s !== f.s) {
          const r = await fsx.readJSON(file);
          c = { m: f.m, s: f.s, key: r && r.key ? `${app}/${r.key}` : null, hash: r && r.key ? hashRecord(r) : null };
          scanCache.set(file, c);
        }
        if (c.key) out[c.key] = c.hash;
      }
    }
    for (const f of [...scanCache.keys()]) if (!seenFiles.has(f)) scanCache.delete(f);
    return out;
  }
  async function getRecord(gkey) {
    const [app, key] = splitKey(gkey);
    if (!APP_RE.test(app)) return null;
    return fsx.readJSON(`records/${app}/${encodeKey(key)}`);
  }
  async function storeRecord(gkey, rec) {
    const [app, key] = splitKey(gkey);
    if (!APP_RE.test(app) || !rec || rec.key !== key || typeof rec !== 'object') throw new Error('record non valido: ' + gkey);
    await fsx.writeJSON(`records/${app}/${encodeKey(key)}`, { ...rec, app });
    if (known) known[gkey] = hashRecord(rec);
  }
  const baseFile = (id) => `base/${String(id).replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
  const readBase = async (id) => (await fsx.readJSON(baseFile(id))) || {};
  const writeBase = (id, b) => fsx.writeJSON(baseFile(id), b);

  // ---------------------------------------------------------------- protocol
  function notifyApps(gkeys) {
    const byApp = {};
    for (const g of gkeys) { const [a, k] = splitKey(g); (byApp[a] = byApp[a] || []).push(k); }
    for (const [app, keys] of Object.entries(byApp)) { toClients({ t: 'records', app, keys }); ev.emit('records', app, keys); }
  }
  async function handleRequest(m, conn) {
    const peer = conn.peer;
    switch (m.t) {
      case 'hello': {
        if (!cfg.syncCode || !cfg.syncEnabled || m.secret !== secretFor(cfg.syncCode || '')) { setTimeout(() => conn.close(), 100); return { t: 'error', message: 'codice errato' }; }
        if (!m.device || m.device === cfg.deviceId) { setTimeout(() => conn.close(), 100); return { t: 'error', message: 'dispositivo non valido' }; }
        if (!(m.proto >= 2)) { setTimeout(() => conn.close(), 100); return { t: 'error', message: 'protocollo non supportato' }; }
        conn.peer = { deviceId: String(m.device), name: String(m.name || m.device), platform: m.platform || '', version: m.version || '' };
        if (!conn._eventHooked) { conn._eventHooked = true; conn.on('event', (ev) => onEvent(conn, ev)); }
        setTimeout(() => adopt(conn, false), 0);
        return { t: 'hello', device: cfg.deviceId, name: cfg.deviceName, platform, proto: PROTO, version };
      }
      case 'ping': return { t: 'pong' };
      default: break;
    }
    if (!peer) { conn.close(); throw new Error('non autenticato'); }
    switch (m.t) {
      case 'manifest': return { t: 'manifest', records: await scan() };
      case 'get': { const out = {}; for (const k of m.keys || []) { const r = await getRecord(String(k)); if (r) out[k] = r; } return { t: 'records', records: out }; }
      case 'put': {
        const keys = [];
        for (const [k, r] of Object.entries(m.records || {})) { await storeRecord(k, r); keys.push(k); }
        if (keys.length) {
          log(`Ricevuti ${keys.length} record da «${peer.name}»`);
          notifyApps(keys);
          setTimeout(() => { for (const id of conns.keys()) if (id !== peer.deviceId) { sendEvent(id, { t: 'changed', keys }); syncPeer(id).catch(() => {}); } }, 0);
        }
        return { t: 'ok' };
      }
      case 'base': await writeBase(peer.deviceId, mergeBase(await readBase(peer.deviceId), m.hashes || {})); return { t: 'ok' };
      default: throw new Error('messaggio sconosciuto: ' + m.t);
    }
  }
  function onEvent(conn, m) {
    const peer = conn.peer; if (!peer) return;
    if (m.t === 'changed') syncPeer(peer.deviceId).catch(() => {});
    else if (m.t === 'board') {
      if (cfg.autoBoard !== false) toClients({ t: 'board', from: m.from || peer.deviceId, fromName: m.fromName || peer.name, msg: m.msg });
      ev.emit('board', { from: m.from || peer.deviceId, fromName: m.fromName || peer.name, msg: m.msg });
    }
  }
  const sendEvent = (id, m) => { const c = conns.get(id); if (c) c.send(m); };
  function adopt(conn, outgoing) {
    const info = conn.peer; if (!info || conn.closed) return;
    const old = conns.get(info.deviceId);
    if (old && old !== conn) { old.peer = null; old.close(); }
    conns.set(info.deviceId, conn);
    const rec = peers.get(info.deviceId) || {};
    const addr = String(conn.sock.remoteAddress || '').replace(/^::ffff:/, '');
    peers.set(info.deviceId, { ...rec, ...info, host: outgoing ? conn.target.host : (rec.host || addr), port: outgoing ? conn.target.port : (rec.port || 0), lastSeen: nowIso() });
    if (!conn._eventHooked) { conn._eventHooked = true; conn.on('event', (m) => onEvent(conn, m)); }
    conn.on('close', () => { if (conns.get(info.deviceId) === conn) { conns.delete(info.deviceId); log(`«${info.name}» scollegato`); peersChanged(); } });
    log(`«${info.name}» collegato (${outgoing ? 'in uscita' : 'in ingresso'})`);
    toClients({ t: 'peer-joined', device: info.deviceId, name: info.name });
    peersChanged();
    syncPeer(info.deviceId).catch(() => {});
  }

  // ---------------------------------------------------------------- sync (same plan as Electron and the Mac)
  function syncPeer(id) {
    const st = syncState.get(id) || { running: null, queued: false };
    syncState.set(id, st);
    if (st.running) { st.queued = true; return st.running; }
    st.running = (async () => {
      try { return await doSync(id); }
      finally { const again = st.queued; st.running = null; st.queued = false; if (again && conns.has(id)) syncPeer(id).catch(() => {}); }
    })();
    return st.running;
  }
  async function doSync(id) {
    const conn = conns.get(id), peer = peers.get(id);
    if (!conn || !peer) throw new Error('Dispositivo non collegato');
    try {
      const local = await scan();
      const remote = (await conn.request({ t: 'manifest' })).records || {};
      const base = await readBase(id);
      const p = plan(local, remote, base);
      const agreed = { ...p.agreed };
      const toPull = [...p.pull, ...p.delRemote], toPush = [...p.push, ...p.delLocal];
      for (const k of p.delRemote) agreed[k] = remote[k];
      for (const k of p.delLocal) agreed[k] = local[k];
      for (const k of p.conflict) delete agreed[k];
      const fetched = {}, wantKeys = [...toPull, ...p.conflict];
      for (const keys of keyBatches(wantKeys)) Object.assign(fetched, (await conn.request({ t: 'get', keys })).records || {});
      // StudyDesk book transfers are copies, not edits: settle them without asking (higher rev, then newer).
      const userConflicts = [];
      for (const k of p.conflict) {
        if (!isTransferKey(k)) { userConflicts.push(k); continue; }
        const l = await getRecord(k), r = fetched[k];
        if (!l || !r) continue;
        if (transferWins(r, l)) { toPull.push(k); agreed[k] = remote[k]; } else { toPush.push(k); agreed[k] = local[k]; }
      }
      const pulled = [];
      for (const k of toPull) { if (!fetched[k]) { delete agreed[k]; continue; } await storeRecord(k, fetched[k]); pulled.push(k); }
      let recs = {}, n = 0, bytes = 0;
      const flush = async () => { if (n) await conn.request({ t: 'put', records: recs }); recs = {}; n = 0; bytes = 0; };
      for (const k of toPush) {
        const r = await getRecord(k);
        if (!r) { delete agreed[k]; continue; }
        recs[k] = r; n++; bytes += JSON.stringify(r).length;
        if (n >= BATCH || bytes >= PUT_BYTES) await flush();
      }
      await flush();
      if (Object.keys(agreed).length) await conn.request({ t: 'base', hashes: agreed });
      await writeBase(id, mergeBase(base, agreed));
      const fresh = []; let isNew = 0;
      for (const k of userConflicts) {
        const c = { key: k, peer: id, peerName: peer.name, local: await getRecord(k), remote: fetched[k] || null, at: nowIso() };
        const prev = conflicts.find((x) => x.key === k && x.peer === id);
        if (prev && prev.local && prev.remote && c.local && c.remote && hashRecord(prev.local) === hashRecord(c.local) && hashRecord(prev.remote) === hashRecord(c.remote)) fresh.push(prev);
        else { fresh.push(c); isNew++; }
      }
      const before = JSON.stringify(conflicts);
      conflicts = [...conflicts.filter((x) => x.peer !== id), ...fresh];
      if (JSON.stringify(conflicts) !== before) saveConflicts();
      if (isNew) log(`${isNew} conflitti con «${peer.name}»`);
      peer.lastSync = nowIso();
      if (pulled.length) notifyApps(pulled);
      const result = { peer: id, pulled: pulled.length, pushed: toPush.length, conflicts: userConflicts.length };
      if (pulled.length || toPush.length || p.conflict.length) log(`Sincronizzato con «${peer.name}»: ricevuti ${result.pulled}, inviati ${result.pushed}${result.conflicts ? `, conflitti ${result.conflicts}` : ''}`);
      persistPeers(); ev.emit('state', getState());
      return result;
    } catch (e) { log(`Sincronizzazione con «${peer.name}» non riuscita: ${e.message}`); throw e; }
  }

  // ---------------------------------------------------------------- local changes (polled: no file watcher through the bridge)
  let pollTimer = null, announcing = false;
  async function announceLocalChanges() {
    if (announcing) return; announcing = true;
    try {
      const now = await scan();
      if (!known) { known = now; return; }
      const changed = [];
      for (const [k, h] of Object.entries(now)) if (known[k] !== h) changed.push(k);
      for (const k of Object.keys(known)) if (!(k in now)) changed.push(k);
      known = now;
      if (!changed.length) return;
      for (const id of conns.keys()) { sendEvent(id, { t: 'changed', keys: changed }); syncPeer(id).catch(() => {}); }
    } finally { announcing = false; }
  }

  // ---------------------------------------------------------------- network (server + mDNS + connector)
  let server = null, netPort = 0, timers = [], mdnsOff = null;
  async function startNetwork() {
    if (server || !cfg.syncEnabled || !cfg.syncCode) return;
    const r = await window.__hd_tcp_listen(String(opts.listenPort || 0), '0');
    if (!r) { log('Rete: impossibile aprire la porta'); return; }
    server = r.id; netPort = r.port;
    sockets.set(server, { onConn: (id, addr) => {
      const conn = new Conn(Sock(id, addr), { onRequest: handleRequest, pingMs });
      const t = setTimeout(() => { if (!conn.peer) conn.close(); }, 15000);
      conn.on('close', () => clearTimeout(t));
    } });
    await window.__hd_mdns_register(cfg.deviceName, String(netPort), cfg.deviceId, version, platform);
    const onMdns = (s) => {
      if (s.ev !== 'found') return;
      const t = s.txt || {};
      if (!t.id || t.id === cfg.deviceId) return;
      const host = s.addr || s.host;
      seen.set(t.id, { deviceId: t.id, name: String(s.name || '').split('._' + SERVICE)[0], platform: t.p || '', version: t.v || '', host, port: s.port });
      const rec = peers.get(t.id);
      if (rec) { peers.set(t.id, { ...rec, platform: t.p || rec.platform, version: t.v || rec.version, host, port: s.port, lastSeen: nowIso() }); peersChanged(); }
      maybeConnect(t.id);
    };
    mdnsHandlers.add(onMdns); mdnsOff = () => mdnsHandlers.delete(onMdns);
    await window.__hd_mdns_browse();
    timers.push(setInterval(() => window.__hd_mdns_browse().catch(() => {}), 60000));
    timers.push(setInterval(() => { for (const id of new Set([...peers.keys(), ...seen.keys()])) maybeConnect(id); }, reconnectMs));
    timers.push(setInterval(() => { for (const id of conns.keys()) syncPeer(id).catch(() => {}); }, periodicMs));
    log(`Rete attiva come «${cfg.deviceName}» (porta ${netPort})`);
    ev.emit('state', getState());
  }
  async function stopNetwork() {
    timers.forEach(clearInterval); timers = [];
    for (const c of [...conns.values()]) c.close();
    conns.clear();
    if (mdnsOff) { mdnsOff(); mdnsOff = null; }
    await window.__hd_mdns_unregister().catch(() => {});
    if (server) { window.__hd_tcp_close(String(server)); sockets.delete(server); server = null; }
    netPort = 0;
    ev.emit('state', getState());
  }
  /** Only the lower deviceId connects (§3.1). */
  function maybeConnect(id) {
    const p = seen.get(id) || peers.get(id);
    if (!p || !p.host || !p.port || conns.has(id) || connecting.has(id) || !server) return;
    if (!(cfg.deviceId < id)) return;
    connectTo(p.host, p.port).catch(() => {});
  }
  async function connectTo(host, port) {
    const key = `${host}:${port}`;
    connecting.add(key);
    try {
      const id = await window.__hd_tcp_connect(String(host), String(port));
      if (id < 0) throw new Error('Dispositivo non raggiungibile');
      const conn = new Conn(Sock(id, host), { onRequest: handleRequest, pingMs });
      conn.target = { host, port };
      try {
        const r = await conn.request({ t: 'hello', device: cfg.deviceId, name: cfg.deviceName, platform, secret: secretFor(cfg.syncCode || ''), proto: PROTO, version }, 10000);
        conn.peer = { deviceId: String(r.device), name: String(r.name || r.device), platform: r.platform || '', version: r.version || '' };
        adopt(conn, true);
        return conn.peer;
      } catch (e) { conn.close(); throw e; }
    } finally { connecting.delete(key); }
  }

  // ---------------------------------------------------------------- local channel for ClassDesk / StudyDesk (§4)
  const clients = new Set();
  let localServer = null, localPort = 0, token = '', hbTimer = null;
  const toClients = (m, except) => { const line = JSON.stringify(m) + '\n'; for (const c of clients) if (c.ok && c !== except) c.sock.write(line); };
  const selfInfo = () => ({ deviceId: cfg.deviceId, deviceName: cfg.deviceName, version, platform });
  const writeRuntime = () => fsx.writeJSON('runtime.json', { port: localPort, token, pid: 0, heartbeat: nowIso(), version }).catch(() => {});
  async function startLocal() {
    token = crypto.randomBytes(16).toString('hex');
    const r = await window.__hd_tcp_listen('0', '1');
    if (!r) { log('Canale locale non disponibile'); return; }
    localServer = r.id; localPort = r.port;
    sockets.set(localServer, { onConn: (id) => {
      const c = { sock: Sock(id), ok: false, app: '' }; let buf = '';
      c.sock.on('close', () => { clients.delete(c); ev.emit('state', getState()); });
      c.sock.on('data', (d) => {
        buf += d; let i;
        while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; } onClient(c, m); }
      });
      setTimeout(() => { if (!c.ok) c.sock.destroy(); }, 10000);
    } });
    await writeRuntime();
    hbTimer = setInterval(writeRuntime, heartbeatMs);
  }
  function onClient(c, m) {
    if (!c.ok) {
      if (m.t === 'hello' && m.token === token) {
        c.ok = true; c.app = String(m.app || '');
        c.sock.write(JSON.stringify({ t: 'hello', ok: true, self: selfInfo(), peers: peerList() }) + '\n');
        clients.add(c); ev.emit('state', getState());
      } else { c.sock.write(JSON.stringify({ t: 'hello', ok: false }) + '\n'); c.sock.destroy(); }
      return;
    }
    if (m.t === 'board') {
      if (cfg.autoBoard === false) return;
      for (const id of conns.keys()) sendEvent(id, { t: 'board', from: cfg.deviceId, fromName: cfg.deviceName, msg: m.msg });
      toClients({ t: 'board', from: cfg.deviceId, fromName: cfg.deviceName, msg: m.msg }, c); // other apps on this computer
    } else if (m.t === 'changed') { announceLocalChanges(); for (const id of conns.keys()) syncPeer(id).catch(() => {}); }
    else if (m.t === 'open') ev.emit('open', String(m.app || ''));
  }
  async function stopLocal() {
    clearInterval(hbTimer);
    for (const c of clients) c.sock.destroy();
    clients.clear();
    if (localServer) { window.__hd_tcp_close(String(localServer)); sockets.delete(localServer); localServer = null; }
    await fsx.rm('runtime.json').catch(() => {});
  }

  // ---------------------------------------------------------------- conflicts
  function deviceName(id) { if (id === cfg.deviceId) return cfg.deviceName; const p = peers.get(id); return p ? p.name : id || ''; }
  function describeConflict(c) {
    const d = describeKey(c.key, c.local, c.remote);
    const side = (r, name) => ({ ...summarize(r), updatedAt: r ? r.updatedAt || '' : '', device: r ? deviceName(r.device) : '', deviceLabel: name });
    return { key: c.key, peer: c.peer, peerName: c.peerName, at: c.at, title: d.title, kind: d.kind, appName: d.appName, local: side(c.local, cfg.deviceName), remote: side(c.remote, c.peerName) };
  }
  async function resolveConflict(key, peerId, keepLocal) {
    const i = conflicts.findIndex((x) => x.key === key && x.peer === peerId);
    if (i < 0) return false;
    const c = conflicts[i];
    const winner = keepLocal ? await getRecord(key) : c.remote;
    if (!winner) throw new Error(keepLocal ? 'Il record locale non esiste più' : 'Il record dell’altro dispositivo non è disponibile');
    const conn = conns.get(peerId);
    if (keepLocal) {
      if (!conn) throw new Error('Il dispositivo non è collegato: riprova quando è in linea');
      await conn.request({ t: 'put', records: { [key]: winner } });
      await conn.request({ t: 'base', hashes: { [key]: hashRecord(winner) } });
    } else {
      await storeRecord(key, winner); notifyApps([key]);
      if (conn) { try { await conn.request({ t: 'base', hashes: { [key]: hashRecord(winner) } }); } catch {} }
    }
    await writeBase(peerId, mergeBase(await readBase(peerId), { [key]: hashRecord(winner) }));
    conflicts.splice(conflicts.indexOf(c), 1);
    saveConflicts();
    log(`Conflitto risolto (${keepLocal ? 'tenuto questo dispositivo' : 'tenuto l’altro'}): ${key}`);
    for (const id of conns.keys()) { sendEvent(id, { t: 'changed', keys: [key] }); syncPeer(id).catch(() => {}); }
    announceLocalChanges();
    return true;
  }
  async function resolveAll(keepLocal) {
    let n = 0; const errors = [];
    for (const c of [...conflicts]) { try { if (await resolveConflict(c.key, c.peer, keepLocal)) n++; } catch (e) { errors.push(e.message); } }
    return { resolved: n, errors };
  }

  // ---------------------------------------------------------------- public API (same as hub-net.js)
  function getState() {
    return {
      self: { deviceId: cfg.deviceId, deviceName: cfg.deviceName, version, platform },
      settings: { syncCode: cfg.syncCode || '', syncEnabled: cfg.syncEnabled !== false, channel: cfg.channel, autoBoard: cfg.autoBoard !== false, deviceName: cfg.deviceName },
      running: !!server, port: netPort, localPort, clients: [...clients].map((c) => c.app),
      peers: peerList(), conflicts: conflicts.map(describeConflict), log: logLines.slice(-100),
    };
  }
  async function updateSettings(patch) {
    const netChanged = ['syncCode', 'syncEnabled', 'deviceName'].some((k) => k in patch && patch[k] !== cfg[k]);
    await saveCfg(patch);
    if (netChanged && (server || cfg.syncEnabled)) { await stopNetwork(); await startNetwork(); }
    ev.emit('state', getState());
    return getState();
  }
  async function forget(id) {
    const c = conns.get(id); if (c) { c.peer = null; c.close(); conns.delete(id); }
    peers.delete(id);
    conflicts = conflicts.filter((x) => x.peer !== id); saveConflicts();
    await fsx.rm(baseFile(id)).catch(() => {});
    peersChanged();
  }
  async function start() {
    known = await scan();
    await startLocal();
    await startNetwork();
    pollTimer = setInterval(() => { if (known) announceLocalChanges(); }, 2000);
    log('HubDesk pronto');
  }
  async function stop() { clearInterval(pollTimer); clearTimeout(peersTimer); await stopNetwork(); await stopLocal(); }

  Object.assign(ev, {
    start, stop, getState, updateSettings, connectTo, syncPeer, syncAll: () => Promise.allSettled([...conns.keys()].map(syncPeer)),
    resolveConflict, resolveAll, forget, announceLocalChanges, scan,
  });
  return ev;
}

module.exports = { createEngine, Conn, SERVICE, PROTO, hashRecord, encodeKey };
