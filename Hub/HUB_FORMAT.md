# DeskHub – scambio di gruppi e studenti tra ClassDesk e StudyDesk

L'Hub è un archivio condiviso sul computer, letto e scritto da entrambe le app. Ogni app **pubblica** i propri gruppi
(con gli studenti) e può **importare** quelli dell'altra; i gruppi importati restano collegati e si aggiornano da soli.

## Dove si trova

| Sistema | File |
|---|---|
| macOS | `~/Library/Application Support/DeskHub/hub.json` |
| Windows | `%APPDATA%\DeskHub\hub.json` |

Le scritture sono atomiche (file temporaneo + rinomina). Su macOS si usa `NSFileCoordinator`; entrambe le app osservano il file
e ricaricano quando cambia. Chi scrive aggiorna solo i propri record e conserva quelli dell'altra app.

## Formato

```jsonc
{
  "format": "deskhub", "formatVersion": 1, "updatedAt": "ISO",
  "students": [
    { "id": "hub-st-…", "firstName": "Mario", "lastName": "Rossi", "email": "mario@…",
      "refs": { "classdesk": "st-ab12cd", "studydesk": "stu-98ef01" },      // id dello studente in ciascuna app (se esiste)
      "updatedAt": "ISO", "updatedBy": "classdesk" }
  ],
  "groups": [
    { "id": "hub-gr-…", "name": "Italiano sera › A1 › Martedì 19:00", "level": "A1",
      "owner": "classdesk",                                                  // app che ha creato il gruppo (fonte di verità)
      "refs": { "classdesk": { "courseId": "crs-…", "levelId": "lvl-…", "moduleId": "mod-…" }, "studydesk": "grp-…" },
      "studentIds": ["hub-st-…"],                                           // id Hub degli studenti
      "updatedAt": "ISO", "updatedBy": "classdesk" }
  ]
}
```

## Regole

1. **Pubblicare**: a ogni salvataggio un'app inserisce o aggiorna i gruppi di cui è proprietaria (trovati con `refs.<app>`)
   e i loro studenti (abbinati per `refs.<app>`, poi per email). Un gruppo eliminato nell'app proprietaria viene tolto dall'Hub.
2. **Importare**: un'app mostra i gruppi dell'altra non ancora collegati («Disponibili dall'Hub»). Importando, crea il gruppo
   nel proprio formato e scrive il proprio riferimento in `refs.<app>`.
   - StudyDesk: crea un gruppo con gli studenti (`classDesk` link compilato).
   - ClassDesk: crea un corso di gruppo con un livello e un modulo che contiene gli studenti (aggiunti all'anagrafica se mancano).
3. **Aggiornare**: quando l'Hub cambia, ogni app aggiorna l'elenco studenti dei gruppi collegati di cui **non** è proprietaria
   (aggiunge i nuovi, aggiorna nome ed email; non elimina dati come voti, presenze o risultati).
4. Gli studenti hanno un solo record Hub anche se compaiono in più gruppi.

## Implementazioni

- `swift/DeskHub.swift` – libreria usata da ClassDesk per Mac e StudyDesk per Mac (stesso file, incluso nella compilazione).
- `js/deskhub.js` – stessa logica in JavaScript per StudyDesk Windows (Electron, via IPC) e ClassDesk Windows (WebView2, via binding nativi).
- Sincronizzazione tra computer diversi: l'Hub è locale; per più dispositivi si usa la sincronizzazione in rete di StudyDesk
  (gruppi e studenti) e iCloud di ClassDesk.
