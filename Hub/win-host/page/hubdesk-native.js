// =====================================================================================
// HubDesk for Windows, native (Hub/win-host): window.hubdesk for renderer/app.js, built in the page.
// Conceived and created by Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com) – GPL-3.0
// =====================================================================================
//
// Classic script injected by the host before the page (w.init): it must define window.hubdesk synchronously. The shared
// CommonJS modules (Hub/electron/catalog/catalog.js, manager.js) are bundled in front of this file by build.py and run
// unchanged with tiny shims for fs/os/path/events. The Windows driver (registry, processes, installers) calls the native bridges window.__hd_*.
// The network engine (devices, sync, conflicts, board) is NOT native yet: engine state says so (StudyDesk/docs/WINDOWS_NATIVE_PLAN.md).
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
  const shims = {
    fs: {
      mkdtempSync: (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, // created by the download
      rmSync: (p) => { window.__hd_rm(String(p)).catch(() => {}); },
      existsSync: () => false,
    },
    os: { tmpdir: () => TMP },
    path: { join: winJoin, dirname: (p) => String(p).replace(/[\\/][^\\/]*$/, ''), basename: (p) => String(p).split(/[\\/]/).pop() },
    events: { EventEmitter: Emitter },
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
      const v = id === 'hubdesk' ? SELF_VERSION : await window.__hd_app_version(id === 'classdesk' ? 'ClassDesk' : '', DISPLAY[id]);
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
    async runInstallerDetached(id, file) { await window.__hd_run_detached(file, JSON.stringify(['--silent'])); },
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
  const publicApp = () => ({ ...appState, version: SELF_VERSION, platform: 'win32', dataDir: '', demo: false, firstRun: !appState.welcomeDone });
  const engineState = { running: false, native: true, status: 'La rete tra i computer non è ancora disponibile in questa versione di HubDesk.', self: {}, peers: [], conflicts: [], settings: {}, clients: [], log: [] };
  let manager = null;
  const ready = (async () => {
    programsDir = await PROGRAMS();
    TMP = await window.__hd_temp();
    appState = { ...appState, ...(JSON.parse((await window.__hd_state_read()) || '{}')) };
    const settings = JSON.parse((await window.__hd_settings_read()) || '{}');
    engineState.self = { deviceId: settings.deviceId || '', deviceName: settings.deviceName || '', version: SELF_VERSION, platform: 'win32' };
    engineState.settings = { channel: settings.channel || 'unstable', syncCode: settings.syncCode || '', syncEnabled: settings.syncEnabled !== false, autoBoard: settings.autoBoard !== false, deviceName: settings.deviceName || '' };
    manager = createManager({ driver, fetchJson, download, platform: 'win', channel: engineState.settings.channel, tmpRoot: TMP, quitSelf: () => window.__hd_quit() });
    manager.on('state', (s) => fire('apps', s));
    manager.check().catch(() => {});
    setInterval(() => manager.refreshInstalled().catch(() => {}), 15000);
  })();
  /** settings.json of DeskHub (shared with the apps): read, merge, write. */
  async function patchSettings(patch) {
    const cur = JSON.parse((await window.__hd_settings_read()) || '{}');
    await window.__hd_settings_write(JSON.stringify({ ...cur, ...(patch || {}) }, null, 2));
  }
  const saveApp = (patch) => { appState = { ...appState, ...patch }; window.__hd_state_write(JSON.stringify(appState)); fire('app', publicApp()); return publicApp(); };
  const sub = (k) => (cb) => { subs[k].add(cb); return () => subs[k].delete(cb); };
  const after = (f) => async (...a) => { await ready; return f(...a); };

  window.hubdesk = {
    state: after(() => ({ engine: engineState, apps: manager.snapshot(), app: publicApp() })),
    onEngine: sub('engine'), onApps: sub('apps'), onApp: sub('app'), onNav: sub('nav'),
    apps: {
      check: after(() => manager.check()),
      install: after((id) => manager.install(String(id)).catch((e) => ({ error: e.message }))),
      reinstall: after((id) => manager.install(String(id), { reinstall: true }).catch((e) => ({ error: e.message }))),
      uninstall: after((id) => manager.uninstall(String(id)).catch((e) => ({ error: e.message }))),
      open: after((id) => { manager.open(String(id)); return true; }),
      updateAll: after(() => manager.updateAll()),
      setChannel: after(async (c) => { engineState.settings.channel = c === 'stable' ? 'stable' : 'unstable'; await patchSettings({ channel: engineState.settings.channel }); fire('engine', engineState); return manager.setChannel(c); }),
      notes: after((id) => { const s = manager.state[String(id)]; const a = s && s.available; return a ? { version: a.version, name: a.name, notes: a.notes, prerelease: a.prerelease } : null; }),
    },
    net: { // network engine: not native yet
      settings: after(async (patch) => { Object.assign(engineState.settings, patch || {}); await patchSettings(patch); fire('engine', engineState); return engineState; }),
      syncNow: async () => ({ error: engineState.status }), syncAll: async () => false, forget: async () => false,
      resolve: async () => ({ error: engineState.status }), resolveAll: async () => false,
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
