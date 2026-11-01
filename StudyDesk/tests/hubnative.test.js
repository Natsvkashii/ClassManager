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
