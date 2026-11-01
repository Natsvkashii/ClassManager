# ClassDesk v26.10.5-001

**Concepito e Sviluppato da:** Guaira Jaramillo Nitoglia  
**Contatto:** guaira.jaramillo.nitoglia@gmail.com  
**Licenza:** GNU General Public License v3.0 (GPL-3.0) — Vedi [LICENSE](LICENSE)

---

## Panoramica
**ClassDesk** è una suite gestionale accademica multi-livello (QCER: A1, A2, B1, B2, C1, C2) nativa per **macOS** e **Windows 10/11 (64-bit)** per la gestione completa di:
- **Presenze** (con barra di stato della partecipazione, colonna studenti fissa, evidenziazione del giorno odierno e selezione multipla)
- **Piano Lezioni** (con stati visivi di completamento/ritardo, drag & drop, esportazione PNG 1:1 e testo WhatsApp)
- **Voti, Attività e Criteri di Valutazione (Rubriche)** (con calcolo automatico del punteggio delle presenze in base alle ore effettive e massimale configurabile)
- **Anagrafica Studenti** (con storico note delle lezioni per i moduli attivi, filtri e contatti diretti WhatsApp/Email)
- **Fatturazione e Banca Dati Clienti** (con calcolo automatico delle ore dagli orari delle lezioni e rubrica fiscale integrata con ricerca)
- **Calendario Generale** (sincronizzazione bidirezionale Google Calendar & Google Meet / link riunioni personalizzati e integrazione macOS EventKit)
- **Aggiornamenti Silenziosi in Background** (verifica automatica all'avvio e ogni 24 ore con download in background e installazione automatica al riavvio successivo)

## Struttura del Repository
- `Sources/` — Codice sorgente nativo Swift / SwiftUI per macOS (`ClassDesk.app`)
- `Windows-Version/` — Codice sorgente nativo C++ / WebView2 (`native/app_native.cpp`, `src/index.html`) e configurazione Inno Setup per Windows (`ClassDesk-Setup.exe`)
- `manage_version.py` — Gestore centralizzato di versioni, build e canali (`stable` / `unstable`)

## Compilazione

### macOS
```bash
python3 manage_version.py set 26.10.5-001 --channel unstable
```

### Windows (Cross-Compilation + Inno Setup)
```bash
cd Windows-Version/native && ./build_native.sh
```

## Suite

Dalla versione 26.11.0-001 ClassDesk fa parte della **ClassDesk Suite** (ClassDesk + StudyDesk + HubDesk, stessa versione e stesso canale).
HubDesk installa e aggiorna le app e collega i computer; ClassDesk scrive i propri dati come **record** in
`DeskHub/records/classdesk/` (macOS `~/Library/Application Support/DeskHub/`, Windows `%APPDATA%\DeskHub\`) e HubDesk li scambia con gli altri computer
(specifica: `Hub/HUBDESK.md`). I file `ClassDesk/classdesk_state_v1.json` e iCloud restano come prima.

**Record (app `classdesk`)**: `course:<id>` (corso con livelli, moduli, lezioni, presenze, voti, fatturazione), `student:<id>`, `rubric:<id>`,
`contact:<id>` (profili di fatturazione), `trash:<id>` (cestino), `settings:general` (lingua, formato data/ora, valuta, soglia, tariffe e durate predefinite).
Non vengono mai sincronizzati: token e account Google, flag iCloud, stato degli aggiornamenti, tema, barra laterale, corso attivo. Ogni record sta sotto ~2 MB.

**Regola di avvio e sincronizzazione** (macOS `Sources/SuiteSync.swift`, Windows `index.html`, stesse regole):
- ClassDesk ricorda per ogni chiave l'hash dell'ultimo valore scambiato (`suite_sync_state.json` / `localStorage`).
- Salvando, scrive solo i record il cui hash cambia; un elemento eliminato diventa un tombstone (`deleted: true`).
- Primo avvio con dati locali già presenti: esporta tutto. Un record di un altro dispositivo vince sul dato locale solo se è più recente
  dei dati caricati all'avvio (o se il dato locale non è cambiato dall'ultimo scambio); su un'installazione vuota vincono sempre i record.
- Dopo il primo avvio: un record diverso dal dato locale viene applicato solo se il dato locale è invariato dall'ultimo scambio; se sono cambiati
  entrambi, resta il dato locale e il conflitto lo gestisce HubDesk. Una cancellazione (tombstone) vale solo su dato locale invariato.
- **Backup automatico** prima della prima applicazione di dati remoti: macOS `Documenti/ClassDesk/Backup/ClassDesk_PreSuiteSyncBackup_*.json`,
  Windows `backup_pre_sincronizzazione_suite_*.json` (cartella dei backup automatici).
- Nessuna eco: dopo aver applicato un record si memorizza l'hash del valore locale risultante, quindi non viene riscritto.
- macOS ascolta la cartella dei record e i messaggi `{"t":"records","app":"classdesk"}` di HubDesk; Windows (WebView2, senza socket) legge la cartella ogni 2 s.
- L'ordine dei corsi non viene sincronizzato (i corsi nuovi arrivano in coda).

**HubDesk**: se manca viene scaricato e installato all'avvio (macOS `DeskHubBootstrap.ensureHub`, Windows `ClassDesk-Suite-<v>-Setup.exe --silent`).
Con HubDesk installato «Cerca aggiornamenti» apre HubDesk (pagina `updates`); l'aggiornatore interno resta come ripiego.
Asset di release: macOS `ClassDesk-<v>-macOS.zip`, Windows `ClassDesk-<v>-win-x64.exe`; `ClassDesk-Suite-<v>-Setup.exe` / `-Installer.pkg` sono dei pacchetti della suite.
Impostazioni → «Suite ClassDesk»: stato di HubDesk, dispositivi collegati, conflitti, apri/installa HubDesk e StudyDesk.

**Variabili per i test**: `CLASSDESK_DATA_DIR` (sposta dati, backup e disattiva iCloud/aggiornamenti), `DESKHUB_HOME`, `DESKHUB_NO_LAUNCH=1`, `DESKHUB_NO_BOOTSTRAP=1`, `DESKHUB_NO_LINK=1`.
Test: `Tests/run_suite_test.sh` (macOS), `node Tests/web_records_test.js` e `node Tests/web_suite_sync_test.js` (Windows).
