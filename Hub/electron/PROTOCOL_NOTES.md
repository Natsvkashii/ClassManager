# HubDesk (Windows) – decisioni di protocollo non fissate da HUBDESK.md

Implementazione: `net/hub-net.js` (nessun import Electron). Tutto quanto sotto è ciò che il codice fa realmente.

## Trasporto
- Una riga = un oggetto JSON UTF-8, terminata da `\n`. Righe vuote o non-JSON ignorate. Limite riga 128 MB.
- `id` interi crescenti da 1, un contatore per lato e per connessione; la risposta porta `re` = id della richiesta. Un messaggio con `re` è sempre una risposta; con `id` (senza `re`) una richiesta; senza nessuno dei due un evento.
- Errore di una richiesta: `{"t":"error","re":N,"message":"…"}` (la richiesta fallisce lato chiamante). Messaggio sconosciuto → `error`.
- Timeout richiesta 60 s (hello 10 s). Ping ogni 15 s; qualunque dato ricevuto azzera il contatore; 3 ping falliti → chiusura.
- Un client non autenticato che non manda `hello` entro 15 s viene chiuso.
## Handshake
- Si connette chi ha `deviceId` **minore** (confronto di stringhe JS `<`). Un `hello` in ingresso da un id maggiore viene comunque accettato.
- `hello` rifiutato (`error` "codice errato" + chiusura dopo 100 ms) se: codice assente, rete disattivata, secret diverso, `device` mancante o uguale al proprio, `proto` < 2. `proto` > 2 è accettato.
- Il `hello` di risposta contiene `device,name,platform,proto,version` (nessun `secret`).
- Se arriva una seconda connessione per lo stesso `deviceId` la nuova **sostituisce** la vecchia (la vecchia viene chiusa).
- Bonjour: tipo `deskhub` (`_deskhub._tcp`), TXT `{id,v,p}` con `p` = `windows`. I dispositivi trovati via Bonjour NON compaiono in `peers.json` finché l'`hello` non riesce (altrimenti dispositivi con codice diverso inquinerebbero l'elenco). Riconnessione ogni 10 s verso `host:port` dell'ultimo Bonjour/ultima connessione, solo se `deviceId` proprio < quello remoto.
## Sincronizzazione
- Chiave globale = `<app>/<key>` con `app` ∈ `[A-Za-z0-9._-]{1,64}`; un `put` con app non valida o `record.key` diversa dalla chiave globale fa fallire la richiesta (error). Il record salvato è esattamente quello ricevuto (campo `app` riscritto con quello della chiave).
- `manifest.records` = `{ "<app>/<key>": "<hash>" }` per **tutti** i file `.json` sotto `records/<app>/` con campo `key` (tombstone inclusi). Cartelle/file non validi ignorati.
- `get` accetta liste di qualunque lunghezza; HubDesk ne chiede al massimo 100 per volta e invia `put` da 100 record per volta. Chiavi sconosciute semplicemente assenti nella risposta.
- **Cancellazioni fisiche** (file sparito, nessun tombstone): non vengono propagate. `delLocal` di plan() (locale presente, remoto assente, base uguale al locale) è trattato come **push**; `delRemote` come **pull**. Il record sopravvive sul lato che lo ha ancora, e l'hash entra nella base.
- `put` ricevuto: salva, aggiorna la «conosciuta» locale (niente `changed` di ritorno), notifica le app locali (`records`) e inoltra `changed` + sincronizza con gli *altri* peer collegati.
- `base`: `hashes` fusi nella base di quel peer (`""` rimuove). HubDesk invia `base` solo se `agreed` non è vuoto; i conflitti non entrano in `agreed`.
- Quando sincronizza: apertura connessione (entrambi i lati), `changed` ricevuto, modifica locale rilevata (fs.watch ricorsivo su `records/`, debounce 300 ms, più un controllo ogni 5 s come rete di sicurezza), ogni 60 s. Il `changed` locale elenca solo chiavi il cui hash è diverso da quello già noto (le scritture dovute alla sync non generano eco). Una sync per peer alla volta + una accodata.
- `base/<deviceId>.json`: il nome del file è l'id con i caratteri fuori da `[A-Za-z0-9._-]` sostituiti da `_`.
## Conflitti
- `conflicts.json` come §3.4; le voci di un peer vengono sostituite a ogni sync (sparisce chi non è più in conflitto; una voce identica non genera una nuova notifica).
- **Tieni questo** (locale): `put` del record locale al peer + `base` + base locale (richiede il peer collegato, altrimenti errore). **Tieni l'altro**: salva il record remoto in locale, notifica le app, invia `base` se collegato, aggiorna la base locale (funziona anche offline). Dopo la scelta si invia `changed` e si sincronizza con gli altri peer.
- Se un lato è `null` (file mancante) quel pulsante è disabilitato nella UI.
## Canale locale
- `127.0.0.1`, porta casuale; `runtime.json` `{port,token(32 hex),pid,heartbeat,version}` riscritto ogni 5 s, cancellato allo spegnimento. Hello errato → `{"t":"hello","ok":false}` e chiusura; nessun hello entro 10 s → chiusura.
- `hello` ok: `{"t":"hello","ok":true,"self":{deviceId,deviceName,version,platform},"peers":[…]}`. `peers` a ogni cambio, `peer-joined {device,name}` alla connessione di un peer, `records {app,keys}` con chiavi **senza** prefisso app dopo ricezione di record dalla rete, `board {from,fromName,msg}`.
- `board` da app → a tutti i peer collegati come evento `board` (`from`=nostro deviceId); solo se `autoBoard` ≠ false (altrimenti scartato in entrambe le direzioni). I messaggi board non vengono rimandati alle altre app locali.
- `changed` da app → rilevamento locale immediato + sincronizzazione con tutti i peer. `open` → HubDesk apre l'app se installata.
## peers.json
- `connected` per peer = connessione viva; `lastSeen`, `lastSync` ISO. Scritto (debounce 50 ms) a ogni cambio e allo spegnimento.
## Catalogo / installazione (Windows)
- Asset: `ClassDesk-<v>-win-x64.exe`, `StudyDesk-<v>-win-x64.exe`, `ClassDesk-Suite-<v>-Setup.exe`. Per ogni app si sceglie la release visibile più nuova (canale stable = non prerelease; unstable = tutte, mai le bozze) che contiene il suo asset.
- Versione StudyDesk/HubDesk: `DisplayVersion` della chiave Uninstall di electron-builder (UUID v5 dell'appId nel namespace electron-builder; se non trovata, ricerca per DisplayName con `reg query /s /f`). NOTA: electron-builder normalizza `26.11.0-001` in `26.11.0-1` nella DisplayVersion; il confronto è numerico quindi equivalente.
- Il nome dell'asset `ClassDesk-Suite-26.11.0-001-Setup.exe` è forzato da `scripts/dist.js` (`${version}` darebbe `-1`).
