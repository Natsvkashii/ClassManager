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
    """Every {type: audio, src, transcript} dict anywhere in a module."""
    if isinstance(node, dict):
        if node.get("type") == "audio" and node.get("src") and node.get("transcript"):
            yield node
        for v in node.values():
            yield from audio_media(v)
    elif isinstance(node, list):
        for v in node:
            yield from audio_media(v)


class Aligner:
    def __init__(self, language="it"):
        import whisperx  # imported here so --help and --dry-run work without it
        self.wx = whisperx
        self.device = "cpu"
        self.model, self.meta = whisperx.load_align_model(language_code=language, device=self.device)

    def align(self, audio_path, words):
        audio = self.wx.load_audio(audio_path)
        duration = len(audio) / 16000
        seg = [{"start": 0.0, "end": duration, "text": " ".join(words)}]
        res = self.wx.align(seg, self.model, self.meta, audio, self.device, return_char_alignments=False)
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
    for i in known:
        out[i] = [round(float(pairs[i][0]), 3), round(float(pairs[i][1]), 3)]
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


def process_module(module_json, aligner, force, dry):
    base = os.path.dirname(module_json)
    with open(module_json, encoding="utf-8") as f:
        mod = json.load(f)
    changed = 0
    for m in audio_media(mod):
        words = transcript_words(m["transcript"])
        label = "%s · %s" % (mod.get("id", base), m.get("label") or m["src"])
        if not words or (m.get("wordTimes") and len(m["wordTimes"]) == len(words) and not force):
            continue
        path = os.path.normpath(os.path.join(base, m["src"]))
        if not path.startswith(os.path.normpath(base)) or not os.path.isfile(path):
            print("  [!] %s: audio mancante (%s)" % (label, m["src"]))
            continue
        if dry:
            print("  [ ] %s: %d parole da allineare" % (label, len(words)))
            continue
        try:
            m["wordTimes"] = aligner.align(path, words)
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
