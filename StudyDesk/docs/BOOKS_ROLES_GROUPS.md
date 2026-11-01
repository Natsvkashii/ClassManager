# StudyDesk – Libri, ruoli e gruppi (contratto comune macOS / Windows / Android)

## 1. Libri divisi in capitoli

Un **libro** raggruppa più moduli: ogni capitolo è un modulo `.sdmod` normale (vedi `MODULE_FORMAT.md`).

### Campo `book` nel `module.json` (facoltativo)

```jsonc
"book": { "id": "nuovo-espresso-plus-1", "title": "Nuovo Espresso Plus 1", "chapter": "3", "order": 3 }
```

Un modulo con `book.id` viene mostrato dentro quel libro, ordinato per `order` (poi `chapter`). I moduli senza `book`
compaiono in «Moduli singoli». Importare un singolo capitolo con `book` crea il libro se non esiste ancora
(titolo da `book.title`, copertina = copertina del primo capitolo).

### File libro `.sdbook`

ZIP con:

```
book.json
cover.jpg                       ← copertina del libro (facoltativa)
chapters/<moduleId>/module.json ← un capitolo = un modulo completo con i suoi assets/
chapters/<moduleId>/assets/…
```

```jsonc
// book.json
{
  "format": "studydesk-book", "formatVersion": 1,
  "id": "nuovo-espresso-plus-1", "version": "1.0.0",
  "title": "Nuovo Espresso Plus 1", "subtitle": "Corso di italiano · A1",
  "publisher": "ALMA Edizioni", "level": "A1", "language": "it", "color": "#6aaa3a",
  "cover": "cover.jpg", "description": "…",
  "author": { "name": "…", "email": "…" },
  "chapters": [ { "moduleId": "nuovo-espresso-plus-1-u03", "number": "3", "title": "Buon appetito!", "kind": "unit" } ]
}
```

`kind` (facoltativo): `"unit"` (capitolo con le parti Capitolo / Esercizi / Videocorso) o `"review"` (capitolo di ripasso, es. «Facciamo il punto», mostrato con un'etichetta diversa).

L'importazione installa ogni cartella di `chapters/` come modulo (impostando `book` se manca) e salva i metadati del libro.
L'esportazione di un libro produce lo stesso ZIP. La copertina di ogni capitolo è il `cover` del suo modulo.

### Home

- La Home mostra i **libri** (copertina grande, titolo, livello, avanzamento) e, sotto, i moduli singoli.
- Clic su un libro: **nella stessa pagina** il libro si apre (animazione di transizione della copertina verso l'intestazione)
  e compare una fila di capitoli che **scorre orizzontalmente**; i capitoli entrano in sequenza come dorsi stretti che
  **si espandono** fino a mostrare la loro copertina (numero, titolo, avanzamento). Il capitolo sotto il puntatore / al centro
  si allarga ancora un po'. Clic su un capitolo → apre il modulo. «Chiudi libro» riporta alla vista dei libri con l'animazione inversa.

## 2. Ruoli

Al **primo avvio**, prima del profilo, l'app chiede: **Sono un insegnante** / **Sono uno studente**. Il ruolo si salva nello stato
(`role: "teacher" | "student"`) e si può cambiare in Impostazioni (passare a insegnante chiede conferma).

| Funzione | Studente | Insegnante |
|---|---|---|
| Libri, moduli, esercizi, progressi personali | ✓ | ✓ (anche per provare le attività) |
| Editor moduli e libri (creazione attività) | – | ✓ |
| Gruppi, collegamento a ClassDesk, risultati degli studenti | – | ✓ |
| Importare l'invito di un gruppo (`.sdgroup`) | ✓ | – |

## 3. Gruppi (insegnante)

```jsonc
{
  "id": "grp-ab12cd", "name": "A1 sera – martedì", "level": "A1", "color": "#0ea5e9", "description": "",
  "students": [ { "id": "stu-…", "firstName": "Mario", "lastName": "Rossi", "email": "mario@…", "classDeskStudentId": "st-…" } ],
  "bookIds": ["nuovo-espresso-plus-1"],          // libri assegnati
  "moduleIds": [],                               // moduli singoli assegnati
  "classDesk": {                                 // facoltativo: collegamento a un gruppo ClassDesk
    "courseId": "crs-…", "courseName": "…", "levelId": "lvl-…", "levelName": "A1", "moduleId": "mod-…", "moduleName": "…",
    "source": "classdesk-local" | "classdesk-backup", "linkedAt": "ISO"
  },
  "createdAt": "ISO"
}
```

### Collegamento a ClassDesk

In ClassDesk un gruppo di studenti è **Corso → Livello → Modulo**: il modulo ha `studentIds`, i dati anagrafici sono in
`studentsDirectory` (`id, firstName, lastName, email`). StudyDesk legge (sola lettura, non modifica mai ClassDesk):

- **macOS**: `~/Library/Application Support/ClassDesk/classdesk_state_v1.json` (o la copia iCloud
  `~/Library/Mobile Documents/com~apple~CloudDocs/ClassDesk/classdesk_state_v1.json`);
- **tutte le piattaforme**: un backup JSON esportato da ClassDesk («Esporta JSON»), stesso formato.

L'insegnante sceglie corso → livello → modulo (i corsi archiviati sono nascosti); gli studenti vengono importati nel gruppo
(nome, cognome, email, `classDeskStudentId`). «Sincronizza da ClassDesk» rilegge la fonte e aggiunge/aggiorna gli studenti
(non rimuove i risultati già ricevuti).

### Invito per gli studenti (`.sdgroup`)

JSON `{ "format": "studydesk-group-invite", "formatVersion": 1, "groupId", "groupName", "teacher": { "name", "email" },
"uploadUrl", "bookIds", "moduleIds" }`. Lo studente lo importa: imposta email/URL dell'insegnante e salva il gruppo di appartenenza
(il `groupId` viene incluso nel suo `.sdprogress.json` come `"groupId"` accanto a `student`).

### Risultati degli studenti

L'insegnante importa i file `.sdprogress.json` ricevuti (selezione multipla o trascinamento). Ogni file viene abbinato a uno
studente del gruppo per email (se non esiste viene aggiunto) e conservato (l'ultimo per studente sostituisce il precedente).
Viste:
- **tabella del gruppo**: studenti × capitoli/moduli assegnati con % completamento e % risposte corrette, totale «da valutare»;
- **dettaglio studente**: per ogni attività lo stato delle parti, le risposte date (anche i testi liberi e le registrazioni da ascoltare).
