# StudyDesk e HubDesk per Windows in versione nativa leggera – piano

## STATO – 1 novembre 2026, notte (riprendere da qui)

### Fatto (commit locali, NON ancora su GitHub: `git log origin/stable..stable`)
- **StudyDesk nativo per Windows** – `StudyDesk/windows/native/`
  - `studydesk_native.cpp`: si installa da solo in `%LOCALAPPDATA%\Programs\StudyDesk` (stessa cartella della versione
    Electron, che viene disinstallata), chiave Uninstall `HKCU\…\Uninstall\StudyDesk`, collegamenti, file `.sdmod/.sdbook`.
    Pagina servita da `https://studydesk.app/` (virtual host WebView2), file scelti da `https://files.studydesk.app/`.
    Dati WebView2 in `%APPDATA%\StudyDesk_Native_Data`. `window.studydesk` con la stessa forma del preload di Electron.
  - **Migrazione dati**: al primo avvio copia (non sposta) `%APPDATA%\StudyDesk\IndexedDB\app_studydesk_0.indexeddb.leveldb`
    (+ `.blob`) in `…\StudyDesk_Native_Data\EBWebView\Default\IndexedDB\https_studydesk.app_0.indexeddb.*`; segno in
    `electron-data-imported.txt`. **DA PROVARE SUL SURFACE**: se WebView2 non accetta la cartella copiata (origine diversa
    scritta dentro LevelDB), ripiego = esportare il backup ZIP da Electron (Impostazioni › Dati) e importarlo nella nativa.
  - HubDesk: `app/js/core/hubnative.js` (record, stato, lavagna, `hub.json` dei gruppi di ClassDesk) nella pagina; l'host dà
    accesso ai file di `%APPDATA%\DeskHub` e il canale TCP locale. Test di parità con Electron: `tests/hubnative.test.js`.
    Provato nel browser con un DeskHub finto (export/import gruppi, lavagna in entrambi i sensi).
  - `build.py` → `StudyDesk/dist/StudyDesk-<v>-win-x64.exe` (**3,0 MB** contro 111 MB). `suite.py build` ora usa la nativa
    (`--studydesk-electron` per la vecchia). HubDesk sa disinstallare entrambe.
  - `ClassDesk/Windows-Version/native/include/webview.h` (condiviso): cartella dati per app (`WEBVIEW_USER_DATA_FOLDER`),
    `core_webview()`; la migrazione dei vecchi dati di ClassDesk vale solo per ClassDesk. ClassDesk compila ancora.
- Animazioni (Hub/MOTION.md) in StudyDesk e ClassDesk, Mac e Windows.

- **HubDesk nativo, prima tappa** – `Hub/win-host/` (non ancora usato da `suite.py`)
  - `hubdesk_native.cpp` (**1,4 MB** contro 102 MB): si installa da solo in `%LOCALAPPDATA%\Programs\hubdesk` (toglie l'Electron),
    finestra che si nasconde nell'area di notifica (menu: Apri, ClassDesk, StudyDesk, Esci), avvio all'accesso (`Run`),
    istanza unica, stato in `%APPDATA%\HubDesk\hubdesk-state.json` (lo stesso di Electron), impostazioni in DeskHub.
    Funzioni native: download con avanzamento (WinHTTP), registro, processi, installer in attesa, apertura app.
  - `page/hubdesk-native.js`: `window.hubdesk` per `Hub/electron/renderer` **senza modifiche all'interfaccia**; `catalog.js` e
    `manager.js` girano invariati (inclusi da `build.py` come funzioni: la pagina ha una CSP che vieta fetch/eval).
    Provato nel browser con funzioni native simulate: versioni, benvenuto, aggiornamento di StudyDesk (scarica → estrae
    dall'installer unico → chiude → installa).
  - **Manca il motore di rete** (`Hub/electron/net/hub-net.js`: server TCP, Bonjour, scambio dei record, conflitti, lavagna,
    canale locale per le app con `runtime.json`). Finché manca, la pagina «Dispositivi» dice che la rete non è disponibile:
    **non sostituire ancora l'HubDesk Electron**. Da fare in C++ (Winsock + `DnsServiceRegister/DnsServiceBrowse`), seguendo
    `Hub/macOS/Sources/Engine.swift` e i test `Hub/electron/tests/net.test.js`.

### Non ancora provato
Niente della versione nativa è stato eseguito su Windows (qui c'è solo il Mac). Il Surface era scollegato.

### Prossimi passi, in ordine
1. Compilare la 005: `python3 suite.py set 26.11.0-005 --channel unstable`, voci nei CHANGELOG, `PATH=$HOME/.local/bin:$PATH
   python3 suite.py build`. Chiedere a Guaira il permesso di pubblicare (Unstable) e farla provare sul Surface tramite la chat
   «Installazione accesso remoto» (Remote Control): installazione dall'installer unico, avvio, **dati migrati** (libri, gruppi,
   progressi), import di un `.sdbook`, esportazioni (salva file), lavagna a schermo intero, gruppi da ClassDesk, collegamento
   con HubDesk e lavagna condivisa Mac ↔ Surface.
2. Se la migrazione IndexedDB non funziona: ripiego col backup ZIP (vedi sopra) prima di pubblicare per altri.
3. HubDesk nativo (§3): stesso schema → host C++ (`Hub/win-host`), interfaccia `Hub/electron/renderer`, e in C++ la rete
   (`net/hub-net.js`: server TCP + Bonjour con `DnsServiceRegister/DnsServiceBrowse`), icona nell'area di notifica, avvio
   all'accesso, catalogo/installazioni (`catalog/*`, semplice da portare nella pagina come fatto per StudyDesk).
4. Togliere Electron da `suite.py` e dall'installer unico quando anche HubDesk è nativo.

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
