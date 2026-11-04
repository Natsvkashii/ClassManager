# Report di Handoff per Claude — Classroom Tools (v26.11.1-007)

**Data**: 3 novembre 2026  
**Autore del Progetto**: Guaira Jaramillo Nitoglia (`guaira.jaramillo.nitoglia@gmail.com`)  
**Licenza**: GNU General Public License v3.0 (GPL-3.0)  
**Versione Attiva**: `26.11.1-007` (Canale: **Internal / Unstable**)  
**Stato Build & Test**:
- Compilazione Swift macOS (ClassDesk, StudyDesk, HubDesk): **0 errori, 0 warning**.
- Test unitari StudyDesk: **89/89 superati**.
- Test interop HubDesk: **2/2 superati**.
- Build unificata `suite.py`: **SUCCESSO**.

---

## 1. Stato del Progetto & Manutenzione del Repository

### A. Fase 1 di Pulizia e Ottimizzazione (Completata)
- **3.12 GB liberati immediatamente**:
  - Rimossa la directory obsoleta `ClassDesk/Versions/` (32 cartelle di release storiche, ~2.7 GB).
  - Rimossi 84 binari orfani vecchi (`.pkg`, `.exe`, `.zip`, `.pdb`) nella root di `ClassDesk/`, preservando solo i file attivi `26.11.1-007`.
  - Rimosso l'archivio statico non utilizzato `ClassDesk/app_native.lib`.
- **Pulizia Codice Morto**:
  - `ClassDesk/Sources/CourseViews.swift`: rimossi `saveQuickChangesIfNeeded` (linea 951) e `calendarSummaryText` (linea 2873).
  - `ClassDesk/Windows-Version/src/index.html`: rimossi i metodi orfani `openEditSingleDateModal` e `confirmEditSingleDate` (61 righe).
- **Azzeramento Warning del Compilatore**:
  - Risolti tutti i warning Swift in `Models.swift`, `DeskHubRecords.swift`, `HubDeskSuite.swift` e `UpdateManager.swift`.

---

### B. Fase 2 di Pulizia: Risultati della Ricerca di Sicurezza e Rotture da Evitare
Prima di procedere alla Fase 2, è stata condotta un'analisi approfondita per mappare qualsiasi rischio di rottura (*breakage*):

1. **CRITICO (Rischio 10/10) — La convenzione `ClassDesk-Suite-*` vs `Classroom-Tools-*`**:
   - `suite.py` genera copie gemelle degli installer sia come `ClassDesk-Suite-*` che come `Classroom-Tools-*`.
   - **Attenzione**: **NON** eliminare i file o i riferimenti a `ClassDesk-Suite-*` senza un refactoring preventivo!
     - Nel C++ nativo per Windows (`ClassDesk/Windows-Version/native/app_native.cpp:1233`), il controllo di sicurezza rifiuta categoricamente asset il cui nome non inizi con `ClassDesk-Suite-`.
     - In `ClassDesk/Windows-Version/src/index.html:3762`, la funzione `suiteFindHubAsset()` cerca via regex `^ClassDesk-Suite-.+-Setup\.exe$`.
     - In `Hub/electron/shared/deskhub-bootstrap.js:52` e `StudyDesk/electron/deskhub-bootstrap.js:52`, la regex cerca `^ClassDesk-Suite-.*-Setup\.exe$`.
     - In `suite.py:92`, la procedura di packaging di Windows cerca specificamente `Hub/electron/dist/ClassDesk-Suite-%s-Setup.exe`.
   - *Soluzione pianificata*: Mantenere la compatibilità retroattiva aggiornando prima i parser per accettare entrambi i prefissi, oppure mantenere intatta la doppia denominazione.

2. **Dipendenza nei Test su Versioni Storiche in `dist/`**:
   - In `Hub/macOS/Tests/main.swift:145` c'è una verifica di estrazione pacchetto che punta direttamente a `dist/26.11.0-003/ClassDesk-Suite-26.11.0-003-Installer.pkg`.
   - *Soluzione pianificata*: Preservare `dist/26.11.0-003` e `dist/26.11.1-007`, eliminando le altre 18 cartelle storiche in `dist/` per recuperare in sicurezza **~1.1 GB**.

3. **Pulizia Residui di Compilazione Interni (Recupero ~1.25 GB)**:
   - `Hub/electron/dist`: rimuovere i 4 installer storici da 102 MB l'uno e `win-unpacked` (recupero ~738 MB), mantenendo solo `ClassDesk-Suite-26.11.1-007-Setup.exe`.
   - `StudyDesk/dist`: rimuovere `StudyDesk-26.10.0-002-Setup.exe` (110 MB), `win-unpacked` (352 MB) e i vecchi zip intermedi (recupero ~520 MB).
   - `ClassDesk`: rimuovere i due `logo.png` duplicati non utilizzati (`ClassDesk/logo.png` e `ClassDesk/Windows-Version/assets/logo.png`), preservando rigorosamente `ClassDesk/Windows-Version/src/logo.png` (letto da `generate_assets.py:15`).
   - **Divieto Assoluto**: Non cancellare il codice sorgente in `Hub/electron/`, perché `Hub/win-host/build.py` ne importa i moduli a compile-time e funge da fallback per Windows senza WebView2.

---

## 2. Miglioramenti Funzionali Pianificati

### A. StudyDesk: Riproduttore Audio & Trascrizioni (Stile Spotify)
1. **Modalità Schermo Intero Immersiva**:
   - Vista a tutto schermo dedicata con sfondo coordinato alla palette del libro/audio.
   - Visualizzazione dei testi/trascrizioni in caratteri grandi e leggibili.
   - Player control bar in basso con traccia attiva, scrubber temporale preciso, controlli play/pause, velocità e navigazione capitolo.
2. **Sincronizzazione Parola per Parola Fluida**:
   - Ricalibrazione dei timestamp per eliminare il ritardo attuale tra audio riprodotto ed evidenziazione delle parole.
   - Smooth kinetic scrolling (scorrimento continuo, non a scatti) che mantiene la riga e la parola correnti al centro dell'area visibile.
3. **Miglioramento del Contrasto del Testo**:
   - Quando l'audio è fermo o completato, visualizzare il testo con colore scuro pieno/ad alto contrasto, eliminando l'effetto grigiastro sbiadito.

---

### B. StudyDesk: Nuove Funzionalità per Attività ed Esami (Segnalate dagli Agenti)
1. **Contatore di Parole (Word Counter)**:
   - Conteggio dinamico in tempo reale per le caselle di testo libero (`open.js`), con indicazione di parole minime/massime richieste dalla consegna.
2. **Timer del Parlato (Speaking Timer)**:
   - Timer dedicato per gli esercizi orali/speaking (`speaking.js`), configurabile in modalità conto alla rovescia (countdown) o cronometro progressivo per simulazioni d'esame.
3. **Allegati Differenziati per Ruolo (Candidato A / Candidato B)**:
   - Supporto nel formato `.sdbook` per materiali condizionali visibili solo al Candidato A o solo al Candidato B durante prove orali o attività cooperative a coppie.
4. **Selezione Traccia Multipla**:
   - Interfaccia per scegliere una traccia specifica tra più opzioni audio/ascolto disponibili per lo stesso esercizio.
5. **Immagini Inline nel Testo della Consegna**:
   - Supporto avanzato al rendering di immagini inserite all'interno delle istruzioni/consegne markdown dell'esercizio senza spezzare l'impaginazione.
6. **Robustezza Sincronizzazione Libri HubDesk**:
   - Risoluzione dell'errore di chunking/importazione ("Importati 6 capitoli ma ne mancano ancora 8") attraverso verifica preliminare dell'indice pezzi e retry automatico dei blocchi mancanti.

---

### C. ClassDesk: Rifinitura Contabilità e Piano Lezioni
1. **Piano Lezioni & Presenze**:
   - Consolidamento del tracking in tempo reale tra `studentPaidAmount` (importo pagato dallo studente per il modulo) e le ore coperte dal prezzo orario.
   - Visualizzazione chiara delle ore mancanti per completare il modulo.
2. **Creazione Rapida Lezioni**:
   - Creazione rapida di nuove lezioni direttamente dalle caselle del calendario multi-mese con data preimpostata e associazione automatica al modulo attivo.
