// Book transfer over HubDesk records: record shapes, chunk counting, publish/receive decisions, report link.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookMetaOf, missingChapters, canSend, needsPublish, needsUpdate, tieUpdate, bookRev, manifestHelps, countChunks, chunkKey, manifestKey, isTransferFile,
  isTransferKey, keyOfFile, track, percent, reportMailto, REPORT_TO,
} from '../app/js/core/booktransferlogic.js';
import { encodeKey } from '../app/js/core/hubnative.js';

const meta = { format: 'studydesk-book', id: 'b1', title: 'Nuovo Espresso 1', chapters: [{ moduleId: 'm1' }, { moduleId: 'm2' }] };

test('book records: flat book.json and the old web shape', () => {
  assert.deepEqual(bookMetaOf(meta), meta);
  assert.deepEqual(bookMetaOf({ id: 'b1', book: { title: 'X', chapters: [] }, source: 'import' }), { title: 'X', chapters: [], id: 'b1' });
  assert.equal(bookMetaOf(null), null);
  assert.equal(bookMetaOf({ book: {} }), null);
});

test('send / receive decisions', () => {
  const all = (id) => ['m1', 'm2'].includes(id), none = () => false, one = (id) => id === 'm1';
  assert.equal(canSend(meta, all), true);
  assert.equal(canSend(meta, one), false);
  assert.equal(canSend({ ...meta, chapters: [] }, all), false);
  assert.deepEqual(missingChapters(meta, one), ['m2']);
  assert.deepEqual(missingChapters(meta, none), ['m1', 'm2']);
  assert.equal(needsPublish(undefined, meta), true);
  assert.equal(needsPublish({ chapters: ['m1', 'm2'] }, meta), false);
  assert.equal(needsPublish({ chapters: ['m1'] }, meta), true);
  assert.equal(manifestHelps({ chapters: ['m1'] }, ['m2']), false);
  assert.equal(manifestHelps({ chapters: ['m1', 'm2'] }, ['m2']), true);
});

test('transfer keys and file names', () => {
  assert.ok(isTransferKey(manifestKey('b1')) && isTransferKey(chunkKey('b1', 't', 0)) && !isTransferKey('book:b1'));
  for (const k of [manifestKey('b 1/è'), chunkKey('b 1/è', 'abcd', 3)]) {
    assert.ok(isTransferFile(encodeKey(k)));
    assert.equal(keyOfFile(encodeKey(k)), k);
  }
  assert.ok(!isTransferFile(encodeKey('book:b1')));
  const files = [0, 1, 2].map((n) => encodeKey(chunkKey('b1', 'aa', n))).concat(encodeKey(chunkKey('b1', 'old', 0)), encodeKey(chunkKey('b10', 'aa', 0)), encodeKey(manifestKey('b1')));
  assert.equal(countChunks(files, 'b1', 'aa'), 3);
  assert.equal(countChunks(files, 'b1', 'old'), 1);
});

test('progress and stall tracking', () => {
  assert.equal(percent(1, 3), 33);
  assert.equal(percent(0, 0), 0);
  let r = track(null, 2, 1000);
  assert.equal(r.stalled, false);
  r = track(r.t, 2, 1000 + 60000); assert.equal(r.stalled, false);
  r = track(r.t, 2, 1000 + 180000); assert.equal(r.stalled, true);
  r = track(r.t, 3, 1000 + 190000); assert.equal(r.stalled, false);
});

test('report mailto is prefilled', () => {
  const u = reportMailto({ version: '26.11.0-011', platform: 'Windows', device: 'SURFACE', book: { id: 'b1', title: 'Nuovo Espresso 1', done: 2, total: 5 }, error: 'SHA-256', log: Array.from({ length: 80 }, (_, i) => `riga ${i}`) });
  assert.ok(u.startsWith(`mailto:${REPORT_TO}?subject=`));
  const q = new URLSearchParams(u.split('?')[1]);
  assert.match(q.get('subject'), /26\.11\.0-011.*Nuovo Espresso 1/);
  const body = q.get('body');
  for (const s of ['SURFACE', 'Windows', 'b1', 'SHA-256', '2 / 5', 'riga 79']) assert.ok(body.includes(s), s);
  assert.ok(!body.includes('riga 10\n'));
  assert.ok(body.length <= 1802);
});

test('edits travel: the copy with the higher rev wins, an equal rev does nothing', () => {
  const meta = { chapters: [{ moduleId: 'm1' }], rev: 3 };
  const pub = (rev) => ({ chapters: ['m1'], ...(rev === undefined ? {} : { rev }) });
  assert.equal(bookRev({ chapters: [] }), 0);
  assert.equal(needsPublish(pub(2), meta), true);     // edited here after publishing
  assert.equal(needsPublish(pub(3), meta), false);
  assert.equal(needsPublish(pub(undefined), { chapters: [{ moduleId: 'm1' }] }), false); // old copies: no endless resends
  assert.equal(needsUpdate(pub(4), meta), true);      // edited on the other computer
  assert.equal(needsPublish({ chapters: [], rev: 4 }, meta), false); // newer copy lacking a chapter: take it, do not republish
  assert.equal(needsUpdate(pub(3), meta), false);
  assert.equal(needsUpdate(undefined, meta), false);
});

test('equal rev, different copy: take the published one once, never the one already held', () => {
  const meta = { chapters: [{ moduleId: 'm1' }], rev: 2 };
  assert.equal(tieUpdate({ rev: 2, tid: 'B' }, meta, 'A'), true);   // a copy this device never had
  assert.equal(tieUpdate({ rev: 2, tid: 'A' }, meta, 'A'), false);  // the one it has: nothing to do
  assert.equal(tieUpdate({ rev: 1, tid: 'B' }, meta, 'A'), false);  // older: needsPublish handles it
  assert.equal(tieUpdate({ tid: 'B' }, { chapters: [] }, undefined), false); // books without rev: left alone
});
