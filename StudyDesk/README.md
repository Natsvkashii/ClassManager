# StudyDesk

Piattaforma modulare di esercizi interattivi per corsi di lingua (interfaccia in italiano), compagna di ClassDesk.
Concepito e sviluppato da Guaira Jaramillo Nitoglia – guaira.jaramillo.nitoglia@gmail.com – licenza GPL-3.0.

| Piattaforma | Tecnologia | Installer | Cartella |
|---|---|---|---|
| macOS | Swift / SwiftUI nativo (come ClassDesk per Mac) | `.pkg` + `.zip` per l'aggiornamento silenzioso | `macOS/` |
| Windows 10/11 | Electron + interfaccia web | NSIS «one‑click» per utente (come Chrome/Discord) | `electron/`, `app/` |
| Android | Capacitor + interfaccia web | `.apk` | `android/`, `app/` |
| Web / PWA | interfaccia web | installabile dal browser | `app/` |

Tutte le edizioni condividono i formati `docs/MODULE_FORMAT.md` (moduli `.sdmod`) e `docs/PROGRESS_FORMAT.md`
(correzione identica e file `.sdprogress.json` da inviare all'insegnante). I contenuti didattici **non** fanno parte
dell'app: si importano come libri `.sdbook` (divisi in capitoli) o moduli `.sdmod`.
Ruoli insegnante/studente, gruppi e collegamento a ClassDesk: `docs/BOOKS_ROLES_GROUPS.md`.

## macOS (nativo)

```sh
python3 scripts/manage_version.py status
python3 scripts/manage_version.py set 26.10.0-002 --channel unstable   # sincronizza Swift, package.json e app/js/core/version.js
python3 scripts/manage_version.py build                                # macOS/StudyDesk.app + dist/*.zip + dist/*.pkg
python3 scripts/manage_version.py manifest "Note di rilascio"          # update-manifest.json
```

Test macOS (nessun dato reale toccato: usano `STUDYDESK_HOME`):

```sh
swiftc macOS/Sources/Models.swift macOS/Sources/Grading.swift macOS/Tests/main.swift -o /tmp/sdtest && /tmp/sdtest <cartella-modulo>/module.json
swiftc -D SNAPSHOT_TESTS -parse-as-library macOS/Sources/*.swift macOS/Tests/Snapshots.swift -o /tmp/snap && STUDYDESK_HOME=/tmp/sdhome /tmp/snap /tmp/shots <modulo.sdmod>
```

Dati: `~/Library/Application Support/StudyDesk` (moduli, `state.json` con profilo e progressi, registrazioni).

## Edizione Windows + Android + Web

## Struttura

```
app/                 interfaccia (HTML + JS ES modules, nessun bundler, funziona offline)
  js/core/           db (IndexedDB), platform, modules (.sdmod), grading (puro, senza DOM), progress, updater, version, markdown…
  js/views/          onboarding, home, libreria, player, progressi, editor, impostazioni, crediti
  js/exercises/      un renderer per tipo: info, choice, truefalse, gapfill, match, categorize, order, table, open, speaking
electron/            main.js, preload.js, updater.js, app-config.js (Windows)
scripts/serve.js     server statico per app/ (porta 8777)
tests/               node:test (grading, versioni, updater) + fixtures/sample.sdmod
update-manifest.json manifest di fallback per gli aggiornamenti
```

## Comandi

```sh
npm install
npm test                 # test di correzione, versioni e updater
npm run web              # http://localhost:8777 (anche installabile come PWA)
npm start                # app Electron
npm run sample           # rigenera tests/fixtures/sample.sdmod
npm run dist:win         # installer NSIS per Windows (dist/StudyDesk-<versione>-win-x64.exe)
```

## Aggiornamenti

- Fonte: GitHub Releases `https://api.github.com/repos/Natsvkashii/ClassManager/releases`; se fallisce, `update-manifest.json` sul branch `stable`.
- Canali: le release `prerelease` sono Beta. Una build Beta continua a ricevere Beta finché non viene installata una versione stabile.
- Windows: controllo all'avvio e ogni 24 h (secondo la frequenza scelta), download silenzioso dell'asset `StudyDesk-<versione>-win-x64.exe` in
  `userData/StagedUpdate` + `staged_version.txt`; al successivo avvio viene eseguito con `/S --force-run`. «Scarica e installa» lo fa subito.
  Log in `userData/updater_command_log.txt` (visibile in Impostazioni).
- Android/Web: stesso controllo; offre il download dell'asset `*.apk` nel browser.
- Per pubblicare una release: carica `StudyDesk-<versione>-win-x64.exe` e `StudyDesk-<versione>.apk` come asset, e aggiorna `update-manifest.json`.

## Android (Capacitor)

```sh
npm install
npx cap sync android        # copia app/ nel progetto Android
```

Per generare l'APK servono JDK 17 e Android SDK (`ANDROID_HOME`):

```sh
cd android && ./gradlew assembleDebug      # android/app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease                  # richiede una keystore di firma
```

Per la registrazione vocale aggiungi in `android/app/src/main/AndroidManifest.xml`
`<uses-permission android:name="android.permission.RECORD_AUDIO" />` e `MODIFY_AUDIO_SETTINGS`.
Condivisione/salvataggio file usano i plugin Capacitor Filesystem e Share.

## Dati e privacy

Tutto resta sul dispositivo (IndexedDB): profilo, moduli, progressi, registrazioni. L'invio all'insegnante avviene solo su azione esplicita.

## ClassDesk Suite e HubDesk (26.11)

StudyDesk fa parte della **ClassDesk Suite** (ClassDesk + StudyDesk + HubDesk, repo `Natsvkashii/ClassManager`): stessa versione e canale.
HubDesk trova i dispositivi in rete, sincronizza gruppi e risultati (record `records/studydesk/`), risolve i conflitti, gestisce gli aggiornamenti
e rende la **Lavagna** condivisa in tempo reale tra i dispositivi collegati. Se manca, StudyDesk lo installa da solo al primo avvio.
La sincronizzazione diretta delle versioni 26.10 resta disponibile, spenta, in *Sincronizzazione*. Dettagli: `Hub/HUBDESK.md` e `docs/SYNC_AND_BOARD_PROTOCOL.md`.
Asset della release: `StudyDesk-<v>-mac.zip`, `StudyDesk-<v>-win-x64.exe`, `StudyDesk-<v>-Android.apk`.
Test macOS HubDesk: vedi `macOS/Tests/HubSuiteTest.swift` e `macOS/Tests/HubSnapshots.swift` (comandi di build nell'intestazione dei file).
