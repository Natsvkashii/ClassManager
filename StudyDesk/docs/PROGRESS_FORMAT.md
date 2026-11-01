# StudyDesk – Progressi e correzione (contratto comune macOS / Windows / Android)

## Correzione automatica (identica su tutte le piattaforme)

`normalize(s)`: minuscolo → `’ ‘ ´ \`` diventano `'` → spazi multipli → uno → trim → rimuove `.`, `!`, `?`, `,`, `;`, `:` finali.

Una risposta a lacuna è:
- **corretta** se `normalize(risposta) == normalize(una delle alternative)`;
- **quasi** (`close`) se coincide solo togliendo gli accenti (diacritici) → vale 0 punti ma viene segnalata in giallo;
- **sbagliata** altrimenti. La lacuna libera `[[]]` non vale punti.

Punteggio per tipo:
| type | maxScore | score |
|---|---|---|
| choice | n. domande | 1 per domanda con insieme di indici esattamente uguale |
| truefalse | n. affermazioni | 1 per affermazione giusta |
| gapfill / table | n. lacune non libere | 1 per lacuna corretta |
| match | n. coppie | 1 per coppia giusta |
| categorize | n. elementi | 1 per elemento in categoria accettata |
| order | n. elementi | 1 per elemento in posizione giusta |
| crossword | n. parole | 1 per parola con tutte le lettere giuste (confronto come le lacune) |
| open / speaking / info | 0 | – (stato `submitted`, da valutare dall'insegnante) |

`status`: `correct` (score == max), `partial` (0 < score < max), `wrong` (score 0, max > 0), `submitted` (max 0, risposta data).
Una parte è **completata** quando ha uno status.

## Forma delle risposte (`answer`)

| type | answer |
|---|---|
| choice | `[[indici scelti] per ogni domanda]` |
| truefalse | `[true \| false \| null, …]` |
| gapfill | `[[stringa per lacuna] per ogni item]` |
| table | `[[stringa per lacuna] per ogni riga]` (solo celle con lacuna, in ordine) |
| match | `{ "leftId": "rightId", … }` |
| categorize | `["categoria" \| null, …]` |
| order | `[indice originale, …]` nell'ordine dato dallo studente |
| crossword | `{ "1-across": "MENU", "2-down": "…" }` (lettere inserite, spazi per le caselle vuote) |
| open | `["testo", …]` uno per prompt |
| speaking | `{ "text": "…", "recording": "nomefile.m4a" \| null }` |

## File esportato `.sdprogress.json`

```jsonc
{
  "format": "studydesk-progress",
  "formatVersion": 1,
  "app": { "name": "StudyDesk", "version": "26.10.0-001", "platform": "macos" },   // macos | windows | android | web
  "exportedAt": "2026-10-30T12:00:00Z",
  "student": { "id": "uuid", "firstName": "…", "lastName": "…", "email": "…" },
  "modules": [
    {
      "id": "nuovo-espresso-plus-1-u03", "version": "1.0.0", "title": "Buon appetito!",
      "stats": { "completedParts": 40, "totalParts": 90, "score": 120, "maxScore": 150, "pendingReview": 6 },
      "results": [
        {
          "activityId": "l03-a4", "partId": "l03-a4-a", "type": "truefalse",
          "answer": [true, false], "score": 1, "maxScore": 2, "status": "partial",
          "attempts": 2, "updatedAt": "2026-10-30T11:58:00Z",
          "recording": "data:audio/mp4;base64,…"   // solo speaking, opzionale
        }
      ]
    }
  ]
}
```

## Invio all'insegnante

1. **Salva file** – `.sdprogress.json` da allegare o caricare su qualsiasi piattaforma.
2. **Invia a un indirizzo web** – `POST` del JSON sopra (`Content-Type: application/json`) all'URL impostato in *Impostazioni → Insegnante* (es. un Google Apps Script, un webhook, o in futuro ClassDesk).
3. **Email** – apre il client di posta verso l'email dell'insegnante con un riepilogo; il file salvato va allegato.
