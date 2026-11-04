# Changelog — ClassDesk

Tutte le modifiche degne di nota apportate al progetto **ClassDesk** sono documentate in questo file.
Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

---

## [26.11.1-015] — 2026-11-04 (Stabile)
- Copia con un click su anagrafica, iscritti corso e scheda alunno: tutti i campi e recapiti (nome, telefono, email, città, livello, ecc.) sono cliccabili per copiarli negli appunti con feedback visivo.
- Scheda studente: rimossi i riquadri di input non modificabili, sostituiti da testo pulito e copiabile sotto ogni etichetta.
- Dashboard prossime lezioni: riquadro della prossima lezione dimezzato e allineato a sinistra; a destra griglia 2x2 con le 4 lezioni seguenti con conteggio tempo rimanente dinamico in ore o minuti ("Mancano X ore", "Mancano Y minuti").
- Sistema di aggiornamento automatico e silenzioso: controllo ad avvio e chiusura con download in background; installazione trasparente alla chiusura senza riavvio forzato; applicazione pre-avvio se già scaricato; controllo giornaliero automatico.

## [26.11.1-012] — 2026-11-03 (Stabile)
- Rimossa la sincronizzazione con Google Calendar e i pulsanti per creare sale Google Meet.
- Calendario in Piano lezioni e Fatturazione: pulsante di condivisione con Copia immagine, Copia solo testo, Scarica, Invia per e-mail.
- Azioni secondarie e di eliminazione raccolte in menu «⋯» (corsi, studenti, cestino, contatti, livelli e moduli, rubriche).

## [26.11.1-011] — 2026-11-03 (Beta)
- Allineamento alla beta Classroom Tools 26.11.1-011; nessun cambiamento di funzionamento in ClassDesk.

## [26.11.1-010] — 2026-11-03 (Beta)
- Allineamento alla beta Classroom Tools 26.11.1-010; nessun cambiamento di funzionamento in ClassDesk.

## [26.11.1-009] — 2026-11-03 (Beta)
- Allineamento alla beta Classroom Tools 26.11.1-009 (sostituisce la 26.11.1-008); nessun cambiamento di funzionamento in ClassDesk.

## [26.11.1-008] — 2026-11-03 (Beta)
- Pulizia del progetto: rimossi file di build obsoleti e copie duplicate del logo; nessun cambiamento di funzionamento.

## [26.11.1-007] — 2026-11-02 (Unstable)
- Windows: risolto l'errore di sintassi all'avvio in WebView2 dovuto a una virgola residua dopo la definizione di metodo nella classe JavaScript, che bloccava l'inizializzazione dell'interfaccia e causava l'apertura su schermata vuota.

## [26.11.1-006] — 2026-11-02 (Unstable)
- Fatturazione Modulo: salvataggio immediato e persistente dell'importo pagato dallo studente (`studentPaidAmount`) con conferma esplicita al cambio valore, svincolato dal reset delle tariffe batch.
- Presenze e Piano Lezioni: visualizzazione in tempo reale e sempre visibile delle ore pagate dallo studente (`Ore Pagate: X.Xh`) e calcolo automatico delle ore mancanti da pianificare (`Mancano da fare: X.Xh` o `Ore Pagate Coperte`).
- Creazione Lezioni dal Piano Lezioni: aggiunto il pulsante «Nuova Lezione» nella barra degli strumenti del calendario del modulo e un pulsante rapido «+» su ogni singola cella giornaliera per pianificare lezioni direttamente dal calendario.

## [26.11.1-005] — 2026-11-02 (Unstable)
- Allineamento alla release interna instabile della suite Classroom Tools 26.11.1-005 con correzione della sincronizzazione libri tra dispositivi tramite HubDesk.

## [26.11.1-001] — 2026-11-02 (Unstable)
- Allineamento alla release interna instabile della suite Classroom Tools 26.11.1-001.
- Indicatori versione: aggiunto l'indicatore dinamico a pallino prima del numero di versione (S verde per stabile, β giallo per beta, I rosso per interna instabile) nei Crediti, nelle Informazioni e nella barra laterale.
- Sincronizzazione: rimossa la notifica toast di avvenuta ricezione dati da un altro computer in background; le notifiche appaiono esclusivamente in presenza di errori.
- Conflitti: richiesta automatica di apertura della pagina dei conflitti in HubDesk quando vengono rilevati elementi modificati su due dispositivi.

## [26.11.0-010] — 2026-11-01 (Stabile)
- Rilascio sul canale Stabile della suite Classroom Tools 26.11.
- Consolidamento delle funzionalità di sincronizzazione continua e fatturazione automatica.

## [26.11.0-009] — 2026-11-01 (Unstable)
- Allineamento suite Classroom Tools 26.11.0-009.
- Miglioramenti di stabilità e sincronizzazione centralizzata con StudyDesk e HubDesk.

## [26.11.0-008] — 2026-11-01 (Unstable)
- Fatturazione nuovi moduli: creazione di un nuovo modulo con mantenimento automatico dei parametri di fatturazione (tariffa oraria, durata lezione, IVA, sconto e contatti di fatturazione) ereditati dal modulo precedente o attivo.
- Interfaccia: rimosso il numero di versione dal piè di pagina della barra laterale per centralizzarne la visualizzazione nei Crediti e in HubDesk.
- Windows: garantita la corretta ridisposizione e visibilità della finestra WebView2 al ripristino dalla barra delle applicazioni.

## [26.11.0-007] — 2026-11-01 (Unstable)
- Centralizzazione suite: rimosse le impostazioni di verifica aggiornamenti e le sezioni di configurazione della sincronizzazione dall'applicazione. Tutti gli aggiornamenti e lo stato dei dispositivi collegati sono gestiti e visualizzati centralmente in HubDesk. Note di rilascio e crediti autore rimangono disponibili nella sezione Crediti.

## [26.11.0-006] — 2026-11-01 (Unstable)
- Allineata alla suite 26.11.0-006 (correzione della sincronizzazione in tempo reale della Lavagna tra Windows e macOS).

## [26.11.0-005] — 2026-11-01 (Unstable)
- macOS: corretto un arresto anomalo nelle impostazioni della Suite quando la lista dei dispositivi collegati si aggiorna.
- Windows: la barra laterale e il piè di pagina mostrano sempre la versione attuale del programma anche subito dopo un aggiornamento.

## [26.11.0-004] — 2026-11-01 (Unstable)
- Animazioni (Mac e Windows): ogni sezione entra con una dissolvenza e un breve movimento verso l'alto, schede e riquadri compaiono morbidi, le finestre si aprono con un piccolo effetto; disattivate con «Riduci movimento». Su Windows l'animazione parte solo quando cambi sezione, non a ogni modifica.
- Si installa e si aggiorna dall'unico installer della suite.

## [26.11.0-003] — 2026-11-01 (Unstable)
- Windows: corretto l'errore all'avvio che lasciava vuote la Dashboard e la pagina Corsi quando c'è almeno un corso attivo (presente dalla 26.10.5-008). I dati non erano andati persi.

## [26.11.0-002] — 2026-11-01 (Unstable)
- Allineata alla suite 26.11.0-002 (correzione di HubDesk su Windows); nessuna modifica a ClassDesk.

## [26.11.0-001] — 2026-10-31 (Unstable)

- ClassDesk diventa ClassDesk Suite: insieme a StudyDesk e HubDesk, stessa versione e stesso canale.
- HubDesk: nuova app che installa, aggiorna, apre e disinstalla ClassDesk e StudyDesk; viene installata automaticamente.
- Rete della suite: i computer si trovano da soli, restano collegati e si scambiano subito corsi, studenti e dati di ClassDesk; i conflitti si risolvono in HubDesk; backup automatico prima della prima sincronizzazione.
- Gruppi sempre allineati con StudyDesk (solo gruppi attivi).
- Nuova sezione Suite nelle impostazioni.
- Interfaccia: «1 iscritto» e «1 lezione» al singolare, conto alla rovescia della prossima lezione scritto «Tra 2h 36m» invece di «-02h 36m», intestazione del Piano lezioni su due righe senza testo schiacciato, niente pulsanti doppi in Fatturazione, sezione dei gruppi condivisi con StudyDesk a tutta larghezza.
- Aggiornamento dalla versione 26.10 alla suite senza perdita di dati (macOS e Windows).

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
