# Changelog

## v26.11.0-004 (Unstable) – 1 novembre 2026
- Animazioni morbide nella versione Windows/web: pagine e schede che entrano, finestre e pannelli che si aprono, pulsanti e interruttori che reagiscono (disattivate con «riduci movimento» del sistema).
- Mac: il passaggio tra le pagine è animato (dissolvenza con un breve movimento verso l'alto).
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
