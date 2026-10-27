# Changelog — ClassDesk

Tutte le modifiche degne di nota apportate al progetto **ClassDesk** sono documentate in questo file.
Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

---

## [26.10.5-006] — 2026-10-26 (Beta / Unstable)

### Modificato & Perfezionato
- **Fatturazione — Calendario Giorni Lavorati Rigido a 7 Colonne**: risolto definitivamente lo sfasamento dei giorni e il collasso delle colonne vuote nella vista mensile della fatturazione (`PDFAndAnalyticsViews.swift` e `index.html`). La griglia dei quadratini è ora strutturata in righe rigide e deterministiche di 7 colonne da Lunedì a Domenica con larghezza equa al 100%, garantendo l'allineamento perfetto e continuo per qualsiasi mese dell'anno (Agosto, Ottobre, Novembre, ecc.).
- **Azioni Rapide Lezione — Pulsante di Pianificazione Unificato**: eliminato il pulsante duplicato nell'intestazione del popup di modifica rapida di data e orari in `CourseViews.swift`; rimane un unico pulsante evidente con icona matita Apple (`Pianificazione Lezione`) posizionato nella barra inferiore delle azioni accanto ai pulsanti Annulla e Salva.
- **Presenze e Piano Lezioni — Monte Ore Totale del Modulo**: visualizzazione diretta ed evidente del monte ore complessivo del modulo sia nella barra riassuntiva del registro Presenze (`Ore Totali Modulo: X.Xh`) che nella testata del Piano Lezioni (`ModuleCalendarView`).
- **Pianificazione Intelligente — Calcolo Automatico Orario di Fine**: all'inserimento o alla modifica dell'orario iniziale (es. digitando `18:00`), il programma calcola istantaneamente l'orario di fine (es. `20:00`) basandosi sulla durata effettiva dell'ultima lezione registrata nel modulo, senza salvare anticipatamente e permettendo all'utente di personalizzare liberamente l'orario prima di confermare.
- **Registro Changelog In-App Sincronizzato**: aggiornate le note di rilascio sia nell'app nativa macOS che nella versione Windows WebView2, con sincronizzazione atomica del manifest degli aggiornamenti.

---

## [26.10.5-005] — 2026-10-26 (Beta / Unstable)

### Perfezionato
- Sincronizzazione multipiattaforma del calcolo automatico della durata delle lezioni e rafforzamento dei controlli sui limiti temporali.

---

## [26.10.5-004] — 2026-10-26 (Beta / Unstable)

### Correzioni
- **Risoluzione Definitiva Crash Esportazione PDF**: eliminato il conflitto di concorrenza memoria Swift (`_swift_reportExclusivityConflict`) in `CoursePDFGenerator` tramite `CoursePDFPageContext` a riferimento sicuro, garantendo l'esportazione priva di interruzioni.
- **Report Guadagni Annuale Scrollabile**: aggiunta `ScrollView` con spaziatura dedicata per evitare qualsiasi ostruzione di testo o sovrapposizione visiva nella vista contabile.
- **Apertura Corsi Archiviati nelle Schede Normali**: consultazione temporanea in sola lettura del corso archiviato all'interno delle normali schede (Presenze, Voti, Attività) senza riattivazione permanente.

---

## [26.10.5-003] — 2026-10-26 (Beta / Unstable)

### Aggiunto
- **Esportazione PDF Completa del Corso (A4)**: procedura guidata a 3 passaggi dal pulsante Condividi Apple nella Dashboard per esportare Presenze, Voti, Attività, Criteri, Piano lezioni, Struttura e Iscritti, con indice cliccabile e badge Livello/Modulo in alto a destra.
- **Report Guadagni Annuale e Mensile**: nuova sezione in Fatturazione con grafico a candele sui 12 mesi, classifica dei clienti con spesa maggiore, vista mensile a quadratini colorati per giorni con lezioni ed esportazioni PDF annuali, annuali dettagliate e mensili.
- **Azioni Rapide Lezione**: menu contestuale al clic sulle date nelle Presenze e nel Piano Lezioni per modificare rapidamente data e orari.

---

## [26.10.5-002] — 2026-10-26 (Beta / Unstable)

### Aggiunto & Modificato
- **Barra di Scorrimento Orizzontale Fissata in Fondo**: in Presenze e Voti la barra laterale rimane ancorata alla parte inferiore della schermata.
- **Colonna Nomi Studenti Fissa (Sticky) in Voti**: colonna bloccata a sinistra durante lo scorrimento delle attività.
- **Rifinitura Intestazione Presenze in Voti**: rimossa icona rotellina e punteggio massimo.
- **Fatturazione Multi-Profilo**: navigazione a frecce tra profili multipli e associazione flessibile dei clienti.

---

## [26.10.5-001] — 2026-10-25 (Beta / Unstable)

### Aggiunto
- Aggiornamenti silenziosi in background ogni 24 ore.
- Barra superiore di navigazione responsive con frecce di scorrimento e tasto Ripristina (⌘Y / Ctrl+Y).
- Dashboard con conto alla rovescia in tempo reale per la prossima lezione.
