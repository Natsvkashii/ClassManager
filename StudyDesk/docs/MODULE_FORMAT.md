# StudyDesk – Formato dei moduli (`.sdmod`)

Un modulo è un file **ZIP** con estensione `.sdmod` che contiene:

```
module.json          ← descrizione completa del modulo (obbligatorio)
assets/img/…         ← immagini (jpg, png, webp, svg)
assets/audio/…       ← tracce audio (mp3, m4a, ogg, wav)
assets/video/…       ← video (mp4, webm)
```

Tutti i percorsi in `module.json` sono relativi alla radice dello ZIP.

## module.json

```jsonc
{
  "format": "studydesk-module",
  "formatVersion": 1,
  "id": "nuovo-espresso-plus-1-u03",      // univoco, kebab-case; reimportare lo stesso id = aggiornamento
  "version": "1.0.0",
  "title": "Buon appetito!",
  "subtitle": "Nuovo Espresso Plus 1 · Unità 3",
  "course": "Nuovo Espresso Plus 1",
  "level": "A1",
  "language": "it",
  "color": "#7cb342",                      // colore d'accento del modulo
  "cover": "assets/img/cover.jpg",
  "description": "…",
  "author": { "name": "…", "email": "…" },
  "createdAt": "2026-10-30T00:00:00Z",
  "objectives": [ { "title": "Comunicazione", "items": ["Ordinare al bar", "…"] } ],
  "sections": [ Section, … ]
}
```

### Section

```jsonc
{ "id": "lezione", "title": "Lezione", "icon": "book-open", "part": "main", "activities": [ Activity, … ] }
```

`part` (facoltativo, predefinito `"main"`) indica a quale delle **tre parti del capitolo** appartiene la sezione:
`"main"` = unità principale, `"exercises"` = esercizi (eserciziario), `"video"` = videocorso.
L'app mostra il capitolo diviso in queste tre parti (schede «Capitolo», «Esercizi», «Videocorso»); una parte senza sezioni non viene mostrata.

`icon` è un nome Font Awesome senza prefisso (`book-open`, `video`, `pen`, `globe`, `mug-hot`, `flag-checkered`, `spell-check`).

### Activity (un esercizio numerato del libro)

```jsonc
{
  "id": "l03-a04",           // univoco nel modulo
  "number": "4",
  "title": "Al ristorante",
  "instructions": "…",       // opzionale
  "page": 41,                // pagina del libro (riferimento)
  "skills": ["ascolto", "lettura", "scrittura", "parlato", "grammatica", "lessico"],
  "media": [ Media, … ],     // opzionale: media comuni a tutte le parti
  "parts": [ Exercise, … ]   // almeno una
}
```

### Media

```jsonc
{ "type": "image", "src": "assets/img/x.jpg", "alt": "…", "caption": "…",
  "view": { "crop": [0.1, 0, 0.8, 1], "width": 420, "align": "center" } }   // facoltativo: ritaglio (frazioni x,y,w,h), larghezza max in punti, allineamento leading|center|trailing
{ "type": "audio", "src": "assets/audio/03-2.mp3", "label": "Traccia 3.2", "transcript": "testo…" }
{ "type": "video", "src": "assets/video/ep3.mp4", "label": "Videocorso 3", "transcript": "…" }
{ "type": "video", "url": "https://…", "label": "…" }   // video esterno (link)
```

#### Tempi delle parole (`wordTimes`, facoltativo)

Un audio con `transcript` può avere `"wordTimes": [[0.42, 0.81], [0.85, 1.30], …]`: una coppia `[inizio, fine]` in
secondi per ogni parola della trascrizione, nell'ordine in cui compaiono (il nome del parlante `Nome:` e il trattino
`- ` di inizio battuta non sono parole). Con questi tempi la trascrizione e la vista a schermo intero seguono l'audio
parola per parola; senza, o se la trascrizione è stata modificata e il numero di parole non torna più, i tempi vengono
stimati come prima. Non si scrivono a mano: li calcola `scripts/align_audio.py` (allineamento forzato WhisperX),
una volta sola, su un modulo o un `.sdbook`:

```bash
python3 -m pip install --user uv && uv venv -p 3.11 ~/.cache/studydesk-align
VIRTUAL_ENV=~/.cache/studydesk-align uv pip install whisperx      # una volta (~2 GB)
~/.cache/studydesk-align/bin/python scripts/align_audio.py libro.sdbook   # --dry-run per vedere cosa farebbe
```

### Exercise (una parte A/B/C di un'attività)

Campi comuni: `id`, `label` (es. `"A"`), `type`, `instructions`, `media` (opzionale), `points` (opzionale).

| type | Uso | Campi specifici | Correzione |
|---|---|---|---|
| `info` | testo, dialoghi, box grammatica, letture | `content` (Markdown leggero), `dialogue` `[{speaker,text}]`, `table` `{headers,rows}` | – |
| `choice` | scelta singola/multipla | `questions: [{prompt, media?, options:[string \| {text,image}], answer: n \| [n…]}]` (indice da 0; array = multipla) | automatica |
| `truefalse` | vero/falso, sì/no | `labels: ["vero","falso"]`, `statements: [{text, answer: true\|false}]` | automatica |
| `gapfill` | completare frasi | `items: [{text, media?}]` con lacune `[[risposta]]`, alternative `[[a\|b]]`, lacuna libera `[[]]`; `wordBank: [..]` opzionale; `layout: "lines"\|"paragraph"` | automatica |
| `match` | collegare | `left: [{id,text?,image?}]`, `right: [{id,text?,image?}]`, `pairs: [[leftId,rightId]…]` | automatica |
| `categorize` | classificare | `categories: [..]`, `items: [{text, category}]` (`category` = nome categoria, o array di nomi accettati) | automatica |
| `order` | ordinare | `items: [string \| {text,image}]` nell'ordine **corretto** (vengono mescolati) | automatica |
| `table` | tabella da completare | `headers: [..]`, `rows: [[cella…]]`, le celle usano la sintassi `[[…]]` | automatica |
| `open` | risposta libera scritta | `prompts: [{text, media?, lines?}]`, `sample` (soluzione modello, opzionale) | insegnante |
| `crossword` | cruciverba | `rows`, `cols`, `entries: [{number, direction: "across"\|"down", row, col, answer, clue}]` (row/col da 0), `solutionWord` opzionale `{label, cells: [[row,col]…]}` | automatica |
| `speaking` | attività orale / di gruppo | `content`, `record: true` per registrare la voce, `sample` | insegnante |

Markdown leggero supportato in `content`, `prompt`, `text`: `**grassetto**`, `*corsivo*`, `__sottolineato__`, elenchi con `- `, a capo con riga vuota.

### Confronto risposte

Le risposte vengono confrontate senza distinzione tra maiuscole/minuscole, normalizzando spazi e apostrofi tipografici (`’` → `'`). Gli accenti contano ma un accento sbagliato (`e` vs `è`) viene segnalato come «quasi giusto».

## Progressi dello studente (`.sdprogress.json`)

Esportati da *Progressi → Esporta / Invia*. Contengono profilo (nome, email), per ogni modulo e ogni esercizio: risposte, punteggio, punteggio massimo, tentativi, data di completamento, eventuali registrazioni (base64) e lo stato «da valutare» per le parti `open`/`speaking`.
