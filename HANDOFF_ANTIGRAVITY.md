# Passaggio di consegne ad Antigravity – conversione nativa di Windows (ClassDesk Suite)

Data: 1 novembre 2026. Autore del progetto: Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com, GPL-3.0).
Repository: monorepo `Project 0` (remote `Natsvkashii/ClassManager`, ramo `stable`). Leggi anche
`StudyDesk/docs/WINDOWS_NATIVE_PLAN.md` (stato dettagliato) e `Hub/HUBDESK.md` (protocollo e release).

## 1. Situazione

| App Windows | Prima (Electron) | Ora | Stato |
|---|---|---|---|
| ClassDesk | – | nativo C++ + WebView2, 3 MB | in produzione (26.11.0-004) |
| StudyDesk | 111 MB | **nativo, 3,0 MB** – `StudyDesk/windows/native/` | completo, **mai eseguito su Windows** |
| HubDesk | 102 MB | **nativo, 1,5 MB** – `Hub/win-host/` | completo (motore di rete incluso), **mai eseguito su Windows** |
| Installer unico | – | `Hub/installer-win/suite_setup.cpp` | pubblicato nella 004, provato sul Surface |

Ultima release pubblicata: **26.11.0-004 (Unstable)**, con due soli file (Setup.exe Windows, .pkg Mac).
Commit locali NON ancora su GitHub: tutto il lavoro nativo, le animazioni (`Hub/MOTION.md`), le correzioni dell'installer
(`git log origin/stable..stable`).

### Architettura nativa (stesso schema per StudyDesk e HubDesk)
- Exe C++ che si installa da solo in `%LOCALAPPDATA%\Programs\<app>` (rimuove la versione Electron), con i file
  dell'interfaccia **appesi in coda** (formato `SDAPP001`, vedi `build.py`). WebView2 serve la cartella da un host virtuale
  (`https://studydesk.app/`, `https://hubdesk.app/`) perché i moduli ES non si caricano da `file://`.
- `webview.h` condiviso con ClassDesk: `ClassDesk/Windows-Version/native/include/` (cartella dati per app con
  `WEBVIEW_USER_DATA_FOLDER`, `core_webview()`).
- La logica resta in JavaScript nella pagina (riutilizzabile); il C++ fornisce solo funzioni native `window.__sd_*` /
  `window.__hd_*` (file, registro, processi, download WinHTTP, TCP, mDNS con `DnsServiceRegister/Browse/Resolve`).
- StudyDesk: `app/js/core/hubnative.js` (record, lavagna, `hub.json`); test di parità con Electron in
  `StudyDesk/tests/hubnative.test.js`.
- HubDesk: `Hub/win-host/page/hubdesk-native.js` (catalogo/gestore invariati, inclusi come funzioni perché la pagina ha
  una CSP) + `page/hub-engine.js` (porting di `Hub/electron/net/hub-net.js`). Test di interoperabilità con il motore
  Electron: `cd Hub/electron && node --test ../win-host/tests/engine-interop.test.js` (passa).

### Comandi
- Compilatore: zig 0.17 in `~/.local/bin/zig`. Python di python.org: per pubblicare serve `SSL_CERT_FILE=/etc/ssl/cert.pem`.
- Test: `cd StudyDesk && npm test` (83), `cd Hub/electron && node --test tests/*.test.js ../win-host/tests/engine-interop.test.js` (17),
  Mac: `Hub/macOS/Tests/run.sh`, test Swift in `StudyDesk/macOS/Tests` (vedi intestazioni).
- Build singole: `python3 StudyDesk/windows/native/build.py`, `python3 Hub/win-host/build.py`.
- Suite: `python3 suite.py set 26.11.0-005 --channel unstable` → voci nei CHANGELOG (`Hub/`, `ClassDesk/`, `StudyDesk/`
  + `AppChangelog` nei `Models.swift`) → `PATH=$HOME/.local/bin:$PATH python3 suite.py build [--hubdesk-native]`
  (StudyDesk nativo è già il predefinito; `--studydesk-electron` per la vecchia) → `python3 suite.py publish` (prova) →
  `--yes` solo con il permesso di Guaira.

## 2. Problemi aperti (dalla prova della 004 sul Surface)
1. L'installer unico è partito da solo prima di premere «Installa»: capire se è il tasto Invio dell'automazione o
   `IsDialogMessage` + pulsante predefinito (`Hub/installer-win/suite_setup.cpp`). Testi tagliati al 200 %: già corretti.
2. StudyDesk Electron non si è aggiornato con `/S` (rimasto 26.11.0-3): sparisce con StudyDesk nativo.
3. L'HubDesk Electron non apre la finestra (solo area di notifica): sparisce con HubDesk nativo.
4. ClassDesk mostra nel piè di pagina la versione salvata nei dati (`state.version` in
   `ClassDesk/Windows-Version/src/index.html`, `renderHeaderAndSidebarControls`) e in basso «26.10.5-001 (Beta)»: mostrare la
   versione del programma e aggiornare `state.version` all'avvio.
5. Migrazione dei dati di StudyDesk da Electron (copia della cartella IndexedDB con origine diversa): **non verificata**;
   ripiego = backup ZIP (Impostazioni › Dati) esportato da Electron e importato nella nativa.

## 3. Regole del progetto (importanti)
- Mai pubblicare, fare push o creare release senza il permesso esplicito di Guaira. Mai stampare token.
- I test non devono mai toccare i dati veri (usare `STUDYDESK_HOME`, `DESKHUB_HOME`, `CLASSDESK_DATA_DIR` su copie).
- Sul Surface (chat Claude «Installazione accesso remoto») la conferma per installare la dà Guaira in quella chat; il
  firewall lo autorizza Guaira.
- Non investire nel livello Electron: modificare solo ciò che passa alla versione nativa (interfaccia web, logica comune).
- Rispondere in italiano; conservare le intestazioni con i crediti dell'autrice in ogni file.

## 4. Modello consigliato in Antigravity
Usa il modello **più capace con ragionamento alto** (tra quelli proposti: **Argon high**, se Argon è il modello più grande;
altrimenti il «high» del modello più grande disponibile). Motivo: C++ Win32/COM/WebView2, rete e compatibilità di
protocollo tra tre implementazioni (Swift, Node, pagina) e nessuna possibilità di eseguire Windows sul Mac: gli errori
costano una release. Per compiti meccanici (CHANGELOG, testi, rinominare) basta **Flash medium**.
(Non conosco le differenze esatte tra Flash e Argon in Antigravity: verifica nella sua documentazione quale dei due è il
modello più potente e scegli quello, livello high.)

## 5. Prompt per Antigravity (incollalo così com'è)

```
Sei nel monorepo "Project 0" (ClassDesk Suite di Guaira Jaramillo Nitoglia). Leggi prima HANDOFF_ANTIGRAVITY.md,
StudyDesk/docs/WINDOWS_NATIVE_PLAN.md e Hub/HUBDESK.md. Rispondi sempre in italiano. Non pubblicare release, non fare
push e non creare tag senza che Guaira lo scriva esplicitamente; non toccare i dati reali dell'utente nei test.

Obiettivo: completare il passaggio delle app Windows (StudyDesk e HubDesk) da Electron a nativo (C++ + WebView2), già
scritto ma mai eseguito su Windows, e portarlo in una release 26.11.0-005 (Unstable) provata sul Surface.

Passi, in ordine; dopo ognuno esegui i test (StudyDesk: npm test; Hub: cd Hub/electron && node --test tests/*.test.js
../win-host/tests/engine-interop.test.js) e fai un commit locale con un messaggio chiaro:
1. Correggi i problemi aperti della sezione 2 di HANDOFF_ANTIGRAVITY.md che si possono correggere senza Windows
   (versione nel piè di pagina di ClassDesk Windows; controllo dell'avvio automatico dell'installer unico: l'installazione
   deve partire solo dal pulsante «Installa»).
2. Rivedi con attenzione StudyDesk/windows/native/studydesk_native.cpp e Hub/win-host/hubdesk_native.cpp come se dovessero
   girare su Windows 11 al primo colpo: thread e chiamate a webview (resolve/dispatch), chiusura pulita, percorsi con
   caratteri non ASCII, permessi senza amministratore, istanza unica, area di notifica. Compila con build.py (zig).
3. Prepara la 26.11.0-005: suite.py set, CHANGELOG di Hub/ClassDesk/StudyDesk e AppChangelog nei Models.swift,
   build con --hubdesk-native. Controlla che l'installer unico contenga gli exe nativi.
4. Chiedi a Guaira il permesso di pubblicare. Solo dopo il suo sì: publish, poi chiedi alla chat Claude del Surface
   («Installazione accesso remoto», se disponibile) di provare: installazione dall'installer unico, StudyDesk con i dati
   migrati (libri, gruppi, progressi), import di un .sdbook, salvataggio file, lavagna a schermo intero, HubDesk con la
   finestra, area di notifica, aggiornamenti, rete Mac ↔ Surface con lo stesso codice e lavagna condivisa.
5. Se la migrazione dei dati di StudyDesk non funziona, implementa il ripiego col backup ZIP prima di proporre la versione
   a chiunque altro.
Alla fine scrivi un report breve: cosa funziona, cosa no, cosa resta.
```
