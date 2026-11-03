# Passaggio di consegne — Classroom Tools (3 nov 2026)

Repo: `/Users/guaira/Documents/Project 0` (branch `stable`, remoto `Natsvkashii/ClassManager`).
Ultimo commit pubblicato: `030174a` = **v26.11.1-011 (Beta)**, prerelease su GitHub, installata su questo Mac.

## 1. Stato attuale: modifiche NON committate (da verificare e rilasciare)

### ClassDesk (macOS `ClassDesk/Sources`, Windows `ClassDesk/Windows-Version/src/index.html` + `native/app_native.cpp`)
- **Rimossa la sincronizzazione con Google Calendar** (accesso OAuth, token, impostazioni, pulsanti, scansione eventi). `Sources/GoogleCalendarManager.swift` eliminato (staged). Su Windows tolto il bridge OAuth nativo. I dati salvati con i vecchi campi Google si caricano ancora (campi ignorati o rimossi).
- **Rimossi i pulsanti «Crea Google Meet».** Il campo link della riunione resta (il nome interno `googleMeetUrl` è stato mantenuto per compatibilità dei dati).
- **Pulsante di condivisione** (icona `square.and.arrow.up`, su Windows `fa-arrow-up-from-bracket`) con menu: Copia immagine · Copia solo testo · Scarica · Invia per e-mail.
  - macOS: componente `CalendarShareMenu` (`GlobalViews.swift` ~4031), usato in Piano lezioni (`CourseViews.swift` ~2422) e Fatturazione (`GlobalViews.swift` ~1713). Testo semplice da `generatePlainModuleScheduleText` (`AppStore.swift`).
  - Windows: `calendarShareButtonHtml` / `openCalendarShareMenu` (`index.html` ~7258, ~7803, ~9743). Limiti: copia immagine richiede il permesso agli appunti di WebView2 (altrimenti scarica); l'e-mail usa `mailto:` senza allegato.
- **Menu «⋯» C1–C9** (vedi `docs/menu-contestuali-proposte.md`, tutti approvati):
  - macOS: componente `EllipsisMenu` (`GlobalViews.swift:12`); C1, C2, C3, C4, C5, C7, C9 fatti.
  - Windows: helper `moreMenuButtonHtml` / `openMoreMenu`; C1, C2, C3, C5, C6, C7, C8 fatti (nuove chiavi di traduzione IT/EN/ES `moreActionsBtn`, `duplicateBtn`, `archiveToFormerBtn`).
- Verifiche fatte: `swiftc -typecheck` senza errori né avvisi; `node --check` sugli script di `index.html` ok. **Non provato nell'app**, e la parte nativa Windows non è ancora stata compilata.

### StudyDesk (macOS `StudyDesk/macOS/Sources`, web/Windows `StudyDesk/app`)
- **Menu «⋯» macOS** S1, S5, S7, S8, S12, S13 fatti (typecheck ok). Nota: S5 sostituisce l'icona dimensione testo con «⋯».
- **Menu «⋯» web/Windows** S2, S3, S4, S6, S9, S10, S11, S14 fatti: helper unico `moreMenu(items, {label})` / `closeMenus()` in `app/js/core/ui.js:78`, stili `.menu-pop` in fondo a `app/css/app.css`. S2: menu «Altro» della lavagna sempre visibile. S11: anche «Elimina» di sezioni/attività è nel menu. `npm test` 96/96, `node --check` ok.

## 2. Da fare dopo
1. Provare nell'app i menu e il pulsante di condivisione (macOS e Windows).
2. **Release interna** (indicatore «I» nelle tre app), es. 26.11.1-012:
   ```bash
   python3 suite.py set 26.11.1-012 --channel unstable   # «unstable» = interna (I); «beta» = β
   python3 suite.py build                                  # macOS + Windows, assets in dist/<v>/
   ```
   Controllare in ogni pkg `AppBuildType = internal` (`pkgutil --expand-full …` poi `plutil -extract AppBuildType raw …`). Aggiornare prima i tre CHANGELOG (StudyDesk, Hub, ClassDesk). Pubblicare solo con l'OK dell'utente: `SSL_CERT_FILE=/etc/ssl/cert.pem python3 suite.py publish --yes` (token dal portachiavi git). Installazione locale: estrarre il pkg e sostituire le tre app in `/Applications` (sono dell'utente, niente password).

## 3. Cose importanti da sapere
- **Canali**: `suite.py set … --channel beta` → badge β, prerelease; `--channel unstable` → interna (I), prerelease. Gli script che scrivevano sempre «internal» sono stati corretti (ClassDesk/StudyDesk/Hub `manage_version.py`).
- **Il Surface («TV-connect»)** è sul canale stabile: non riceve beta/interne da solo, vanno installate a mano (`Classroom-Tools-<v>-Windows-Setup.exe`).
- **Sincronizzazione libri** (StudyDesk): ogni libro ha `rev` (sale a ogni modifica fatta nell'app; lo script `scripts/align_audio.py` lo alza). Vince il `rev` più alto; a parità, una copia mai avuta viene importata (`bookTransferHeld`). HubDesk risolve da solo i record `bookfile:` / `bookchunk:` (non sono conflitti utente).
- **Tempi delle parole** (`wordTimes`) delle trascrizioni: calcolati con WhisperX, ambiente in `~/.cache/studydesk-align` (`scripts/align_audio.py`, doc in `StudyDesk/docs/MODULE_FORMAT.md`). Nuovo Espresso Plus 1 è già allineato (rev 2 sul Mac).
- **Non toccare** i libri PLIDA (`quaderni-plida-*`) né `StudyDesk/docs/AI_ISTRUZIONI_SDBOOK.md`: li gestisce un'altra sessione. Non committare `HANDOFF_*.md`.
- **Nomi degli asset** delle release: non rinominare `ClassDesk-Suite-*` (il vecchio updater dipende da quel prefisso).
- Backup dati StudyDesk: `~/Library/Application Support/StudyDesk-backup-20261103-113209`.

## 4. Problemi aperti noti
- Sul Surface restano copie vecchie dei pezzi del libro (≈290 MB, 420 file `bookchunk`): manca una pulizia automatica delle copie pubblicate da altri dispositivi.
- Conflitto reale su un libro modificato in contemporanea su due computer: vince l'ultima copia pubblicata, nessuna fusione.
