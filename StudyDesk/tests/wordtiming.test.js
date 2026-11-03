// Synced transcript timing (app/js/core/wordtiming.js): real `wordTimes` win, estimate is the fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript, hasAlignedTimes, wordTimeline, wordAt } from '../app/js/core/wordtiming.js';

const TR = 'Cameriere: Buonasera, prego.\n- Grazie mille.';

test('parseTranscript strips speaker and turn dash', () => {
  const p = parseTranscript(TR);
  assert.deepEqual(p.lines.map((l) => l.words), [['Buonasera,', 'prego.'], ['Grazie', 'mille.']]);
  assert.equal(p.lines[0].speaker, 'Cameriere');
  assert.equal(p.lines[1].isTurn, true);
});

test('aligned wordTimes are used as they are', () => {
  const p = parseTranscript(TR);
  const wt = [[0.4, 1.1], [1.2, 1.6], [3.0, 3.4], [3.5, 4.0]];
  assert.ok(hasAlignedTimes(p, wt));
  assert.deepEqual(wordTimeline(p, { duration: 10, wordTimes: wt }), wt);
});

test('mismatched or broken wordTimes fall back to the estimate', () => {
  const p = parseTranscript(TR);
  assert.equal(hasAlignedTimes(p, [[0, 1]]), false);                         // transcript edited
  assert.equal(hasAlignedTimes(p, [[0, 1], [2, 1], [3, 4], [5, 6]]), false); // end before start
  assert.equal(hasAlignedTimes(p, [[2, 3], [1, 2], [3, 4], [5, 6]]), false); // not in order
  const est = wordTimeline(p, { duration: 10, wordTimes: [[0, 1]] });
  assert.equal(est.length, 4);
  assert.equal(est[0][0], 0);
  assert.ok(est[3][1] <= 10.1);
});

test('wordAt keeps the previous word during a pause', () => {
  const t = [[0.4, 1.1], [1.2, 1.6], [3.0, 3.4]];
  assert.equal(wordAt(t, 0.1), -1);
  assert.equal(wordAt(t, 0.5), 0);
  assert.equal(wordAt(t, 2.5), 1);
  assert.equal(wordAt(t, 3.1), 2);
});
