// =====================================================================================
// HubDesk for Windows, native (Hub/win-host): window.hubdesk for renderer/app.js, built in the page.
// Conceived and created by Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com) – GPL-3.0
// =====================================================================================
//
// Classic script injected by the host before the page (w.init): it must define window.hubdesk synchronously. The shared
// CommonJS modules (Hub/electron/catalog/catalog.js, manager.js) are bundled in front of this file by build.py and run
// unchanged with tiny shims for fs/os/path/events. The Windows driver (registry, processes, installers) calls the native bridges window.__hd_*.
// The network engine (devices, sync, conflicts, board, local channel for the apps) is page/hub-engine.js.
(function () {
  if (window.hubdesk) return;
  const cache = {};
  const winJoin = (...p) => p.filter(Boolean).join('\\').replace(/\\+/g, '\\');
  let TMP = 'C:\\Windows\\Temp';
  class Emitter {
    constructor() { this._l = {}; }
    on(e, f) { (this._l[e] = this._l[e] || []).push(f); return this; }
    off(e, f) { this._l[e] = (this._l[e] || []).filter((x) => x !== f); return this; }
    emit(e, ...a) { (this._l[e] || []).slice().forEach((f) => f(...a)); return true; }
  }
  /** SHA-256 of a string (UTF-8), hex — synchronous like node's crypto (record hashes must match the other devices). */
  function sha256(str) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(str), len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
    const bits = len * 8; for (let i = 0; i < 4; i++) m[total - 1 - i] = (bits >>> (8 * i)) & 0xff; m[total - 5] = Math.floor(len / 0x20000000) & 0xff;
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) w[i] = (w[i - 16] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 7] + (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10))) >>> 0;
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map((x) => x >>> 0);
    }
    return h.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  const shims = {
    fs: {
      mkdtempSync: (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, // created by the download
      rmSync: (p) => { window.__hd_rm(String(p)).catch(() => {}); },
      existsSync: () => false,
    },
    os: { tmpdir: () => TMP },
    path: { join: winJoin, dirname: (p) => String(p).replace(/[\\/][^\\/]*$/, ''), basename: (p) => String(p).split(/[\\/]/).pop() },
    events: { EventEmitter: Emitter },
    crypto: {
      createHash: () => { let data = ''; const h = { update: (x) => { data += String(x); return h; }, digest: () => sha256(data) }; return h; },
      randomBytes: (n) => { const b = crypto.getRandomValues(new Uint8Array(n)); return { toString: () => [...b].map((x) => x.toString(16).padStart(2, '0')).join('') }; },
      randomUUID: () => crypto.randomUUID(),
    },
  };
  /** CommonJS modules bundled by build.py as functions in window.__hd_modules (the page's CSP forbids fetch and eval). */
  function requireMod(name) {
    const key = name.replace(/^\.\//, '').replace(/\.js$/, '');
    if (cache[key]) return cache[key].exports;
    const def = (window.__hd_modules || {})[key];
    if (!def) throw new Error('HubDesk: modulo mancante ' + key);
    const module = { exports: {} };
    cache[key] = module;
    def(module, module.exports, (n) => shims[n] || requireMod(n));
    return module.exports;
  }
  const cat = requireMod('catalog');
  const { createManager } = requireMod('manager');

  // ---------------------------------------------------------------- Windows driver (same contract as catalog/platform-win.js)
  const PROGRAMS = () => window.__hd_programs();
  const EXES = { classdesk: 'ClassDesk\\ClassDesk.exe', studydesk: 'studydesk\\StudyDesk.exe', hubdesk: 'hubdesk\\HubDesk.exe' };
  const DISPLAY = { classdesk: 'ClassDesk', studydesk: 'StudyDesk', hubdesk: 'HubDesk' };
  const INSTALL_ARGS = { classdesk: ['--silent'], studydesk: ['/S'], hubdesk: ['--silent'] };
  let programsDir = '';
  const exe = (id) => winJoin(programsDir, EXES[id]);
  const SELF_VERSION = (window.__hd_info && window.__hd_info.version) || '';
  const driver = {
    platform: 'win',
    exePath: exe,
    async detect(id) {
      if (!(await window.__hd_exists(exe(id)))) return null;
      const v = id === 'hubdesk' ? SELF_VERSION : await window.__hd_app_version(id === 'classdesk' ? 'ClassDesk' : id === 'studydesk' ? 'StudyDesk' : '', DISPLAY[id]);
      return { version: v || '0.0.0-000', path: exe(id) };
    },
    isRunning: (id) => window.__hd_running(EXES[id].split('\\').pop()),
    async runInstaller(id, file, { suite = false } = {}) {
      let installer = file;
      if (suite) {
        installer = winJoin(shims.path.dirname(file), `${id}-setup.exe`);
        const code = await window.__hd_run(file, JSON.stringify([`--extract=${id}`, `--out=${installer}`]));
        if (code !== 0) throw new Error(`estrazione di ${DISPLAY[id]} non riuscita (codice ${code})`);
      }
      await window.__hd_close_app(EXES[id].split('\\').pop());
      const code = await window.__hd_run(installer, JSON.stringify(INSTALL_ARGS[id]));
      if (code !== 0) throw new Error(`installer terminato con codice ${code}`);
    },
    async runInstallerDetached(id, file) { await window.__hd_run_detached(file, JSON.stringify(['--silent', `--components=${id}`])); },
    async uninstall(id) {
      if (id === 'hubdesk') throw new Error('HubDesk non si disinstalla da qui');
      if (id === 'classdesk') { await window.__hd_run(exe('classdesk'), JSON.stringify(['--uninstall', '--silent'])); return; }
      const nsis = winJoin(programsDir, 'studydesk', 'Uninstall StudyDesk.exe');
      if (await window.__hd_exists(nsis)) await window.__hd_run(nsis, JSON.stringify(['/S']));
      else await window.__hd_run(exe('studydesk'), JSON.stringify(['--uninstall', '--silent']));
    },
    open(id) { window.__hd_open(exe(id)); },
  };
  const fetchJson = async (url) => { const t = await window.__hd_http_get(url); if (t == null) throw new Error('rete non disponibile'); return JSON.parse(t); };
  const progress = {};
  window.__hd_progress = (id, p) => { if (progress[id]) progress[id](p); };
  async function download(url, file, onProgress) {
    const id = Math.random().toString(36).slice(2);
    progress[id] = onProgress || (() => {});
    try { const ok = await window.__hd_download(url, file, id); if (!ok) throw new Error('download non riuscito'); }
    finally { delete progress[id]; }
  }

  // ---------------------------------------------------------------- service
  const subs = { engine: new Set(), apps: new Set(), app: new Set(), nav: new Set() };
  const fire = (k, v) => subs[k].forEach((f) => { try { f(v); } catch (e) { console.error(e); } });
  let appState = { welcomeDone: false, autoUpdate: true, openAtLogin: true, notice: '' };
  // same fields as Electron's publicApp() (main.js)
  let dataDir = ''; // %APPDATA%\DeskHub, shown in Impostazioni › Informazioni
  const publicApp = () => ({ ...appState, version: SELF_VERSION, platform: 'win32', dataDir, demo: false, firstRun: !appState.welcomeDone });
  let engine = null; // page/hub-engine.js (port of net/hub-net.js on the native sockets and mDNS)
  const engineState = () => engine.getState();
  let manager = null;
  const ready = (async () => {
    programsDir = await PROGRAMS();
    dataDir = await window.__hd_data_dir().catch(() => '');
    TMP = await window.__hd_temp();
    appState = { ...appState, ...(JSON.parse((await window.__hd_state_read()) || '{}')) };
    const settings = JSON.parse((await window.__hd_settings_read()) || '{}');
    const { createEngine } = requireMod('hub-engine');
    engine = await createEngine({ version: SELF_VERSION, deviceName: settings.deviceName || (await window.__hd_hostname().catch(() => 'Windows')) });
    engine.on('state', (st) => fire('engine', st));
    engine.on('open', (id) => { if (manager) manager.open(id); });
    engine.start().catch((e) => console.error('HubDesk rete:', e));
    manager = createManager({ driver, fetchJson, download, platform: 'win', channel: engine.getState().settings.channel || 'unstable', tmpRoot: TMP, quitSelf: () => window.__hd_quit() });
    manager.on('state', (s) => fire('apps', s));
    // updates and migration, as Electron's main.js: first check after 3 s, then every 6 hours
    let updating = false;
    const checkAndUpdate = async (auto) => {
      if (updating) return; updating = true;
      try { await manager.check(); if (auto && appState.autoUpdate) await manager.updateAll({ onlyClosed: true }); } finally { updating = false; }
    };
    /** §6: the legacy ClassDesk (26.10.x) is updated to the suite version on first run. */
    const migrateLegacyClassDesk = async () => {
      if (appState.migrationDone) return;
      const st = manager.state.classdesk, snap = manager.snapshot();
      if (!snap.apps.length || snap.checkError) return;
      if (!st.installed || !st.available || cat.compareVersions(st.installed.version, st.available.version) >= 0) { saveApp({ migrationDone: true }); return; }
      saveApp({ notice: `Aggiornamento di ClassDesk ${st.installed.version} alla versione ${st.available.version} in corso…` });
      try { await manager.install('classdesk'); saveApp({ migrationDone: true, notice: `ClassDesk è stato aggiornato alla versione ${manager.state.classdesk.installed.version}. I tuoi dati sono rimasti al loro posto.` }); }
      catch (e) { saveApp({ notice: `Aggiornamento di ClassDesk non riuscito: ${e.message}` }); }
    };
    setTimeout(async () => { await checkAndUpdate(false).catch(() => {}); await migrateLegacyClassDesk(); if (appState.autoUpdate) manager.updateAll({ onlyClosed: true }).catch(() => {}); }, 3000);
    setInterval(() => checkAndUpdate(true).catch(() => {}), 6 * 60 * 60 * 1000);
    // new conflicts: a Windows notification (the tray icon shows it)
    let lastConflicts = engine.getState().conflicts.length;
    engine.on('state', (st) => {
      const n = st.conflicts.length;
      if (n > lastConflicts) {
        window.__hd_notify('HubDesk – conflitto di sincronizzazione', n - lastConflicts === 1 ? `${st.conflicts[n - 1].title} è stato modificato su due dispositivi.` : `${n - lastConflicts} elementi sono stati modificati su due dispositivi.`).catch(() => {});
        fire('nav', 'conflicts');
      }
      lastConflicts = n;
    });
    setInterval(() => manager.refreshInstalled().catch(() => {}), 15000);
  })();
  const saveApp = (patch) => { appState = { ...appState, ...patch }; window.__hd_state_write(JSON.stringify(appState)); fire('app', publicApp()); return publicApp(); };
  const sub = (k) => (cb) => { subs[k].add(cb); return () => subs[k].delete(cb); };
  const after = (f) => async (...a) => { await ready; return f(...a); };

  window.hubdesk = {
    state: after(() => ({ engine: engineState(), apps: manager.snapshot(), app: publicApp() })),
    onEngine: sub('engine'), onApps: sub('apps'), onApp: sub('app'), onNav: sub('nav'),
    apps: {
      check: after(() => manager.check()),
      install: after((id) => manager.install(String(id)).catch((e) => ({ error: e.message }))),
      reinstall: after((id) => manager.install(String(id), { reinstall: true }).catch((e) => ({ error: e.message }))),
      uninstall: after((id) => manager.uninstall(String(id)).catch((e) => ({ error: e.message }))),
      open: after((id) => { manager.open(String(id)); return true; }),
      updateAll: after(() => manager.updateAll()),
      setChannel: after(async (c) => { await engine.updateSettings({ channel: c === 'stable' ? 'stable' : 'unstable' }); return manager.setChannel(c); }),
      notes: after((id) => { const s = manager.state[String(id)]; const a = s && s.available; return a ? { version: a.version, name: a.name, notes: a.notes, prerelease: a.prerelease } : null; }),
    },
    net: { // same handlers as Electron's main.js
      settings: after(async (patch) => engine.updateSettings(patch || {})),
      syncNow: after(async (id) => { try { return await engine.syncPeer(String(id)); } catch (e) { return { error: e.message }; } }),
      syncAll: after(() => engine.syncAll().then(() => true)),
      forget: after((id) => engine.forget(String(id))),
      resolve: after(async (key, peer, keepLocal) => { try { return await engine.resolveConflict(String(key), String(peer), !!keepLocal); } catch (e) { return { error: e.message }; } }),
      resolveAll: after((keepLocal) => engine.resolveAll(!!keepLocal)),
      genCode: async () => { const a = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase(); return `${a.slice(0, 4)}-${a.slice(4)}`; },
    },
    app: {
      settings: after(async (patch) => { const s = saveApp(patch || {}); if ('openAtLogin' in (patch || {})) window.__hd_autostart(patch.openAtLogin ? '1' : '0'); return s; }),
      welcomeDone: after(async ({ code, apps } = {}) => {
        if (code) await window.hubdesk.net.settings({ syncCode: String(code) });
        saveApp({ welcomeDone: true });
        for (const id of apps || []) manager.install(id).catch(() => {});
        return true;
      }),
      clearNotice: after(() => { saveApp({ notice: '' }); return true; }),
      openExternal: (u) => window.__hd_open_external(String(u)),
    },
  };
  window.__hd_nav = (page) => fire('nav', page); // tray menu → page
})();
