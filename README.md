# ClassDesk Suite – ClassDesk · StudyDesk · HubDesk

Concepito e sviluppato da **Guaira Jaramillo Nitoglia** – guaira.jaramillo.nitoglia@gmail.com – licenza GPL-3.0.

| Cartella | Contenuto |
|---|---|
| [`ClassDesk/`](ClassDesk/) | Gestionale dei corsi (macOS Swift + Windows C++/WebView2). Build: `cd ClassDesk && python3 manage_version.py …` |
| [`StudyDesk/`](StudyDesk/) | Esercizi interattivi, libri, gruppi, Lavagna (macOS SwiftUI, Windows Electron, Android Capacitor). Build: `cd StudyDesk && python3 scripts/manage_version.py …` |
| [`Hub/`](Hub/) | **HubDesk**, il centro della suite: installa e aggiorna le app, collega i dispositivi in rete, sincronizza i dati e la lavagna ([`HUBDESK.md`](Hub/HUBDESK.md)); librerie comuni Swift/JS e scambio locale dei gruppi ([`HUB_FORMAT.md`](Hub/HUB_FORMAT.md)). macOS in `Hub/macOS/`, Windows in `Hub/electron/`. |

## Release della suite

Tutte le app hanno la stessa versione `AA.MM.R-BBB` e lo stesso canale. Dalla radice:

```bash
python3 suite.py set 26.11.0-001 --channel unstable
python3 suite.py build          # tutte le app + pacchetto suite macOS + manifest + note di versione in dist/<v>/
python3 suite.py publish        # prova: mostra gli asset nell'ordine di caricamento; con --yes crea la release (GITHUB_TOKEN)
```

L'ordine e i nomi degli asset servono anche agli aggiornatori di ClassDesk 26.10 già installati (vedi `Hub/HUBDESK.md` §6):
così il vecchio ClassDesk passa alla suite con il suo aggiornamento automatico.

`update-manifest.json` nella radice è la copia letta dalle installazioni di ClassDesk già distribuite; `suite.py manifest`
la scrive con le chiavi storiche e la nuova chiave `suite`.
