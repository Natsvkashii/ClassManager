# Changelog — ClassDesk

Tutte le modifiche degne di nota apportate al progetto **ClassDesk** sono documentate in questo file.
Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

---

## [26.10.5-008] — 2026-10-28 (Release Ufficiale Stabile)

### Correzioni & Novità Stabili
- **Correzione Sezione Archivio — Etichetta Pulsante Apple Nativo**: risolta l'anomalia grafica che mostrava la chiave raw `openBtn` anziché l'etichetta localizzata `Apri`.
- **Navigazione Affidabile con Corso Archiviato Aperto**: il corso archiviato aperto in modalità ispezione rimane visualizzabile e liberamente consultabile anche navigando in Fatturazione (con banner protetto di sola lettura) e in tutte le altre sezioni generali e di sistema, senza provocare errori di navigazione, sparizione della barra di selezione o schermate 'Nessun corso attivo'.
- **Ri-archiviazione Intelligente e Sicurezza alla Chiusura**:
  - Il corso archiviato viene ri-archiviato automaticamente solo quando l'utente seleziona esplicitamente un altro corso.
  - Alla chiusura dell'applicazione (`willTerminateNotification` / `beforeunload`), l'app ri-archivia automaticamente il corso ispezionato e ripristina il corso attivo precedente (o il primo corso non archiviato), scongiurando qualsiasi crash o incoerenza di stato al successivo avvio.
- **Canale Ufficiale Stabile (`isUnstableBuild = 0`)**: commutazione centralizzata del flag booleano di canale su Stabile, aggiornando all'unisono badge, colori e controlli sia in macOS che in Windows WebView2.
- **Tutte le Novità e Perfezionamenti Recenti**:
  - Cancellazione rapida della lezione tramite icona cestino Apple (`trash`) di colore rosso con conferma preventiva.
  - Richiesta di conferma esplicita prima di eliminare un profilo fiscale.
  - Semplificazione della voce "Dati di fatturazione" senza conteggi numerici.
  - Gestione avanzata delle note personali dello studente con pulsante '+' e visualizzazione dedicata.
  - Icona archivio studenti ad alto contrasto ottimizzata per il tema scuro.

---

## [26.10.5-007] — 2026-10-26 (Beta / Unstable)

### Aggiunto & Modificato
- **Cancellazione Lezione Rapida con Cestino Rosso**: aggiunto nel popover di modifica rapida di data e orari della lezione un pulsante dedicato con icona cestino Apple (`trash`) di colore rosso, corredato da finestra di dialogo per confermare preventivamente l'eliminazione definitiva della lezione e delle relative presenze.
- **Conferma Eliminazione Profilo Fiscale**: introdotta una richiesta esplicita di conferma prima di procedere all'eliminazione di un profilo di fatturazione dalla sezione fiscale, prevenendo cancellazioni accidentali di nominativi e coordinate fiscali.
- **Dati di Fatturazione Semplificati**: la scheda contabile precedentemente intitolata "Banca Dati Clienti" mostra ora esclusivamente la dicitura pulita **"Dati di fatturazione"** senza il conteggio numerico tra parentesi.
- **Scheda Studente e Gestione Note Rinnovata**:
  - Il pulsante superiore per consultare lo storico è stato rinominato sinteticamente in **"Note"**.
  - Rimossa la casella statica "Note" dal corpo principale della scheda studente per una visualizzazione pulita e senza ingombri.
  - Sostituita la dicitura "Solo gruppi attivi" con un pulsante con icona **"+"** che consente di aggiungere note personalizzate sull'alunno con salvataggio persistente nel profilo.
  - Possibilità di consultare ed eliminare le singole note personali dello studente affiancate alle note di lezione dei gruppi attivi.
- **Icona Archivio Studente ad Alto Contrasto nel Tema Scuro**: ridisegnato il pulsante di archiviazione per gli studenti nella sezione Iscritti con contrasto ottimizzato sia in tema chiaro che in tema scuro (ambra dorata luminosa `#FFD94D` con bordo ad alta visibilità), garantendone la perfetta leggibilità.
- **Sincronizzazione Completa Multi-Piattaforma**: allineate tutte le modifiche sia nell'applicazione nativa macOS che nella versione Windows WebView2.

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
