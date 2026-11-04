# Istruzioni per un'AI: convertire un libro in un file `.sdbook` per StudyDesk

Sei un'AI incaricata di trasformare un libro (PDF, scansioni, testo, file audio/video allegati) in un file
**`.sdbook`** che l'app **StudyDesk** (macOS nativo, Windows, web/Android) possa importare senza errori.
Segui queste istruzioni alla lettera. Non inventare campi, tipi di esercizio o sintassi che non sono descritti qui:
se ti servono, **fermati su quel punto e scrivilo nel report** (vedi §10).

Fonti ufficiali del formato (se hai accesso al repository, prevalgono su questo documento):
`StudyDesk/docs/MODULE_FORMAT.md`, `StudyDesk/docs/BOOKS_ROLES_GROUPS.md`,
esempio funzionante `StudyDesk/tests/fixtures/sample.sdbook` (generato da `scripts/build-sample-book.js`).

---

## 1. Cosa devi consegnare

1. `<id-libro>.sdbook` — il libro pronto da importare.
2. `REPORT_STUDYDESK.md` — **sempre**, anche se vuoto ("Nessun problema"). Contiene tutto ciò che non hai potuto
   rappresentare fedelmente, i dubbi e le funzionalità mancanti (formato in §10). Questo report verrà passato allo
   sviluppatore che amplierà il programma.
3. Un breve riepilogo: numero di capitoli, attività, parti per tipo, media inclusi/mancanti.

---

## 2. Struttura del file `.sdbook`

È un **archivio ZIP** (estensione cambiata in `.sdbook`) con `book.json` **nella radice** (non dentro una sottocartella):

```
book.json                                 ← obbligatorio
cover.jpg                                 ← copertina del libro (facoltativa: jpg, png, webp, svg)
chapters/<moduleId>/module.json           ← un capitolo = un modulo completo
chapters/<moduleId>/assets/img/…          ← immagini del capitolo
chapters/<moduleId>/assets/audio/…        ← audio del capitolo
chapters/<moduleId>/assets/video/…        ← video del capitolo
```

Regole:
- Il nome della cartella `chapters/<moduleId>/` deve essere **identico** all'`id` scritto nel suo `module.json`.
- Ogni capitolo è autonomo: i percorsi dei media (`src`, `cover`, `image`) sono **relativi alla cartella del capitolo**
  (es. `"assets/img/p41-ristorante.jpg"`), mai assoluti, mai `../`, mai URL `file://`.
- Un file usato da due capitoli va **copiato** in entrambi.
- Formati accettati: immagini `jpg jpeg png webp gif svg`; audio `mp3 m4a ogg wav`; video `mp4 webm`.
  Nient'altro (niente PDF, HEIC, TIFF, AVI…): converti prima.
- Nomi file: solo minuscole, cifre, `-`, `_`, `.`; niente spazi né accenti.
- Non includere `.DS_Store`, `__MACOSX`, `Thumbs.db`.
- Codifica JSON: **UTF-8**, senza BOM, JSON valido (niente commenti, niente virgole finali).

Creazione dello ZIP (dalla cartella di lavoro che contiene `book.json`):

```bash
cd build && zip -r -X ../nome-libro.sdbook book.json cover.jpg chapters -x "*.DS_Store" -x "__MACOSX/*"
```

---

## 3. Regole sui tipi JSON (importantissimo)

L'app macOS decodifica il JSON in modo **rigido**: un tipo sbagliato fa scartare l'intero capitolo
("capitolo non leggibile"). Rispetta esattamente questi tipi:

| Campo | Tipo | Esempio corretto | Errore tipico |
|---|---|---|---|
| `formatVersion` | intero | `1` | `"1"` |
| `version` | stringa | `"1.0.0"` | `1` |
| `chapters[].number` (book.json) | stringa | `"3"` | `3` |
| `book.chapter` (module.json) | stringa | `"3"` | `3` |
| `book.order` | intero | `3` | `"3"` |
| `activity.number` | stringa | `"4"` | `4` |
| `activity.page` | intero | `41` | `"41"`, `"41-42"` |
| `part.label` | stringa | `"A"` | — |
| `part.points` | numero | `2` | `"2"` |
| `choice.answer` | intero o array di interi | `1`, `[0,2]` | `"b"` |
| `truefalse.statements[].answer` | booleano | `true` | `"vero"` |
| `table.rows`, `info.table.rows` | array di array di **stringhe** | `[["io","[[sono]]"]]` | celle `null` o numeri → usa `""` / `"3"` |
| `crossword.rows`, `cols`, `row`, `col`, `number` | interi | `10` | `"10"` |
| `open.prompts[].lines` | intero | `3` | — |

Campi **obbligatori** (se mancano, il capitolo non si legge):
- `book.json`: `format`, `formatVersion`, `id`, `version`, `title`, `chapters` (array, anche vuoto).
- `module.json`: `format`, `formatVersion`, `id`, `version`, `title`, `sections`.
- ogni sezione: `id`, `title`, `activities` (array).
- ogni attività: `id`, `title`, `parts` (almeno una).
- ogni parte: `id`, `type`.
- ogni media: `type`.
- `dialogue[]`: `text`; `statements[]`: `text` e `answer`; `questions[]`: `options` e `answer`;
  `objectives[]`: `title` e `items`; `crossword.entries[]`: `number`, `direction`, `row`, `col`, `answer`.

**Non aggiungere campi non documentati**: l'app macOS li elimina in silenzio quando installa il libro.
Se ti servirebbe un campo in più, mettilo nel report.

---

## 4. Identificatori

- `id` del libro: kebab-case, solo `a-z 0-9 -`, stabile (es. `nuovo-espresso-plus-1`). Reimportare lo stesso id
  **aggiorna** il libro, quindi non cambiarlo tra una versione e l'altra.
- `id` del capitolo (modulo): `<id-libro>-u03` per le unità, `<id-libro>-r01` per i ripassi, `<id-libro>-c00` per
  introduzioni ecc. Univoco in tutto il libro.
- `id` delle sezioni: univoco nel modulo (es. `lezione`, `esercizi`, `video`).
- `id` delle attività: univoco nel modulo, es. `u03-a04` (unità 3, attività 4), `u03-e12` (esercizio 12 dell'eserciziario).
- `id` delle parti: **univoco in tutto il modulo** (non solo nell'attività), es. `u03-a04-a`, `u03-a04-b`.
  Gli id delle parti sono la chiave dei progressi degli studenti: non cambiarli in versioni successive del libro.

---

## 5. `book.json`

```json
{
  "format": "studydesk-book",
  "formatVersion": 1,
  "id": "nuovo-espresso-plus-1",
  "version": "1.0.0",
  "title": "Nuovo Espresso Plus 1",
  "subtitle": "Corso di italiano · A1",
  "publisher": "ALMA Edizioni",
  "level": "A1",
  "language": "it",
  "color": "#6aaa3a",
  "cover": "cover.jpg",
  "description": "Breve descrizione del libro.",
  "author": { "name": "Nome di chi ha preparato il file", "email": "email@esempio.it" },
  "chapters": [
    { "moduleId": "nuovo-espresso-plus-1-u01", "number": "1", "title": "Primi contatti", "kind": "unit" },
    { "moduleId": "nuovo-espresso-plus-1-r01", "number": "1-3", "title": "Facciamo il punto 1", "kind": "review" }
  ]
}
```

- `chapters` è l'**ordine di lettura**: elenca ogni capitolo una volta, nell'ordine del libro.
- `kind`: `"unit"` (unità normale) o `"review"` (capitolo di ripasso / bilancio). Nessun altro valore.
- `color`: esadecimale `#rrggbb` (6 cifre). Sceglilo dal colore dominante della copertina.
- `cover`: percorso del file nella radice dello ZIP; ometti il campo o lascia `""` se non c'è copertina.

---

## 6. `module.json` (un capitolo)

```json
{
  "format": "studydesk-module",
  "formatVersion": 1,
  "id": "nuovo-espresso-plus-1-u03",
  "version": "1.0.0",
  "title": "Buon appetito!",
  "subtitle": "Nuovo Espresso Plus 1 · Unità 3",
  "course": "Nuovo Espresso Plus 1",
  "level": "A1",
  "language": "it",
  "color": "#7cb342",
  "cover": "assets/img/cover.jpg",
  "description": "Al bar e al ristorante; verbi regolari in -are.",
  "author": { "name": "…", "email": "…" },
  "createdAt": "2026-11-01T00:00:00Z",
  "book": { "id": "nuovo-espresso-plus-1", "title": "Nuovo Espresso Plus 1", "chapter": "3", "order": 3 },
  "objectives": [
    { "title": "Comunicazione", "items": ["Ordinare al bar", "Chiedere il conto"] },
    { "title": "Grammatica", "items": ["Presente dei verbi in -are"] }
  ],
  "sections": [
    { "id": "lezione",  "title": "Lezione",     "icon": "book-open", "part": "main",      "activities": [] },
    { "id": "esercizi", "title": "Eserciziario", "icon": "pen",       "part": "exercises", "activities": [] },
    { "id": "video",    "title": "Videocorso",  "icon": "video",     "part": "video",     "activities": [] }
  ]
}
```

- `book` deve coincidere con il libro: stesso `id` e `title`, `chapter` = `number` in `book.json`, `order` = posizione 1-based.
- `cover` del capitolo: immagine della pagina d'apertura dell'unità (ritagliata), se disponibile.
- `part` della sezione: `"main"` (pagine dell'unità) | `"exercises"` (eserciziario) | `"video"` (videocorso).
  L'app mostra le tre schede «Capitolo», «Esercizi», «Videocorso». Ometti le sezioni vuote.
- `icon`: uno tra `book-open`, `video`, `pen`, `globe`, `mug-hot`, `flag-checkered`, `spell-check`, `flag`.
- Puoi usare più sezioni con lo stesso `part` (es. «Lezione», «Grammatica», «Cultura» tutte `main`).

### Attività (= un esercizio numerato del libro)

```json
{
  "id": "u03-a04",
  "number": "4",
  "title": "Al ristorante",
  "instructions": "Ascolta il dialogo e rispondi.",
  "page": 41,
  "skills": ["ascolto", "lettura"],
  "media": [ { "type": "audio", "src": "assets/audio/03-02.mp3", "label": "Traccia 3.2" } ],
  "parts": [ /* una o più parti, vedi §7 */ ]
}
```

- `skills`: solo tra `ascolto`, `lettura`, `scrittura`, `parlato`, `grammatica`, `lessico`.
- `title`: se il libro non dà un titolo, usa una descrizione breve (es. «Completa i dialoghi»).
- Un'attività con punti a/b/c del libro diventa **un'attività con più parti** (`label` `"a"`, `"b"`, `"c"` o `"A"`…).
- I media dell'attività (`media`) valgono per tutte le parti; quelli di una sola parte vanno nella parte.

### Media

```json
{ "type": "image", "src": "assets/img/p41-menu.jpg", "alt": "Menu del ristorante", "caption": "Il menu",
  "view": { "crop": [0.1, 0, 0.8, 1], "width": 420, "align": "center" } }
{ "type": "audio", "src": "assets/audio/03-02.mp3", "label": "Traccia 3.2", "transcript": "Cameriere: Buonasera…" }
{ "type": "video", "src": "assets/video/ep03.mp4", "label": "Videocorso 3", "transcript": "…" }
{ "type": "video", "url": "https://…", "label": "Episodio 3" }
{ "type": "video", "placeholder": true, "label": "Videocorso 3 (da aggiungere)" }
```

- `view` è facoltativo: `crop` = `[x, y, larghezza, altezza]` come frazioni 0–1 dell'immagine; `width` = larghezza
  massima in punti; `align` = `leading` | `center` | `trailing`. Preferisci però ritagliare l'immagine già nel file.
- Audio o video citati dal libro ma **non forniti**: usa `"placeholder": true` (solo video) oppure ometti il media e
  **segnalalo nel report** con la traccia/pagina. Per l'audio non esiste un segnaposto: mettilo nel report.
- `transcript`: inseriscilo quando la trascrizione è nel libro (di solito in appendice).
- `wordTimes`: non scriverlo mai a mano; si calcola dopo con `scripts/align_audio.py` (vedi MODULE_FORMAT.md).
- Non mettere nelle immagini le soluzioni degli esercizi: ritaglia solo la parte utile (illustrazioni, foto, testi).

---

## 7. Tipi di parte (esercizi)

Campi comuni a tutte: `id`, `type`, `label` (facoltativo), `instructions` (facoltativo), `media` (facoltativo),
`points` (facoltativo). Esistono **solo** questi tipi:

### `info` — testo, dialoghi, box di grammatica, letture (non valutato)
```json
{ "id": "u03-a01-a", "type": "info", "label": "A",
  "content": "**Al bar** si ordina così:\n\n- un caffè\n- un cappuccino",
  "dialogue": [ { "speaker": "Barista", "text": "Prego?" }, { "speaker": "Cliente", "text": "Un caffè, per favore." } ],
  "table": { "headers": ["", "parlare"], "rows": [["io", "parlo"], ["tu", "parli"]] } }
```

### `choice` — scelta singola o multipla
```json
{ "id": "u03-a02-a", "type": "choice",
  "questions": [
    { "prompt": "Che cosa ordina Paolo?", "options": ["un tè", "un caffè", "una birra"], "answer": 1 },
    { "prompt": "Cosa c'è nel menu?", "options": ["pasta", {"text": "pizza", "image": "assets/img/pizza.jpg"}, "pesce"], "answer": [0, 2] }
  ] }
```
`answer` = indice da 0; array = risposte multiple (tutte obbligatorie).

### `truefalse` — vero/falso, sì/no
```json
{ "id": "u03-a02-b", "type": "truefalse", "labels": ["vero", "falso"],
  "statements": [ { "text": "Paolo è a Roma.", "answer": true }, { "text": "Anna non mangia.", "answer": false } ] }
```

### `gapfill` — completare frasi
```json
{ "id": "u03-a05-a", "type": "gapfill", "layout": "lines",
  "wordBank": ["mangio", "bevi", "prende"],
  "items": [ { "text": "Io [[mangio]] la pasta." }, { "text": "Tu cosa [[bevi|prendi]]?" }, { "text": "Scrivi un nome: [[]]" } ] }
```
- `[[risposta]]` lacuna; `[[a|b]]` alternative accettate; `[[]]` lacuna libera (non corretta automaticamente).
- `layout`: `"lines"` (una frase per riga) | `"paragraph"` (testo continuo).
- Gli `items` possono essere stringhe semplici o oggetti `{text, media}`.
- Non usare `[[` `]]` o `|` come testo normale dentro una lacuna.

### `match` — collegare
```json
{ "id": "u03-a06-a", "type": "match",
  "left":  [ {"id": "l1", "text": "Buongiorno"}, {"id": "l2", "image": "assets/img/caffe.jpg"} ],
  "right": [ {"id": "r1", "text": "Good morning"}, {"id": "r2", "text": "caffè"} ],
  "pairs": [ ["l1", "r1"], ["l2", "r2"] ] }
```

### `categorize` — classificare
```json
{ "id": "u03-a07-a", "type": "categorize", "categories": ["maschile", "femminile"],
  "items": [ {"text": "vino", "category": "maschile"}, {"text": "acqua", "category": "femminile"},
             {"text": "cantante", "category": ["maschile", "femminile"]} ] }
```
`category` deve essere scritto **esattamente** come in `categories`.

### `order` — mettere in ordine
```json
{ "id": "u03-a08-a", "type": "order", "items": ["Buonasera.", "Buonasera, un tavolo per due?", "Sì, prego."] }
```
Elenca gli elementi nell'ordine **corretto**: l'app li mescola.

### `table` — tabella da completare
```json
{ "id": "u03-a09-a", "type": "table", "headers": ["", "mangiare", "bere"],
  "rows": [ ["io", "[[mangio]]", "[[bevo]]"], ["tu", "[[mangi]]", "bevi"] ] }
```
Le celle usano la stessa sintassi `[[…]]` di `gapfill`; tutte le celle sono stringhe (usa `""` per le vuote).

### `open` — risposta libera scritta (corretta dall'insegnante)
```json
{ "id": "u03-a10-a", "type": "open",
  "prompts": [ {"text": "Descrivi il tuo piatto preferito.", "lines": 4} ],
  "sample": "Il mio piatto preferito è…" }
```

### `speaking` — attività orale / di coppia / di gruppo (corretta dall'insegnante)
```json
{ "id": "u03-a11-a", "type": "speaking", "content": "In coppia: A è il cameriere, B il cliente.", "record": true,
  "sample": "Buonasera, cosa prende?" }
```
`record: true` permette allo studente di registrare la voce.

### `crossword` — cruciverba
```json
{ "id": "u03-e15-a", "type": "crossword", "rows": 8, "cols": 10,
  "entries": [
    { "number": 1, "direction": "across", "row": 0, "col": 2, "answer": "PIZZA", "clue": "Si mangia a Napoli" },
    { "number": 2, "direction": "down",   "row": 0, "col": 4, "answer": "ZUCCHERO", "clue": "Nel caffè" }
  ],
  "solutionWord": { "label": "Parola misteriosa", "cells": [[0, 2], [1, 4]] } }
```
- `row`/`col` partono da 0; le parole che si incrociano devono avere la **stessa lettera** nella cella comune
  e stare dentro la griglia (`row`+lunghezza ≤ `rows` per `down`, `col`+lunghezza ≤ `cols` per `across`).
- Verifica sempre gli incroci prima di consegnare.

### Markdown e confronto risposte
- In `content`, `prompt`, `text`: solo `**grassetto**`, `*corsivo*`, `__sottolineato__`, elenchi `- `, a capo con riga
  vuota (`\n\n`). Niente HTML, titoli `#`, link, tabelle Markdown, immagini Markdown.
- Le risposte vengono confrontate ignorando maiuscole e spazi multipli, con `’` = `'`; gli accenti contano.
  Scrivi le soluzioni con gli accenti corretti e aggiungi le varianti accettabili con `|`.

---

## 8. Come mappare il libro

| Nel libro | In StudyDesk |
|---|---|
| Unità / lezione | un capitolo (`module.json`), `kind: "unit"` |
| Ripasso, «Facciamo il punto», test | un capitolo, `kind: "review"` |
| Pagine dell'unità | sezione/i `part: "main"` |
| Eserciziario dell'unità | sezione `part: "exercises"` (nello **stesso** capitolo dell'unità) |
| Videocorso dell'unità | sezione `part: "video"` |
| Esercizio numerato | attività (`number`, `page`) |
| Punti a, b, c dell'esercizio | parti dell'attività |
| Testo da leggere, dialogo, box grammatica, immagine introduttiva | parte `info` |
| Esercizio di ascolto | media `audio` sull'attività + parte del tipo adatto |
| Soluzioni in appendice | nei campi `answer` / `[[…]]` / `pairs` / `sample` — **mai** visibili nel testo |
| Trascrizioni in appendice | `transcript` del media audio/video |
| Glossario, appendici grammaticali | capitolo a parte con parti `info` (`kind: "unit"`), oppure report se non adatto |

Scelta del tipo:
1. Esiste una soluzione univoca? → tipo automatico (`choice`, `truefalse`, `gapfill`, `match`, `categorize`, `order`, `table`, `crossword`).
2. Risposta libera scritta → `open` (metti `sample` se il libro dà un esempio).
3. Attività orale, di coppia, gioco di ruolo → `speaking`.
4. Solo lettura/osservazione → `info`.
5. Nessuno di questi rappresenta bene l'esercizio → usa il tipo più vicino **e** segnalalo nel report
   (es. «sottolinea le parole», «cerchia l'intruso», «disegna», «collega a un'immagine con più punti»,
   «cruciverba a schema irregolare», «gioco dell'oca»).

Fedeltà:
- Trascrivi consegne e testi **esattamente** (stessi accenti, punteggiatura, nomi). Non riscrivere, non tradurre.
- Se il libro non contiene le soluzioni di un esercizio, deducile solo se sono certe; altrimenti usa `[[]]` / `open`
  e segnalalo nel report («soluzione non presente nel libro»).
- Se una parte della pagina è illeggibile, non inventare: segnalala nel report con pagina ed esercizio.
- Converti solo materiale che chi ti ha dato il libro ha il diritto di usare; nel dubbio, chiedilo nel report.

---

## 9. Procedura consigliata e controllo finale

1. Leggi tutto il libro e prepara l'indice: capitoli, `kind`, numeri, pagine.
2. Scrivi `book.json`.
3. Per ogni capitolo: estrai/ritaglia le immagini, associa le tracce audio, scrivi `module.json`.
4. Esegui il controllo finale (se puoi, con uno script):
   - [ ] Ogni `module.json` e `book.json` è JSON valido UTF-8.
   - [ ] `format`, `formatVersion: 1`, `id`, `version`, `title` presenti ovunque; `chapters` e `sections` sono array.
   - [ ] Tipi della tabella §3 rispettati (soprattutto `number`, `chapter`, `page`, `formatVersion`).
   - [ ] Ogni `chapters[].moduleId` ha la sua cartella `chapters/<moduleId>/module.json` con lo stesso `id`.
   - [ ] Nessun id di parte duplicato nello stesso modulo; ogni attività ha almeno una parte.
   - [ ] Ogni `src` / `image` / `cover` esiste nello ZIP con quel percorso esatto (maiuscole comprese) e ha un'estensione ammessa.
   - [ ] `choice.answer` è dentro il numero di `options`; `pairs` usano id esistenti; `category` esiste in `categories`.
   - [ ] Cruciverba: incroci coerenti, parole dentro la griglia.
   - [ ] Nessun campo inventato, nessun HTML nei testi.
   - [ ] `book.json` è nella radice dello ZIP; niente `.DS_Store` / `__MACOSX`.
5. Se possibile, importa il file in StudyDesk (Libreria → Importa, o doppio clic sul `.sdbook`) e apri ogni capitolo.
   In caso di errore, l'app indica il capitolo non leggibile: correggi e ripeti.
6. Scrivi il report.

---

## 10. Report per lo sviluppatore (`REPORT_STUDYDESK.md`)

Scrivi il report **ogni volta** che qualcosa non è chiaro, il formato non basta, o hai dovuto approssimare.
Non bloccare il lavoro: usa la soluzione più vicina tra quelle esistenti, segna il punto nel report e prosegui.
Il report viene consegnato allo sviluppatore che amplierà StudyDesk, quindi deve essere concreto e verificabile.

Struttura:

```markdown
# Report conversione – <titolo libro> (<id libro>), versione <version>

## Riepilogo
- Capitoli: N (unità X, ripassi Y) · Attività: N · Parti per tipo: info N, choice N, gapfill N, …
- Media: immagini N, audio N (mancanti N), video N (mancanti N)

## 1. Funzionalità mancanti (richieste di ampliamento)
Per ogni voce:
- **Titolo breve** (es. «Esercizio "sottolinea la parola giusta"»)
- Dove: capitolo `<moduleId>`, attività `<id>`, pagina N (quante volte compare nel libro: N)
- Cosa chiede il libro: descrizione precisa dell'esercizio e di come si risolve
- Come l'ho rappresentato ora: tipo usato e limiti (cosa si perde)
- Proposta: nuovo tipo o campo, con un esempio JSON di come lo vorresti
  (es. `{ "type": "highlight", "text": "…", "answer": [3, 7] }`)
- Priorità suggerita: alta (molto frequente / perdita importante) · media · bassa

## 2. Punti non chiari del formato
- Domanda precisa, il caso concreto che l'ha generata, la scelta che ho fatto per ora.

## 3. Contenuti incompleti o approssimati
- Soluzioni assenti nel libro, pagine illeggibili, audio/video non forniti (con numero traccia),
  immagini non ritagliabili, testo non trascritto. Per ognuno: capitolo, attività, pagina.

## 4. Scelte di mappatura
- Decisioni non ovvie (es. «glossario messo come capitolo separato», «esercizi 3a e 3b uniti»).

## 5. Esito della verifica
- Controlli del §9 superati / falliti; eventuale esito dell'importazione in StudyDesk e messaggi d'errore esatti.
```

Regole del report:
- Una voce per problema; raggruppa le occorrenze uguali indicando tutte le posizioni.
- Cita sempre id e pagina, così lo sviluppatore ritrova il caso.
- Distingui ciò che è un **limite del programma** (§1) da ciò che è un **problema del materiale** (§3).
- Non modificare il formato di tua iniziativa per aggirare un limite: proponilo nel report.
