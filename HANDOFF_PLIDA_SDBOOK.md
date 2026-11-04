# Compito per Antigravity (Gemini): convertire i Quaderni del PLIDA in libri StudyDesk `.sdbook`

Data: 1 novembre 2026. Richiesto da Guaira Jaramillo Nitoglia (proprietaria dei libri e del progetto StudyDesk).
Preparato da Claude (Claude Code), che verificherà il risultato e amplierà StudyDesk in base al tuo report.

## 1. Leggi prima
- **`StudyDesk/docs/AI_ISTRUZIONI_SDBOOK.md`** — specifica completa del formato `.sdbook`: seguila alla lettera.
- Esempio funzionante: `StudyDesk/tests/fixtures/sample.sdbook` (aprilo con `unzip -l` / `unzip -p`).

## 2. Materiale (sola lettura: NON modificare, spostare o cancellare nulla qui)
Cartella sorgente:
`/Users/guaira/Library/CloudStorage/GoogleDrive-guaira.jaramillo.nitoglia@gmail.com/My Drive/Italiano/Biblioteca/Esami di certificazione/PLIDA/Quaderni del PLIDA - Nuovo Esame/`

| Livello | PDF | Audio |
|---|---|---|
| A2 | `A2.pdf` | `A2_Audio/01.mp3 … 20.mp3` |
| B1 | `B1.pdf` | `B1_Audio/Audio_esercizi/…` + `B1_Audio/Prova_esame_B1.mp3` |
| B2 | `B2.pdf` | `B2_Audio/01.mp3 … 16.mp3` |
| C1 | `C1.pdf` | `C1_Audio/01.mp3 … 15.mp3` + `C1_Audio/prova_esame_C1.mp3` |

Ignora `Preparazione PLIDA B1.gslides` e `.DS_Store`.

## 3. Cosa produrre
Cartella di lavoro e di consegna (creala):
`…/Quaderni del PLIDA - Nuovo Esame/StudyDesk_sdbook/` (dentro la cartella sorgente qui sopra)

Per ogni livello (fai **un libro alla volta**, nell'ordine A2 → B1 → B2 → C1, e completa ciascuno prima del successivo):
- `StudyDesk_sdbook/<livello>/build/` — cartella con `book.json`, `cover.*`, `chapters/…` (non zippata, utile per i controlli)
- `StudyDesk_sdbook/quaderni-plida-<livello>.sdbook` — es. `quaderni-plida-a2.sdbook`
- `StudyDesk_sdbook/REPORT_STUDYDESK_<livello>.md` — report nel formato del §10 delle istruzioni (sempre, anche se breve)

Identificatori: id libro `quaderni-plida-a2`, `quaderni-plida-b1`, `quaderni-plida-b2`, `quaderni-plida-c1`.
Titolo: «Quaderni del PLIDA – <Livello>» (usa il titolo esatto stampato in copertina se diverso). `level` = `A2`/`B1`/`B2`/`C1`,
`language` = `it`. `author` = `{ "name": "Guaira Jaramillo Nitoglia", "email": "guaira.jaramillo.nitoglia@gmail.com" }`.

## 4. Come mappare questi quaderni
- Sono quaderni di preparazione all'esame PLIDA: di solito una parte per abilità (Ascoltare, Leggere, Scrivere, Parlare)
  con esercizi, poi una **prova d'esame completa**, poi chiavi/soluzioni e trascrizioni. Verifica la struttura reale
  dall'indice del PDF prima di decidere.
- Un capitolo (`module.json`) per ogni sezione principale dell'indice (es. una per abilità) con `kind: "unit"`;
  la prova d'esame completa come capitolo con `kind: "review"`.
- Usa le **chiavi** in fondo al libro per riempire le risposte, e le **trascrizioni** per i `transcript` degli audio.
  Le chiavi e le trascrizioni NON vanno mostrate come capitoli a sé.
- Associa ogni traccia mp3 all'esercizio giusto (il numero di traccia è stampato vicino all'esercizio). Copia il file mp3 in
  `chapters/<moduleId>/assets/audio/` con un nome chiaro (es. `traccia-03.mp3`). Se una traccia non si riesce ad associare,
  segnalala nel report.
- Prove di scrittura e di produzione orale → `open` / `speaking` (`record: true`), con `sample` se il libro dà un modello.
- Immagini: ritaglia dalle pagine del PDF solo ciò che serve (foto, illustrazioni, documenti autentici da leggere), in jpg o png.
  Copertina del libro = prima pagina del PDF (`cover.jpg`, circa 900 px di altezza). Puoi usare Python con PyMuPDF (`pip install pymupdf`)
  in un virtualenv creato nella cartella `StudyDesk_sdbook/.venv` (non installare nulla a livello di sistema).
- Fedeltà assoluta al testo: trascrivi consegne e testi esattamente, con gli accenti giusti.

## 5. Regole
- **Non modificare il codice di StudyDesk né altri file del repository** (`Project 0`). Lavora solo dentro `StudyDesk_sdbook/`.
  Se il formato non basta, scrivilo nel report: lo amplierà Claude.
- Non fare commit, push o pubblicazioni.
- Prima di consegnare ogni libro esegui tutti i controlli del §9 delle istruzioni con uno script (Python o Node): JSON valido,
  tipi corretti (soprattutto `number`/`chapter` stringhe, `page`/`formatVersion` interi), id delle parti univoci, ogni file media
  esistente con il percorso esatto, `book.json` nella radice dello ZIP. Scrivi l'esito nel report (§5 del report).
- Se un PDF è troppo grande per leggerlo tutto insieme, lavora per intervalli di pagine.
- Alla fine scrivi `StudyDesk_sdbook/RIEPILOGO.md`: per ogni livello capitoli, attività, parti per tipo, tracce associate/mancanti,
  e l'elenco delle funzionalità mancanti più importanti (raccolte dai quattro report).
