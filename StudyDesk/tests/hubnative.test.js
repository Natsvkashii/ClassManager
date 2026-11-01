// The page-side HubDesk mirror of the native Windows app must take the same decisions and write the same files as Electron's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { decide, encodeKey, hashOf } from '../app/js/core/hubnative.js';

const require = createRequire(import.meta.url);
const mirror = require('../electron/records-mirror.js');
const recs = require('../electron/deskhub-records.js');

test('native mirror = Electron mirror: hashes, file names and every decision', async () => {
  for (const [d, v] of [[false, { a: 1, b: [2, 3] }], [true, null], [false, 'x'], [false, { z: { y: 1, x: [1, { b: 2, a: 1 }] } }]]) {
    assert.equal(await hashOf(d, v), recs.hashOf(d, v));
  }
  for (const k of ['group:abc', 'progress:g1::m 1::p/2', 'àèé:€']) assert.equal(encodeKey(k), recs.encodeKey(k));
  const me = 'dev-a', other = 'dev-b';
  const L1 = { name: 'A', updatedAt: '2026-11-01T10:00:00Z' }, L2 = { name: 'B', updatedAt: '2026-11-01T09:00:00Z' };
  const H = (value, device, updatedAt, deleted = false) => ({ key: 'k', device, updatedAt, deleted, value: deleted ? null : value });
  const cases = [];
  for (const L of [undefined, L1]) for (const Hr of [undefined, H(L2, other, '2026-11-01T11:00:00Z'), H(L2, me, '2026-11-01T08:00:00Z'), H(null, other, '2026-11-01T12:00:00Z', true), H(L1, other, '2026-11-01T10:00:00Z')])
    for (const hasTomb of [false, true]) for (const kSel of ['none', 'L', 'H', 'empty']) cases.push({ L, H: Hr, hasTomb, kSel });
  for (const c of cases) {
    const lh = c.L !== undefined ? recs.hashOf(false, c.L) : null, hh = c.H ? recs.hashRecord(c.H) : null;
    const k = c.kSel === 'none' ? undefined : c.kSel === 'L' ? lh : c.kSel === 'H' ? hh : '';
    const a = mirror.decide({ key: 'k', L: c.L, hasTomb: c.hasTomb, H: c.H, k, me });
    const b = decide({ L: c.L, lh, hasTomb: c.hasTomb, H: c.H, hh, k, me });
    assert.deepEqual(b, a, JSON.stringify(c));
  }
});

test('hubnative + hubdesk: recovers early native hello via __sd_hub_sync and replies once to incoming snapshot', async () => {
  const files = new Map([
    ['settings.json', JSON.stringify({ deviceId: 'dev-win', deviceName: 'Surface', syncCode: 'secret', syncEnabled: true, autoBoard: true })],
    ['runtime.json', JSON.stringify({ port: 12345, token: 'tok', heartbeat: new Date().toISOString(), version: '26.11.0-006' })],
  ]);
  const sent = [];
  let transientNullSettings = false;
  globalThis.window = {
    addEventListener: () => {},
    dispatchEvent: () => {},
    studydesk: { platform: 'win32', native: true },
    __sd_hub_read: async (rel) => {
      if (rel === 'settings.json' && transientNullSettings) return null;
      return files.get(rel) ?? null;
    },
    __sd_hub_write: async (rel, content) => { files.set(rel, content); return true; },
    __sd_hub_list: async () => [],
    __sd_hub_send: async (line) => { sent.push(JSON.parse(line)); return true; },
    __sd_hub_launch: async () => true,
    __sd_hostname: async () => 'FALLBACK-HOST',
    __sd_hub_sync: async () => ({
      connected: true,
      hello: { t: 'hello', ok: true, self: { deviceId: 'dev-win', deviceName: 'Surface' }, peers: [{ deviceId: 'dev-mac', name: 'Mac', platform: 'macos', connected: true }] },
      peers: null,
    }),
  };
  await import('../app/js/core/hubnative.js?test=sync');
  assert.ok(globalThis.window.studydesk.hubdesk, 'hubnative installed window.studydesk.hubdesk');

  const st1 = await globalThis.window.studydesk.hubdesk.ready();
  assert.equal(st1.running, true, 'ready() synced early hello from native socket');
  assert.equal(st1.deviceName, 'Surface');
  assert.equal(st1.connectedPeers.length, 1);
  assert.equal(st1.connectedPeers[0].name, 'Mac');

  // Transient null read on settings.json must not overwrite deviceId / deviceName with FALLBACK-HOST
  transientNullSettings = true;
  const st2 = await globalThis.window.studydesk.hubdesk.status();
  assert.equal(st2.deviceId, 'dev-win');
  assert.equal(st2.deviceName, 'Surface');
  assert.equal(JSON.parse(files.get('settings.json')).deviceName, 'Surface');

  // Bidirectional snapshot reply: when another device sends an empty snapshot and this board has a stroke, reply once with reply: true
  const hd = await import('../app/js/core/hubdesk.js');
  await hd.initHubDesk();
  hd.sharedBoard.strokes.push({ id: 'dev-win:1', color: '#111827', w: 0.004, eraser: false, points: [{ x: 0.2, y: 0.3, p: 0.5 }] });
  const beforeCount = sent.length;
  globalThis.window.__sd_hub_on({ t: 'board', from: 'dev-mac', fromName: 'Mac', msg: { t: 'snapshot', strokes: [], texts: [], background: '#ffffff', grid: null } });
  assert.equal(sent.length, beforeCount + 1, 'non-empty board replies once with its snapshot');
  assert.equal(sent[sent.length - 1].msg.t, 'snapshot');
  assert.equal(sent[sent.length - 1].msg.reply, true);
  assert.equal(sent[sent.length - 1].msg.strokes.length, 1);

  // Incoming snapshot with reply: true must NOT trigger another reply
  globalThis.window.__sd_hub_on({ t: 'board', from: 'dev-mac', fromName: 'Mac', msg: { t: 'snapshot', reply: true, strokes: [], texts: [], background: '#ffffff', grid: null } });
  assert.equal(sent.length, beforeCount + 1, 'reply snapshot does not loop');
});

