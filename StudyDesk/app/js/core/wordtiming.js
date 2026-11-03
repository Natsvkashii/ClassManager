// Word timing for synced transcripts (audio player + fullscreen lyrics).
// A media item may carry `wordTimes`: one [start, end] pair in seconds per transcript word, in the
// order produced by parseTranscript (scripts/align_audio.py writes them with WhisperX). Without
// them, or when they no longer match the transcript (it was edited), the timing is estimated.

// Splits a transcript into lines with optional speaker ("Nome: …") and turn dash ("- …").
export function parseTranscript(transcript) {
  const lines = [];
  let totalChars = 0;
  for (const raw of String(transcript || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    let line = raw;
    let speaker = null;
    let isTurn = false;
    if (line.startsWith('- ') || line.startsWith('– ')) { isTurn = true; line = line.slice(2).trim(); }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 18) {
      speaker = line.slice(0, colonIdx).trim();
      line = line.slice(colonIdx + 1).trim();
    }
    const words = line.split(/\s+/).filter((w) => w && w !== '-' && w !== '–');
    const count = Math.max(1, words.reduce((acc, w) => acc + w.length, 0));
    totalChars += count;
    lines.push({ speaker, isTurn, words, count });
  }
  return { lines, totalChars };
}

// True when `wordTimes` has one valid, non-decreasing [start, end] pair per word.
export function hasAlignedTimes(parsed, wordTimes) {
  if (!Array.isArray(wordTimes)) return false;
  const n = parsed.lines.reduce((acc, l) => acc + l.words.length, 0);
  if (!n || wordTimes.length !== n) return false;
  let prev = -Infinity;
  for (const p of wordTimes) {
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[1] < p[0] || p[0] < prev) return false;
    prev = p[0];
  }
  return true;
}

// [start, end] per word, flattened over all lines.
export function wordTimeline(parsed, { duration, activeTimeline, wordTimes } = {}) {
  if (hasAlignedTimes(parsed, wordTimes)) return wordTimes.map(([s, e]) => [s, Math.max(e, s + 0.05)]);
  const dur = Math.max(1, Number.isFinite(duration) && duration > 0 ? duration : 30);
  const total = Math.max(1, parsed.totalChars);
  const frames = activeTimeline && activeTimeline.length > 5 ? activeTimeline : null;
  const at = (frac) => frames ? frames[Math.min(frames.length - 1, Math.floor(frac * (frames.length - 1)))] : frac * dur;
  const out = [];
  let cur = 0;
  for (const line of parsed.lines) {
    for (const w of line.words) {
      const s = at(cur / total);
      cur += w.length;
      out.push([s, Math.max(s + 0.1, at(cur / total))]);
    }
  }
  return out;
}

// Index of the word playing at `t` (binary search on start times), or -1 before the first word.
// Between words (a pause) the previous word stays current, so the highlight never flickers.
export function wordAt(times, t) {
  let lo = 0, hi = times.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid][0] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}
