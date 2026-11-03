# Changelog

## v26.11.1-012 (Interna) – 3 novembre 2026
- Interfaccia più semplice: azioni secondarie raccolte in menu «⋯» (lavagna, libreria, gruppi, editor di moduli e libri, barra dell'esercizio, avviso di aggiornamento).

## v26.11.1-011 (Beta) – 3 novembre 2026
- Sincronizzazione dei libri: se due computer hanno copie diverse con lo stesso numero di revisione (ad esempio dopo un aggiornamento da una versione precedente), la copia pubblicata più di recente arriva comunque agli altri, invece di bloccare la sincronizzazione.
- Windows: i gruppi archiviati in ClassDesk restano archiviati (prima Windows perdeva l'indicazione e i due computer si riscrivevano il gruppo a vicenda ogni pochi secondi, ricaricando di continuo la pagina) e, come su Mac, non vengono più mostrati.

## v26.11.1-010 (Beta) – 3 novembre 2026
- Sincronizzazione dei libri: un computer non ripubblica più un libro quando esiste già una copia più recente (la riceve); l'editor dei libri su Windows salva correttamente il numero di revisione.

## v26.11.1-009 (Beta) – 3 novembre 2026
Comprende tutte le novità della 26.11.1-008 (sostituita da questa versione), più:
- Sincronizzazione dei libri tra computer: ora si trasmettono anche le modifiche ai capitoli già presenti sull'altro computer (prima arrivavano solo i capitoli mancanti). Vince la copia modificata per ultima.
- Trascrizioni: ogni parola diventa bianca solo dopo essere stata pronunciata (non più l'intero paragrafo); prima dell'avvio il testo è tutto ben leggibile; lo scorrimento segue la parola pronunciata, sia nella trascrizione sia a schermo intero.
- Schermo intero: pulsante a sola icona; la trascrizione si apre davvero a schermo intero (su macOS in uno spazio proprio, su Windows a tutto schermo) e non più in una finestra.
- macOS: pulsante «Indice» con il colore uniforme; pulsante «⋯» delle copertine dei libri ben visibile.

## v26.11.1-008 (Beta) – 3 novembre 2026
- Trascrizioni audio sincronizzate in tempo reale: con i tempi delle parole calcolati da `scripts/align_audio.py` (allineamento WhisperX) la trascrizione e la vista a schermo intero seguono l'audio parola per parola; senza tempi resta la stima precedente.
- Lettore web/Windows: corretto un errore che poteva bloccare la trascrizione sincronizzata (`clear` non importato).
- Trascrizione (macOS): non si blocca più aprendola mentre l'audio è in riproduzione, e alla fine di ogni riga non salta più in fondo al testo.
- Editor del libro (macOS): «Modifica» apre davvero il capitolo nell'Editor; il pulsante ⊖, che toglieva il capitolo dal libro con un solo clic, è sostituito da un menu «⋯» con conferma.

## v26.11.1-007 (Unstable) – 2 novembre 2026
- Allineamento alla release interna instabile Classroom Tools 26.11.1-007 (correzione avvio ClassDesk su Windows).

## v26.11.1-006 (Unstable) – 2 novembre 2026
- Windows – Visualizzazione Indice: risolto il problema di sovrapposizione e troncamento del popover dell'indice delle attività portando l'indice di livello superiore a z-index 1000, impostando lo sfondo opaco a contrasto elevato con ombra pronunciata e posizionamento relativo della barra superiore per evitare conflitti di sovrapposizione con le schede degli esercizi.
- Windows – Barra superiore: rimosso il pulsante ridondante accanto all'indice per nascondere la barra laterale, mantenendo un'interfaccia pulita e priva di duplicati.
- Indice Attività: migliorata la testata del popover con riepilogo del modulo, percentuale di completamento ed elegante barra di avanzamento grafica.

## v26.11.1-005 (Unstable) – 2 novembre 2026
- Sincronizzazione Libri – Risolto bug importazione capitoli: corretta la decodifica JSON in Swift per la proprietà `labels` degli esercizi (supporto trasparente sia come array `[String]` che come stringa singola) e per `rows`, risolvendo il fallimento dell'importazione di capitoli nei libri sincronizzati tramite HubDesk (es. *Nuovo Espresso Plus 1*, dove 8 capitoli su 14 fallivano la decodifica).
- Log decodifica moduli: aggiunto tracciamento esplicito degli errori in `reloadModules` e `importBookFile` per evitare fallimenti silenziosi durante l'importazione.

## v26.11.1-001 (Unstable) – 2 novembre 2026
- Esercizi – Ingrandimento a 4 livelli: nuovo controllo per ingrandire e rimpicciolire testo, pulsanti, opzioni e campi degli esercizi su 4 livelli base (1: 100% Normale, 2: 120% Medio, 3: 140% Grande, 4: 160% Molto grande) sia nella barra delle azioni che in modalità schermo intero e nelle Impostazioni; adattamento flessibile di righe, colonne e altezze di riga.
- Trasferimento libri: risolto il problema di sfarfallio (comparsa e scomparsa ripetuta) della notifica di stato del trasferimento libri durante lo scambio tra computer.
- Sincronizzazione: silenziate le notifiche toast di sincronizzazione automatica completata con successo in background; le notifiche vengono mostrate esclusivamente se si verifica un errore.
- Risoluzione conflitti: apertura automatica della pagina dei conflitti in caso di modifiche concorrenti non risolte per consentirne la risoluzione tempestiva.
- Indicatori versione: aggiunto l'indicatore dinamico a pallino (S per stabile, β per beta, I per interna instabile) prima del numero di versione.

## v26.11.0-010 (Stabile) – 1 novembre 2026
- Release Stabile per Classroom Tools: promossa la versione 26.11 al canale Stabile con tutte le funzionalità consolidate.
- Lavagna – Zoom e Pan a due dita: supporto completo per pinch-to-zoom a due dita (touchscreen e trackpad) e spostamento panoramico nell'area della lavagna sia su Windows che su macOS.
- Lavagna – Schermo intero reale a livello di sistema operativo: ripristinata la modalità a schermo intero nativa a tutto monitor su Windows e macOS tramite apposito pulsante e scorciatoie.
- Lavagna – Correzione dimensioni finestra Windows: risolto il problema della lavagna visualizzata «piccola piccola» su Windows espandendo l'area della lavagna al 100% dell'altezza e larghezza disponibili.
- Interfaccia macOS: rimossa la modalità di sovrapposizione laterale e garantita la corretta dimensione minima per evitare tagli o sovrapposizioni visive tra barra laterale e sezioni Gruppi e Lavagna.
- Scorciatoie zoom: pulsante rapido di indicazione percentuale e ripristino zoom (100%), scorciatoie da tastiera Ctrl/Cmd + / - / 0 e trascinamento panoramico con barra spaziatrice.

## v26.11.0-009 (Unstable) – 1 novembre 2026
- Lavagna – Zoom e Pan a due dita: supporto completo per pinch-to-zoom a due dita (touchscreen e trackpad) e spostamento panoramico nell'area della lavagna sia su Windows che su macOS.
- Lavagna – Schermo intero reale a livello di sistema operativo: ripristinata la modalità a schermo intero nativa a tutto monitor su Windows e macOS tramite apposito pulsante e scorciatoie.
- Lavagna – Correzione dimensioni finestra Windows: risolto il problema della lavagna visualizzata «piccola piccola» su Windows espandendo l'area della lavagna al 100% dell'altezza e larghezza disponibili.
- Interfaccia macOS: rimossa la modalità di sovrapposizione laterale e garantita la corretta dimensione minima per evitare tagli o sovrapposizioni visive tra barra laterale e sezioni Gruppi e Lavagna.
- Scorciatoie zoom: pulsante rapido di indicazione percentuale e ripristino zoom (100%), scorciatoie da tastiera Ctrl/Cmd + / - / 0 e trascinamento panoramico con barra spaziatrice.

## v26.11.0-008 (Unstable) – 1 novembre 2026
- Lavagna – Appunti e Immagini: supporto completo per incollare immagini da app esterne (Cmd+V / Ctrl+V e trascinamento file) e per copiare l'intera lavagna negli appunti come immagine PNG senza doverla prima esportare su file.
- Lavagna – Allineamento verticale del testo: nuovo controllo per allineare le caselle di testo in alto, al centro o in basso.
- Lavagna – Layout barre degli strumenti: risolto il troncamento dei pulsanti su finestre strette in macOS tramite scorrimento orizzontale dei controlli mantenendo sempre visibili titolo e azioni rapide.
- Windows – Correzione avvio Lavagna: risolto l'errore «Cannot access 'exit' before initialization» all'apertura della lavagna su Windows.
- Sincronizzazione: inclusione dei libri della libreria, dei progressi per gruppo e dei progressi personali dell'insegnante nella sincronizzazione continua tra dispositivi tramite HubDesk.
- Interfaccia macOS: corretta la disposizione delle colonne in uscita dalla lavagna e nella visualizzazione gruppi; rimossa la versione dal piè di pagina della barra laterale.

## v26.11.0-007 (Unstable) – 1 novembre 2026
- Lavagna: visualizzazione integrata all'interno della finestra dell'applicazione senza forzare lo schermo intero né alterare la disposizione delle colonne.
- Lavagna: pulsante di chiusura essenziale con icona «X» in macOS e Windows/Web.
- Lavagna: barra degli strumenti a scomparsa rapida tramite pulsante freccia (freccia verso l'alto per nascondere, freccia verso il basso per mostrare).
- Lavagna collaborativa: strumenti di disegno e modifica sempre disponibili e attivi su tutti i dispositivi collegati contemporaneamente.
- Gruppi (macOS): sfondo opaco della colonna dei gruppi per impedire la trasparenza e la sovrapposizione visiva con la barra di navigazione laterale.
- Centralizzazione suite: rimosse le impostazioni di aggiornamento e la scheda di sincronizzazione dalle singole applicazioni; tutto è ora visualizzabile e configurabile esclusivamente in HubDesk. Note di rilascio, crediti e licenza restano disponibili nelle informazioni.

## v26.11.0-006 (Unstable) – 1 novembre 2026
- Lavagna condivisa (Windows e macOS): corretta la sincronizzazione all'avvio e all'apertura della lavagna; quando apri la lavagna su un secondo dispositivo, il disegno già presente sull'altro viene ricevuto subito in entrambe le direzioni.
- Windows: corretto il collegamento iniziale di StudyDesk al canale locale di HubDesk che poteva andare perso se HubDesk rispondeva prima del caricamento completo della pagina.

## v26.11.0-005 (Unstable) – 1 novembre 2026
- Windows: StudyDesk ora è un'app leggera e veloce (circa 3 MB invece di oltre 100 MB), si apre subito e conserva automaticamente libri, moduli, gruppi, progressi e lavagne già presenti sul computer.
- Windows: doppio clic sui file `.sdmod` e `.sdbook` per aprirli direttamente in StudyDesk.

## v26.11.0-004 (Unstable) – 1 novembre 2026
- Animazioni morbide nella versione Windows/web: pagine e schede che entrano, finestre e pannelli che si aprono, pulsanti e interruttori che reagiscono (disattivate con «riduci movimento» del sistema).
- Mac: il passaggio tra le pagine è animato (dissolvenza con un breve movimento verso l'alto); schede dei moduli, statistiche e lavagne salvate entrano morbide e si sollevano al passaggio del mouse (disattivate con «Riduci movimento»).
- Si installa e si aggiorna dall'unico installer della suite.

## v26.11.0-003 (Unstable) – 1 novembre 2026
- Allineata alla suite 26.11.0-003; nessuna modifica a StudyDesk.

## v26.11.0-002 (Unstable) – 1 novembre 2026
- Allineata alla suite 26.11.0-002 (correzione di HubDesk su Windows); nessuna modifica a StudyDesk.

## v26.11.0-001 (Unstable) – 31 ottobre 2026
- StudyDesk entra nella ClassDesk Suite insieme a ClassDesk e HubDesk: stessa versione, stesso canale, aggiornamenti da HubDesk.
- Sincronizzazione tramite HubDesk: i dispositivi si trovano da soli, restano collegati e si scambiano subito gruppi e risultati; i conflitti si risolvono in HubDesk.
- Lavagna condivisa automaticamente in tempo reale tra i dispositivi collegati (tratti di tutti sulla stessa lavagna, indicatore e pausa).
- Gruppi di ClassDesk sempre allineati (solo gruppi attivi), ora uno per corso: i moduli dello stesso corso non compaiono più come gruppi separati e i gruppi già importati per modulo vengono uniti (studenti, contenuti assegnati e risultati).
- Corretto: uno studente senza email poteva essere aggiunto di nuovo al gruppo a ogni aggiornamento dall'Hub.
- Attività a schermo intero per studenti e insegnanti: usa tutta la larghezza dello schermo, con pulsanti per nascondere l'elenco delle attività e uscire (Esc).
- L'elenco delle attività a sinistra e la barra di navigazione si possono nascondere (la scelta viene ricordata).
- Libro aperto: i capitoli sono in una griglia che scorre verso il basso; copertine intere con i dettagli sotto l'immagine.
- Interfaccia: «1 studente» al singolare, contatori a zero visibili, copertine dei capitoli intere, pulsanti di sincronizzazione da backup nascosti per i gruppi aggiornati da HubDesk, impostazioni insegnante senza campi doppi.
- Barra della lavagna su una sola riga anche su schermi piccoli (Surface).
- Lavagna: spessore del tratto con una barra a cono che mostra la grandezza, e un selettore colori in stile Paint con colori consigliati per lavagne chiare e scure; tenendo premuto (anche con la penna) una lente ingrandisce il colore scelto.
- Lavagna: riquadri di testo con grassetto, corsivo, sottolineato, grandezza e allineamento a sinistra, al centro o a destra.
- Lavagna: griglia con il lato del quadretto in centimetri e puntamento polare per disegnare linee dritte, tabelle e schemi; con lo strumento Testo si scrive direttamente dentro le celle e i quadretti.
- Lavagna: puntatore laser con linee che svaniscono, pulsante «Cancella la lavagna» con conferma, colore della lavagna (bianco, grigio scuro, nero o personalizzato) cambiabile durante l'uso: gli inchiostri consigliati passano da soli alla versione leggibile.
- Lavagna: data automatica (Impostazioni), lavagne salvate nei gruppi (scheda «Lavagne» del gruppo) ed esportazione in PNG, JPEG e PDF.
- Se HubDesk manca viene installato automaticamente.
- La sincronizzazione diretta delle versioni 26.10 resta disponibile.

## In sviluppo
- Libri divisi in capitoli: file `.sdbook`, campo `book` nei moduli, scaffale in Home con animazione di apertura (i capitoli scorrono e si espandono mostrando la copertina).
- Scelta del ruolo al primo avvio: insegnante o studente (modificabile in Impostazioni).
- Insegnante: gruppi con studenti, libri/moduli assegnati, collegamento in sola lettura ai gruppi di ClassDesk (dati locali su Mac o backup JSON), invito `.sdgroup`, importazione dei progressi degli studenti con tabella dei risultati e dettaglio delle risposte.
- Editor (solo insegnanti) esteso ai libri: copertina, capitoli, ordine, esportazione `.sdbook`.

## v26.10.0-001 (Beta) – 30 ottobre 2026
- Prima versione di StudyDesk: macOS nativo (SwiftUI), Windows (Electron, installer NSIS one-click), Android (Capacitor) e Web/PWA.
- Profilo studente obbligatorio al primo avvio (nome, cognome, email) ed email/indirizzo web dell'insegnante.
- Moduli `.sdmod` importabili, esportabili e creabili con l'editor (testi, immagini, audio, video).
- 10 tipi di esercizio: lettura, scelta multipla, vero/falso, completamento, collegamento, classificazione, ordinamento, tabella, scrittura libera, attività orale con registrazione.
- Progressi salvati automaticamente; esportazione `.sdprogress.json`, invio via email o a un indirizzo web.
- Aggiornamenti come ClassDesk: GitHub Releases + manifest, canali Stabile/Beta, download silenzioso e installazione al riavvio, log comandi.
- Licenza GPL-3.0 e sezione Crediti.
