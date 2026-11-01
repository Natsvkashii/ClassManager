# StudyDesk e HubDesk per Windows in versione nativa leggera – piano

Stato al 26.11.0-004: ClassDesk per Windows è già nativo (C++ + WebView2 di sistema, ~3 MB, `ClassDesk/Windows-Version/native`).
StudyDesk (~111 MB) e HubDesk (~102 MB) usano Electron, che porta con sé un intero Chromium. Obiettivo: stesso modello di
ClassDesk, con l'interfaccia web esistente (`StudyDesk/app`, `Hub/electron/renderer`) dentro WebView2 e un host C++ che
sostituisce il processo principale di Electron. Peso atteso: 2–5 MB per app (WebView2 è già in Windows 10/11).

## 1. Host comune (`Hub/win-host/`)
- Base: `ClassDesk/Windows-Version/native` (finestra, WebView2, bridge `window.__native_*`, installazione da sé con `--silent`,
  chiave Uninstall in HKCU, collegamenti, aggiornamento da sé).
- Cartella dati WebView2 in `%APPDATA%\<App>_Native_Data` (come ClassDesk): **migrazione** da `%APPDATA%\StudyDesk` di Electron:
  IndexedDB e Local Storage hanno un'altra origine (`file://` invece di `app://`), quindi al primo avvio la pagina deve importare i
  dati con il backup ZIP esistente (`core/backup.js`) esportato dall'ultima versione Electron, oppure leggere direttamente i file
  LevelDB. Da provare prima su una copia dei dati del Surface.
- Servire l'app con `SetVirtualHostNameToFolderMapping("app.studydesk", <cartella risorse>)` per avere un'origine stabile.

## 2. Funzioni del processo principale di Electron da riscrivere in C++ (StudyDesk)
| Electron (`StudyDesk/electron`) | Nativo |
|---|---|
| `preload.js` saveFile / openFiles / openExternal | `GetSaveFileNameW` / `GetOpenFileNameW` / `ShellExecuteW` (già in ClassDesk) |
| `hubdesk.js` (canale locale con HubDesk: TCP su 127.0.0.1, porta da `%APPDATA%\DeskHub\runtime.json`) | Winsock, righe JSON come oggi |
| `records-mirror.js` (record in `%APPDATA%\DeskHub\records\studydesk`) | lettura/scrittura file (ClassDesk ha già `deskhubList/Read/Write`) |
| `board.js` / `board-core.js` (lavagna in rete 26.10, `_sdboard._tcp`) | si può togliere: la lavagna passa da HubDesk dalla 26.11 |
| `sync.js` (sincronizzazione diretta 26.10) | si può togliere: la fa HubDesk |
| `updater.js` | non serve: aggiorna HubDesk |
| schermo intero, menu | `SetWindowLongPtr` / scorciatoie in JS |

## 3. HubDesk per Windows
- Interfaccia: `Hub/electron/renderer` così com'è.
- Da riscrivere in C++: rete della suite (`net/hub-net.js`: TCP + Bonjour → `DnsServiceRegister`/`DnsServiceBrowse` di Windows 10+),
  catalogo e installazioni (`catalog/*`, già semplice), icona nell'area di notifica (`Shell_NotifyIconW`), avvio all'accesso
  (chiave `Run`). È il pezzo più grande: conviene farlo dopo StudyDesk.

## 4. Interfaccia uguale a macOS
Le versioni Windows usano HTML: allineare a mano colori, raggi, spaziature e icone ai componenti SwiftUI (`Theme` in
`StudyDesk/macOS/Sources/Models.swift`), con schermate affiancate Mac/Windows (script di snapshot già presenti nei `Tests`).

## 5. Ordine consigliato e verifiche
1. Host comune + StudyDesk senza rete (libri, esercizi, lavagna locale) → prova sul Surface.
2. Migrazione dei dati da Electron, provata su una COPIA dei dati.
3. Canale con HubDesk (gruppi, risultati, lavagna condivisa) → prova Mac ↔ Surface.
4. HubDesk nativo.
5. Togliere Electron da `suite.py` e dall'installer unico (`Hub/installer-win`).
