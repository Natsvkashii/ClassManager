#!/usr/bin/env python3
"""Real word-by-word timings for StudyDesk transcripts (forced alignment with WhisperX).

For every audio media with a `transcript` it writes `wordTimes`: one [start, end] pair in seconds per
transcript word, in the order app/js/core/wordtiming.js parseTranscript() reads them. The players use
them instead of estimating; if the transcript is edited later they fall back to the estimate.

Run once, by the author, when preparing a book (students need nothing):
  ~/.cache/studydesk-align/bin/python scripts/align_audio.py <module dir | module.json | book.sdbook> [...]
Options: --force (realign media that already have wordTimes), --dry-run (report only).
Setup: see docs/MODULE_FORMAT.md («Tempi delle parole»).
"""
import argparse, json, os, re, shutil, sys, tempfile, zipfile

LEAD_SPEAKER = 18  # same limit as the players: "Nome: …" up to 18 characters is a speaker


def transcript_words(transcript):
    """Mirror of parseTranscript(): the words, without speaker prefixes and turn dashes."""
    out = []
    for raw in str(transcript or "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("- ") or line.startswith("– "):
            line = line[2:].strip()
        c = line.find(":")
        if 0 < c <= LEAD_SPEAKER:
            line = line[c + 1:].strip()
        out += [w for w in re.split(r"\s+", line) if w and w not in ("-", "–")]
    return out


def audio_media(node):
    """Every {type: audio|video, src, transcript} dict anywhere in a module."""
    if isinstance(node, dict):
        if node.get("type") in ("audio", "video") and node.get("src") and node.get("transcript"):
            yield node
        for v in node.values():
            yield from audio_media(v)
    elif isinstance(node, list):
        for v in node:
            yield from audio_media(v)


def _ensure_ffmpeg():
    if shutil.which("ffmpeg"):
        return
    candidates = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/Users/guaira/Documents/TikTok/tiktok_plida_engine_v3/.venv/lib/python3.9/site-packages/static_ffmpeg/bin/darwin_arm64",
    ]
    for d in candidates:
        if os.path.isfile(os.path.join(d, "ffmpeg")):
            os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
            return


def _norm_word(w):
    return re.sub(r"[^\w]", "", w.lower())


def anchored_segments(asr_words, words, duration):
    """Anchor transcript chunks to Whisper ASR word timestamps, splitting at pauses and skipping intros/outros."""
    if len(asr_words) < 3 or len(words) < 3:
        return [{"start": 0.0, "end": duration, "text": " ".join(words)}]

    from difflib import SequenceMatcher
    t_norm = [_norm_word(w) for w in words]
    a_norm = [w[0] for w in asr_words]
    sm = SequenceMatcher(None, t_norm, a_norm, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size >= 2]
    if not blocks:
        first_t = max(0.0, asr_words[0][1] - 1.5)
        last_t = min(duration, asr_words[-1][2] + 2.0)
        if last_t <= first_t + 0.5:
            return [{"start": 0.0, "end": duration, "text": " ".join(words)}]
        return [{"start": first_t, "end": last_t, "text": " ".join(words)}]

    # Expand blocks into per-word anchor points (w_idx, asr_start, asr_end).
    word_anchors = []
    for b in blocks:
        for k in range(b.size):
            w_i = b.a + k
            s_t = float(asr_words[b.b + k][1])
            e_t = float(asr_words[b.b + k][2])
            if not word_anchors or (w_i > word_anchors[-1][0] and s_t >= word_anchors[-1][1]):
                word_anchors.append((w_i, s_t, max(e_t, s_t)))

    first_w, first_s, _ = word_anchors[0]
    last_w, _, last_e = word_anchors[-1]
    start_t = max(0.0, first_s - max(0.8, first_w * 0.55))
    end_t = min(duration, last_e + max(1.0, (len(words) - 1 - last_w) * 0.55))

    segs = []
    cur_w = 0
    cur_t = start_t
    prev_end = start_t
    for w_i, w_s, w_e in word_anchors:
        gap = w_s - prev_end
        if w_i > cur_w and (gap > 0.85 or (w_i - cur_w >= 24 and w_s - cur_t >= 2.0)):
            seg_end = min(duration, max(cur_t + 0.3, prev_end + 0.12))
            segs.append({
                "start": max(0.0, cur_t - 0.10),
                "end": seg_end,
                "text": " ".join(words[cur_w:w_i]),
            })
            cur_w = w_i
            cur_t = max(cur_t, w_s)
        prev_end = max(prev_end, w_e)

    if cur_w < len(words):
        final_end = max(cur_t + 0.8, end_t)
        segs.append({
            "start": max(0.0, cur_t - 0.10),
            "end": min(duration, final_end),
            "text": " ".join(words[cur_w:]),
        })
    return segs or [{"start": start_t, "end": max(start_t + 1.0, end_t), "text": " ".join(words)}]


class Aligner:
    def __init__(self, language="it"):
        _ensure_ffmpeg()
        import whisperx  # imported here so --help and --dry-run work without it
        self.wx = whisperx
        self.language = language
        self.device = "cpu"
        self.model, self.meta = whisperx.load_align_model(language_code=language, device=self.device)
        self.asr = None
        try:
            from faster_whisper import WhisperModel
            self.asr = WhisperModel("base", device="cpu", compute_type="int8", local_files_only=True)
        except Exception:
            try:
                from faster_whisper import WhisperModel
                self.asr = WhisperModel("base", device="cpu", compute_type="int8")
            except Exception:
                self.asr = None

    def _transcribe_anchors(self, audio_path):
        if self.asr is None:
            return []
        try:
            segs, _ = self.asr.transcribe(audio_path, language=self.language, word_timestamps=True, vad_filter=True)
            out = []
            for s in segs:
                for w in (s.words or []):
                    nw = _norm_word(w.word)
                    if nw:
                        out.append((nw, float(w.start), float(w.end)))
            return out
        except Exception:
            return []

    def align(self, audio_path, words):
        audio = self.wx.load_audio(audio_path)
        duration = len(audio) / 16000
        asr_words = self._transcribe_anchors(audio_path)
        segs = anchored_segments(asr_words, words, duration)
        res = self.wx.align(segs, self.model, self.meta, audio, self.device, return_char_alignments=False)
        got = [w for s in res["segments"] for w in s.get("words", [])]
        if len(got) != len(words) and len(segs) > 1:
            # Retry using just the single anchored [start, end] span across intro/outro.
            span = [{"start": segs[0]["start"], "end": segs[-1]["end"], "text": " ".join(words)}]
            res = self.wx.align(span, self.model, self.meta, audio, self.device, return_char_alignments=False)
            got = [w for s in res["segments"] for w in s.get("words", [])]
        if len(got) != len(words):
            raise RuntimeError("l'allineatore ha restituito %d parole su %d" % (len(got), len(words)))
        return fill_gaps([(w.get("start"), w.get("end")) for w in got], duration)


def fill_gaps(pairs, duration):
    """Words the model could not place (numbers, symbols) get the time between their neighbours."""
    n = len(pairs)
    out = [None] * n
    known = [i for i, (s, e) in enumerate(pairs) if s is not None and e is not None]
    if not known:
        raise RuntimeError("nessuna parola allineata")
    for idx, i in enumerate(known):
        s, e = float(pairs[i][0]), float(pairs[i][1])
        # Clamp abnormal >1.5s CTC stretch at silence boundaries using neighbour adjacency.
        if e - s > 1.5:
            prev_e = float(pairs[known[idx - 1]][1]) if idx > 0 else -1e9
            next_s = float(pairs[known[idx + 1]][0]) if idx + 1 < len(known) else 1e9
            if idx == 0 or (s - prev_e > 0.8 and next_s - e < 0.5):
                s = max(s, e - 0.75)
            else:
                e = min(e, s + 0.75)
        out[i] = [round(s, 3), round(e, 3)]
    i = 0
    while i < n:
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < n and out[j] is None:
            j += 1
        a = out[i - 1][1] if i > 0 else 0.0
        b = out[j][0] if j < n else duration
        step = max(0.0, b - a) / (j - i)
        for k in range(i, j):
            out[k] = [round(a + step * (k - i), 3), round(a + step * (k - i + 1), 3)]
        i = j
    prev = 0.0
    for p in out:  # the players require non-decreasing starts and end >= start
        p[0] = max(p[0], prev)
        p[1] = max(p[1], p[0])
        prev = p[0]
    return out


def bump_rev(book_json):
    """Raise the book's rev (as an edit in the app does) so the other computers take the new copy."""
    if not os.path.isfile(book_json):
        return
    with open(book_json, encoding="utf-8") as f:
        book = json.load(f)
    book["rev"] = (book.get("rev") or 0) + 1
    tmp = book_json + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=False, indent=2)
    os.replace(tmp, book_json)


def _fmt_vtt_time(sec):
    sec = max(0.0, float(sec))
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60.0
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def write_video_vtt(base_dir, media):
    """Build a synced WebVTT subtitle file from aligned wordTimes and attach media['subtitles']."""
    transcript = str(media.get("transcript") or "")
    word_times = media.get("wordTimes") or []
    src = str(media.get("src") or "")
    if not transcript.strip() or not word_times or not src:
        return None
    cues = []
    offset = 0
    for raw in transcript.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("- ") or line.startswith("– "):
            line = line[2:].strip()
        speaker = None
        c = line.find(":")
        if 0 < c <= LEAD_SPEAKER:
            speaker = line[:c].strip()
            line = line[c + 1:].strip()
        words = [w for w in re.split(r"\s+", line) if w and w not in ("-", "–")]
        if not words or offset + len(words) > len(word_times):
            continue
        ranges = word_times[offset:offset + len(words)]
        offset += len(words)
        # Split line at any silence gap > 1.0s first, then chunk each spoken group up to ~10 words.
        groups = []
        g_start = 0
        for k in range(1, len(words)):
            if ranges[k][0] - ranges[k - 1][1] > 1.0:
                groups.append((g_start, k))
                g_start = k
        groups.append((g_start, len(words)))
        for gs, ge in groups:
            g_len = ge - gs
            chunk_count = max(1, (g_len + 9) // 10)
            chunk_size = (g_len + chunk_count - 1) // chunk_count
            for idx in range(gs, ge, chunk_size):
                end_idx = min(idx + chunk_size, ge)
                start = ranges[idx][0]
                end = max(ranges[end_idx - 1][1], start + 0.45)
                if end_idx < ge:
                    nxt = ranges[end_idx][0]
                    if nxt - end < 0.4:
                        end = max(end, nxt)
                prefix = f"{speaker}: " if (idx == 0 and speaker) else ""
                cues.append(f"{_fmt_vtt_time(start)} --> {_fmt_vtt_time(end)}\n{prefix}{' '.join(words[idx:end_idx])}")
    if not cues:
        return None
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", os.path.splitext(os.path.basename(src))[0]).strip("_") or "video"
    rel_sub = f"assets/subtitles/{stem}.vtt"
    out_path = os.path.join(base_dir, rel_sub)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n" + "\n\n".join(cues) + "\n")
    os.replace(tmp, out_path)
    media["subtitles"] = rel_sub
    return rel_sub


def process_module(module_json, aligner, force, dry):
    base = os.path.dirname(module_json)
    with open(module_json, encoding="utf-8") as f:
        mod = json.load(f)
    changed = 0
    for m in audio_media(mod):
        words = transcript_words(m["transcript"])
        label = "%s · %s" % (mod.get("id", base), m.get("label") or m["src"])
        has_wt = bool(m.get("wordTimes") and len(m["wordTimes"]) == len(words))
        needs_vtt = m.get("type") == "video" and (force or not m.get("subtitles") or not os.path.isfile(os.path.join(base, str(m.get("subtitles")))))
        if not words or (has_wt and not force and not needs_vtt):
            continue
        path = os.path.normpath(os.path.join(base, m["src"]))
        if not path.startswith(os.path.normpath(base)) or not os.path.isfile(path):
            print("  [!] %s: file media mancante (%s)" % (label, m["src"]))
            continue
        if dry:
            print("  [ ] %s: %d parole da allineare" % (label, len(words)))
            continue
        try:
            if not has_wt or force:
                m["wordTimes"] = aligner.align(path, words)
            if m.get("type") == "video":
                write_video_vtt(base, m)
            changed += 1
            print("  [✓] %s: %d parole" % (label, len(words)))
        except Exception as e:  # one bad track must not stop the book
            print("  [!] %s: %s" % (label, e))
    if changed:
        tmp = module_json + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(mod, f, ensure_ascii=False, indent=2)
        os.replace(tmp, module_json)
        # installed module (…/StudyDesk/Modules/<id>): its book lives in …/StudyDesk/Books/<book id>
        bid = (mod.get("book") or {}).get("id")
        if bid and os.path.basename(os.path.dirname(base)) == "Modules":
            bump_rev(os.path.join(os.path.dirname(os.path.dirname(base)), "Books", bid, "book.json"))
    return changed


def process_sdbook(path, aligner, force, dry):
    work = tempfile.mkdtemp(prefix="sdbook-align-")
    try:
        with zipfile.ZipFile(path) as z:
            z.extractall(work)
        changed = 0
        chapters = os.path.join(work, "chapters")
        for cid in sorted(os.listdir(chapters)) if os.path.isdir(chapters) else []:
            mj = os.path.join(chapters, cid, "module.json")
            if os.path.isfile(mj):
                changed += process_module(mj, aligner, force, dry)
        if changed:
            bump_rev(os.path.join(work, "book.json"))
            tmp = path + ".tmp"
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
                for root, _, files in os.walk(work):
                    for fn in sorted(files):
                        full = os.path.join(root, fn)
                        z.write(full, os.path.relpath(full, work))
            os.replace(tmp, path)
        return changed
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--language", default="it")
    a = ap.parse_args()
    aligner = None if a.dry_run else Aligner(a.language)
    total = 0
    for p in a.paths:
        print(p)
        if p.endswith(".sdbook"):
            total += process_sdbook(p, aligner, a.force, a.dry_run)
        else:
            mj = p if p.endswith(".json") else os.path.join(p, "module.json")
            total += process_module(mj, aligner, a.force, a.dry_run)
    print("Tracce allineate: %d" % total)


if __name__ == "__main__":
    sys.exit(main())
