// Browser test only: the native bridges of hubdesk_native.cpp, simulated (used by tests/make_browser_test.py).
(function () {
  const reg = { ClassDesk: '26.11.0-004', StudyDesk: '26.11.0-4' };
  window.__hd_info = { version: '26.11.0-005' };
  window.__hd_calls = [];
  const log = (n, a) => window.__hd_calls.push([n, a]);
  Object.assign(window, {
    __hd_programs: async () => 'C:\\Users\\t\\AppData\\Local\\Programs',
    __hd_temp: async () => 'C:\\Users\\t\\AppData\\Local\\Temp',
    __hd_exists: async (p) => /ClassDesk\.exe$|StudyDesk\.exe$|HubDesk\.exe$/.test(p),
    __hd_app_version: async (k, n) => reg[k || n] || '',
    __hd_running: async () => false,
    __hd_close_app: async (e) => { log('close', e); return true; },
    __hd_run: async (f, a) => { log('run', [f, JSON.parse(a)]); return 0; },
    __hd_run_detached: async (f, a) => { log('detached', [f, a]); return true; },
    __hd_open: async (p) => { log('open', p); return true; },
    __hd_open_external: async () => true,
    __hd_http_get: async (url) => JSON.stringify(url.includes('api.github.com') ? [{ tag_name: 'v26.11.0-005', prerelease: true, draft: false, body: 'note', assets: [{ name: 'ClassDesk-Suite-26.11.0-005-Setup.exe', browser_download_url: 'https://github.com/x/s.exe', size: 1 }, { name: 'ClassDesk-Suite-26.11.0-005-Installer.pkg', browser_download_url: 'https://github.com/x/p.pkg', size: 1 }] }] : {}),
    __hd_download: async (u, f, id) => { log('download', [u, f]); window.__hd_progress(id, 1); return true; },
    __hd_rm: async () => true, __hd_quit: async () => true, __hd_autostart: async () => true, __hd_notify: async () => true,
    __hd_hostname: async () => 'SURFACE', __hd_data_dir: async () => 'C:\\Users\\t\\AppData\\Roaming\\DeskHub',
  });
  let st = null;
  window.__hd_state_read = async () => st; window.__hd_state_write = async (t) => { st = t; return true; };
  const files = { 'settings.json': JSON.stringify({ deviceId: 'dev-win', deviceName: 'Surface', syncCode: 'abc', syncEnabled: true, channel: 'unstable' }),
    'peers.json': JSON.stringify({ peers: [{ deviceId: 'dev-mac', name: 'MacBook Pro di Guaira', platform: 'macos', version: '26.11.0-005' }] }) };
  window.__hd_settings_read = async () => files['settings.json']; window.__hd_settings_write = async (t) => { files['settings.json'] = t; return true; };
  let seq = 0;
  Object.assign(window, {
    __hd_fs_list: async (rel) => { const pre = rel === '.' ? '' : rel + '/'; const out = new Map(); for (const k of Object.keys(files)) if (k.startsWith(pre)) { const rest = k.slice(pre.length); const n = rest.split('/')[0]; out.set(n, { n, s: files[k].length, m: '1', d: rest.includes('/') }); } return [...out.values()]; },
    __hd_fs_read: async (rel) => (rel in files ? files[rel] : null),
    __hd_fs_write: async (rel, t) => { files[rel] = t; return true; },
    __hd_fs_rm: async (rel) => { delete files[rel]; return true; },
    __hd_tcp_listen: async () => ({ id: ++seq, port: 50000 + seq }),
    __hd_tcp_connect: async () => -1, __hd_tcp_send: async () => true, __hd_tcp_close: async () => true,
    __hd_mdns_register: async () => true, __hd_mdns_unregister: async () => true, __hd_mdns_browse: async () => true,
  });
  window.__hd_files = files;
})();
