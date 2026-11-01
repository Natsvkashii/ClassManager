# HubDesk – il centro della suite ClassDesk

HubDesk è l'app sempre attiva della suite (ClassDesk + StudyDesk + HubDesk). Fa tre cose:

1. **Gestione app** (stile Adobe Creative Cloud): installa, aggiorna, apre e disinstalla ClassDesk e StudyDesk; aggiorna sé stessa.
2. **Rete**: trova da sola gli altri computer della suite in rete locale, resta collegata, si ricollega da sola e scambia
   **subito** ogni modifica ai dati di ClassDesk e StudyDesk (con gestione dei conflitti).
3. **Lavagna condivisa**: quando due dispositivi sono collegati, la lavagna di StudyDesk è condivisa in tempo reale, in automatico.

HubDesk è installato **sempre**: dal pacchetto suite, e da ClassDesk o StudyDesk quando si installano da soli (al primo avvio
lo scaricano e lo installano se manca). Le app continuano a funzionare anche se HubDesk non è in esecuzione: i dati restano
sul disco e vengono scambiati alla successiva apertura di HubDesk.

| | macOS | Windows |
|---|---|---|
| Codice | `Hub/macOS/` (SwiftUI, swiftc) | `Hub/electron/` (Electron + NSIS) |
| Bundle / appId | `com.guairajaramillo.hubdesk` | `com.guairajaramillo.hubdesk` |
| Installazione | `/Applications/HubDesk.app` (oppure `~/Applications`) | `%LOCALAPPDATA%\Programs\hubdesk\HubDesk.exe` |
| Avvio | elemento di login (`SMAppService.mainApp`) + icona nella barra dei menu | avvio con Windows (`setLoginItemSettings`) + icona nell'area di notifica |
| Cartella dati | `~/Library/Application Support/DeskHub/` | `%APPDATA%\DeskHub\` |

`DESKHUB_HOME` (variabile d'ambiente) sostituisce la cartella dati in tutte le app: serve per i test.

## 1. Cartella dati `DeskHub/`

| file | chi scrive | contenuto |
|---|---|---|
| `hub.json` | ClassDesk, StudyDesk | gruppi e studenti scambiati tra le due app sullo stesso computer (`HUB_FORMAT.md`) |
| `records/<app>/<chiave-codificata>.json` | l'app (i suoi dati), HubDesk (dati arrivati dalla rete) | un **record** sincronizzato |
| `settings.json` | HubDesk | `{"deviceId","deviceName","syncCode","syncEnabled","channel":"stable|unstable","autoBoard":true}` |
| `peers.json` | HubDesk | dispositivi conosciuti e stato (vedi §3.5) |
| `base/<deviceId>.json` | HubDesk | `{ "<app>/<chiave>": "<hash>" }` concordato con quel dispositivo |
| `conflicts.json` | HubDesk | conflitti da risolvere (vedi §3.4) |
| `runtime.json` | HubDesk | `{"port":N,"token":"<hex>","pid":N,"heartbeat":"ISO","version":"26.11.0-001"}` – canale locale (§4) |

Tutte le scritture sono atomiche (file temporaneo nella stessa cartella + rinomina).

### Record
```jsonc
// records/studydesk/group%3Agrp-1.json
{ "key": "group:grp-1", "app": "studydesk", "updatedAt": "ISO", "device": "<deviceId>", "deleted": false, "value": { … } }
```
- La chiave è libera (definita dall'app). Nome file = chiave codificata: ogni byte UTF-8 fuori da `[A-Za-z0-9._-]` diventa `%XX`
  (esadecimale maiuscolo), poi `.json`.
- Una cancellazione **non** rimuove il file: lo riscrive con `"deleted": true, "value": null` (tombstone), così si propaga.
- **Hash** del record = `sha256` (esadecimale) del JSON canonico di `{"deleted": <bool>, "value": <value>}` (chiavi ordinate a
  ogni livello, nessuno spazio, `undefined`/`nil` omessi; è lo stesso `canonical` di `StudyDesk/electron/sync-core.js`).
  `updatedAt` e `device` non entrano nell'hash.
- Un'app scrive un record solo se l'hash cambia (niente eco infinite). Un'app che riceve un record (file cambiato) lo applica ai
  propri dati solo se è diverso da ciò che ha.

Le librerie comuni (`Hub/swift/DeskHubRecords.swift`, `Hub/js/deskhub-records.js`) implementano tutto questo:
`put(app,key,value)`, `remove(app,key)`, `all(app)`, `get(app,key)`, `hash(record)`, `watch(app, onChange)`, `settings()`,
`peers()`, `runtime()`; e il client del canale locale (`DeskHubLink`, §4).

### Record delle app
- **StudyDesk**: `group:<groupId>`, `progress:<contesto>::<moduleId>::<partId>` (stessi valori del vecchio protocollo `_sdsync`).
- **ClassDesk**: `course:<courseId>` (corso con livelli, moduli, lezioni, presenze…), `student:<studentId>`, più i record
  necessari per i dati globali (`settings:general`, `accounts:<id>` ecc.). Ogni app sceglie la granularità, ma un record
  deve stare sotto ~2 MB.

## 2. Gestione app (catalogo)

HubDesk legge le release di `Natsvkashii/ClassManager`:
`https://api.github.com/repos/Natsvkashii/ClassManager/releases` (canale `unstable` = anche le `prerelease`), con ripiego su
`https://raw.githubusercontent.com/Natsvkashii/ClassManager/stable/update-manifest.json` (chiave `suite`, §5).

| app | id | macOS: rilevamento | Windows: rilevamento |
|---|---|---|---|
| HubDesk | `hubdesk` | bundle `com.guairajaramillo.hubdesk` | `%LOCALAPPDATA%\Programs\hubdesk\HubDesk.exe` |
| ClassDesk | `classdesk` | bundle `com.guairajaramillonitoglia.classmanagement` | `%LOCALAPPDATA%\Programs\ClassDesk\ClassDesk.exe` (registro `HKCU\…\Uninstall\ClassDesk`) |
| StudyDesk | `studydesk` | bundle `com.guairajaramillo.studydesk` | `%LOCALAPPDATA%\Programs\studydesk\StudyDesk.exe` |

Versione installata: macOS `CFBundleShortVersionString` dell'Info.plist; Windows `DisplayVersion` della chiave Uninstall
(`reg query`), o il `version` del `resources\app.asar` → per Electron basta il valore `DisplayVersion` scritto da NSIS.

### Asset della release (dalla 26.11.0-004: un solo installer per sistema)
| asset | contenuto |
|---|---|
| `ClassDesk-Suite-<v>-Installer.pkg` | pacchetto macOS con le tre app (HubDesk obbligatorio, le altre selezionabili). Il `postinstall` assegna ogni `.app` all'utente della console, così HubDesk le aggiorna senza password |
| `ClassDesk-Suite-<v>-Setup.exe` | installer Windows nativo (`Hub/installer-win`) con dentro gli installer di HubDesk (NSIS), ClassDesk (nativo) e StudyDesk (NSIS) |

`Setup.exe`: senza argomenti mostra la scelta delle app; `--silent` (o `/S`) installa HubDesk e aggiorna le app già installate;
`--silent --components=classdesk,studydesk` installa HubDesk e le app elencate; `--extract=<id> --out=<file>` scrive l'installer
di una sola app (lo usa HubDesk); `--list` elenca il contenuto. Formato: installer appesi in coda + indice (`id[16] u64 offset
u64 size` × N, `u32 N`, `"CDSUITE1"`), scritto da `suite.py build_win_setup`.
Release fino alla 26.11.0-003: un file per app (`ClassDesk-<v>-macOS.zip`, `StudyDesk-<v>-mac.zip`, `HubDesk-<v>-mac.zip`,
`ClassDesk-<v>-win-x64.exe`, `StudyDesk-<v>-win-x64.exe`); il catalogo preferisce il file dell'app e, se manca, l'installer della suite.

### Azioni
- **Installa / Aggiorna** – macOS: scarica lo zip in una cartella temporanea nuova, estrae con `ditto -x -k`, sposta l'`.app` in
  `/Applications` (se scrivibile) altrimenti `~/Applications`; se l'app esistente non è scrivibile (installata da `.pkg`, di root)
  usa `do shell script … with administrator privileges` (la password la inserisce l'utente nella finestra di sistema). L'app in
  esecuzione viene chiusa prima (`NSRunningApplication.terminate`) e riaperta dopo, se era aperta.
  Dal `.pkg` della suite l'`.app` si estrae con `pkgutil --expand-full` (senza installare). Windows: scarica l'installer, ne
  estrae l'app (`Setup.exe --extract=<id>`), chiude l'app se è aperta (prima normalmente, poi forzando dopo 8 s) ed esegue
  `ClassDesk --silent` / `StudyDesk /S`.
- **Apri** – `NSWorkspace.openApplication` / `shell.openPath`.
- **Disinstalla** – macOS: sposta l'app nel Cestino (`NSWorkspace.recycle`), i dati restano. Windows: ClassDesk `ClassDesk.exe
  --uninstall`, StudyDesk `"Uninstall StudyDesk.exe" /S`. HubDesk non si disinstalla da sé finché c'è un'altra app.
- Interfaccia: barra laterale *App · Dispositivi · Conflitti · Impostazioni*. *App* = schede grandi (icona, nome, descrizione,
  versione installata → disponibile, barra di avanzamento, pulsante principale Installa/Apri/Aggiorna e menu «…» con
  Disinstalla, Reinstalla, Note di versione). In alto il canale (Stabile / Unstable) e «Aggiorna tutto».
- Controllo aggiornamenti all'avvio e ogni 6 ore; con «Aggiornamenti automatici» attivo installa da solo (app chiuse).

## 3. Rete (`_deskhub._tcp`)

Sostituisce `_sdsync._tcp` di StudyDesk. Stesso trasporto: TCP, **un oggetto JSON per riga**, Bonjour/mDNS, nessun server esterno.

### 3.1 Sicurezza e associazione
- Lo stesso **codice della suite** (impostato in HubDesk, *Dispositivi*) su tutti i computer dell'utente:
  `secret = sha256("deskhub-sync:" + codice)` (hex). Senza codice la rete è disattivata.
- Annuncio Bonjour: nome = `deviceName`, TXT `{"id":"<deviceId>","v":"<versione>","p":"macos|windows"}`.
- Chi ha il `deviceId` **minore** (confronto di stringhe) si connette; l'altro accetta. Così c'è una sola connessione per coppia.

### 3.2 Messaggi
Ogni richiesta ha `"id"` (intero, unico per connessione e per lato); la risposta ha `"re": <id>`. Entrambi i lati possono fare
richieste sulla stessa connessione. Messaggi senza `id` sono eventi.
```jsonc
{"t":"hello","id":1,"device":"<uuid>","name":"MacBook di Guaira","platform":"macos","secret":"<hex>","proto":2,"version":"26.11.0-001"}
→ {"t":"hello","re":1,"device":"…","name":"…","platform":"windows","proto":2,"version":"…"}   // oppure {"t":"error","re":1,"message":"codice errato"} e chiusura
{"t":"manifest","id":2}                  → {"t":"manifest","re":2,"records":{"studydesk/group:grp-1":"<hash>",…}}
{"t":"get","id":3,"keys":["studydesk/group:grp-1"]} → {"t":"records","re":3,"records":{"studydesk/group:grp-1":{…record…}}}
{"t":"put","id":4,"records":{"<app>/<key>":{…record…}}} → {"t":"ok","re":4}
{"t":"base","id":5,"hashes":{"<app>/<key>":"<hash>"}}   → {"t":"ok","re":5}      // "" = chiave rimossa dalla base
{"t":"ping","id":6} → {"t":"pong","re":6}                                          // ogni 15 s; 3 senza risposta = disconnesso
// eventi
{"t":"changed","keys":["<app>/<key>",…]}   // «ho appena cambiato questi record»: chi lo riceve avvia subito una sincronizzazione
{"t":"board","from":"<deviceId>","fromName":"…","msg":{…messaggio lavagna…}}
```
Il `record` scambiato è l'intero file del record (§1). Chi riceve con `put` lo salva così com'è in `records/<app>/…`.

### 3.3 Algoritmo
Identico a StudyDesk (`StudyDesk/docs/SYNC_AND_BOARD_PROTOCOL.md` e `plan()` di `StudyDesk/electron/sync-core.js`), sulle chiavi
`<app>/<key>`, con `base/<deviceIdRemoto>.json`. I tombstone sono record normali, quindi i casi «assente» capitano solo con
record mai visti.
- **Quando**: all'apertura della connessione; ogni volta che cambia un file in `records/` (debounce 300 ms) → invia `changed` e
  sincronizza; alla ricezione di `changed`; e comunque ogni 60 s. Una sola sincronizzazione per peer alla volta (le richieste
  arrivate nel frattempo ne accodano una).
- Dopo pull/push/agreed: invia `base` con gli hash concordati e salva la stessa base in locale.

### 3.4 Conflitti
Non si risolvono da soli. `conflicts.json` = `[{"key":"<app>/<key>","peer":"<deviceId>","peerName":"…","local":{record|null},"remote":{record|null},"at":"ISO"}]`.
HubDesk li mostra in *Conflitti* (una notifica di sistema quando ne arrivano di nuovi): descrizione leggibile (nome del gruppo,
corso, studente…), i due lati affiancati con data e dispositivo, «Tieni questo» / «Tieni l'altro» e «Tutti questo / tutti l'altro».
Scelta: il vincitore viene scritto in locale e inviato con `put`; poi `base` con il suo hash.

### 3.5 `peers.json`
```jsonc
{"updatedAt":"ISO","self":{"deviceId":"…","deviceName":"…"},
 "peers":[{"deviceId":"…","name":"Surface di Guaira","platform":"windows","version":"26.11.0-001",
           "host":"192.168.10.51","port":51234,"connected":true,"lastSeen":"ISO","lastSync":"ISO"}]}
```
I dispositivi visti almeno una volta restano nell'elenco (si possono «dimenticare»). Riconnessione automatica: il browser
Bonjour resta sempre attivo; se un peer conosciuto non risponde si riprova con l'ultimo `host:port` ogni 10 s.

## 4. Canale locale (app ↔ HubDesk)

HubDesk apre un server TCP su `127.0.0.1` (porta libera) e scrive `runtime.json` (aggiorna `heartbeat` ogni 5 s). Le app
leggono `runtime.json`, si connettono e mandano `{"t":"hello","app":"studydesk","token":"<token>"}` → `{"t":"hello","ok":true,"self":{…},"peers":[…]}`.
Righe JSON come in §3.
- HubDesk → app: `{"t":"peers","peers":[…]}` (a ogni cambio), `{"t":"records","app":"studydesk","keys":[…]}` (record
  arrivati dalla rete: l'app li rilegge subito senza aspettare il file watcher), `{"t":"board",…}` (lavagna da un peer),
  `{"t":"peer-joined","device":"…","name":"…"}`.
- app → HubDesk: `{"t":"board","msg":{…}}` (inoltrato a tutti i peer collegati), `{"t":"changed","app":"…","keys":[…]}`
  (facoltativo: accelera la propagazione), `{"t":"open","app":"classdesk"}` (HubDesk apre un'altra app).
- Se `runtime.json` manca o il `heartbeat` è più vecchio di 20 s, HubDesk non è attivo: le app provano ad aprirlo
  (macOS `open -b com.guairajaramillo.hubdesk --background`, Windows avvio di `HubDesk.exe --background`) e
  ritentano ogni 10 s. ClassDesk Windows (WebView2, senza socket) usa solo i file in `records/` (lettura ogni 2 s).

## 5. Lavagna condivisa automatica

Quando HubDesk ha almeno un peer collegato e `autoBoard` è attivo, la lavagna di StudyDesk diventa **condivisa** con tutti i
dispositivi collegati, senza azioni dell'utente:
- Ogni tratto locale viene inviato con `{"t":"board","msg":…}` (messaggi `begin/pt/end/undo/clear/background` del protocollo
  `_sdboard`); i `begin` portano `"id"` globale (`<deviceId>:<n>`), così i tratti di dispositivi diversi non si confondono.
- I messaggi in arrivo vengono disegnati sulla stessa lavagna (anche se l'utente non la sta guardando: all'apertura si vede tutto).
  `undo` toglie l'ultimo tratto di quel dispositivo; `clear` e `background` valgono per tutti.
- All'apertura della lavagna e a ogni `peer-joined` l'app invia `{"t":"snapshot","strokes":[…],"background":…}`; chi la riceve
  unisce i tratti per `id`.
- In StudyDesk, nella barra della lavagna: indicatore «Condivisa con: Surface di Guaira» e interruttore per sospendere.
  La vecchia condivisione `_sdboard` (sola visione) resta per compatibilità con le versioni 26.10.

## 6. Migrazione dal vecchio ClassDesk (26.10.x)

Il vecchio programma si aggiorna da solo con le regole di sempre; i nomi degli asset (§2) sono scelti perché queste regole
prendano il pacchetto giusto:
- **macOS**: il vecchio aggiornatore prende il primo `.zip` il cui nome contiene `macos`, `classdesk` o `class-management`
  e installa il primo `.app` che trova come `ClassDesk.app` (ripiego: il primo `.pkg`). Quindi `ClassDesk-<v>-macOS.zip` deve
  essere il primo asset caricato, e gli zip di StudyDesk e HubDesk **non** contengono quelle parole (`-mac.zip`).
  Il nuovo `ClassDesk.app`, al primo avvio, installa HubDesk se manca (scarica `HubDesk-<v>-mac.zip` dalla stessa release,
  oppure dall'ultima disponibile) e lo apre; da HubDesk si installa poi StudyDesk.
- **Windows**: il vecchio aggiornatore prende il primo `.exe` il cui nome contiene `setup` e lo esegue con `--silent` all'avvio
  successivo. È `ClassDesk-Suite-<v>-Setup.exe` (HubDesk); nessun altro asset contiene `setup`. HubDesk al primo avvio vede il
  vecchio ClassDesk installato e lo aggiorna subito a `ClassDesk-<v>-win-x64.exe --silent` (i dati restano in
  `%LOCALAPPDATA%\ClassDesk_App`), poi propone StudyDesk.
- Ripiego del manifest (`update-manifest.json` nella radice del ramo `stable`): `setupUrl/setupName` → `ClassDesk-Suite-<v>-Setup.exe`,
  `macZipUrl/macZipName` → `ClassDesk-<v>-macOS.zip`, `macPkgUrl/macPkgName` → `ClassDesk-Suite-<v>-Installer.pkg`; in più
  `"suite": {"version","apps":{"hubdesk":{"mac":{"name","url"},"win":{…}},"classdesk":{…},"studydesk":{…}}}`.
- Ogni app aggiorna sé stessa solo tramite HubDesk quando HubDesk è installato (il pulsante «Cerca aggiornamenti» dell'app
  apre HubDesk); il vecchio aggiornatore interno resta come ripiego e sceglie solo il **proprio** asset per prefisso.

## 7. Versioni
Suite e app hanno la stessa versione `AA.MM.R-BBB` (prima: **26.11.0-001**, canale `unstable`, release `prerelease`, tag
`v26.11.0-001`). Script unico nella radice: `suite.py` (`status`, `set <v> --channel`, `build`, `manifest`, `notes`).
