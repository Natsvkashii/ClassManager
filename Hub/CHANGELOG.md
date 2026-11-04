# HubDesk – Changelog

## 26.11.1-015 (Stabile)
- Aggiornamenti automatici separati per ogni app della suite: non appena l'utente chiude un'app con aggiornamento pendente, HubDesk lo installa silenziosamente in background senza riaprirla.
- Rilevamento immediato della chiusura delle applicazioni tramite notifiche di sistema.

## 26.11.1-012 (Stabile)
- Allineamento alla release stabile Classroom Tools 26.11.1-012.

## 26.11.1-011 (Beta)
- Allineamento alla beta Classroom Tools 26.11.1-011 (sincronizzazione dei libri più affidabile in StudyDesk).
- macOS: risolvere conflitti con dati grandi non blocca più la finestra (il lavoro pesante avviene in background).

## 26.11.1-010 (Beta)
- Conflitti: le copie dei libri di StudyDesk in sincronizzazione non vengono più mostrate come conflitti da risolvere (si ripresentavano anche dopo aver scelto una versione); HubDesk tiene da solo la copia più recente e rimuove i conflitti di questo tipo già salvati.

## 26.11.1-009 (Beta)
- Allineamento alla beta Classroom Tools 26.11.1-009 (sincronizzazione delle modifiche ai libri, trascrizioni migliorate). Sostituisce la 26.11.1-008.

## 26.11.1-008 (Beta)
- Allineamento alla beta Classroom Tools 26.11.1-008 (trascrizioni sincronizzate parola per parola in StudyDesk).

## 26.11.1-007 (Unstable)
- Allineamento alla release interna instabile Classroom Tools 26.11.1-007 con risoluzione della schermata vuota all'avvio di ClassDesk su Windows.

## 26.11.1-006 (Unstable)
- Allineamento alla release interna instabile Classroom Tools 26.11.1-006 con perfezionamento dell'indice attività di StudyDesk su Windows e pianificazione lezioni con monitoraggio ore pagate in ClassDesk.

## 26.11.1-005 (Unstable)
- Allineamento alla release interna instabile della suite Classroom Tools 26.11.1-005 con correzione dell'importazione dei libri trasferiti.

## 26.11.1-001 (Unstable)
- Indicatori dinamici del tipo di versione: visualizzazione di un pallino colorato prima del numero di versione (verde con «S» per stabile, giallo con «β» per beta, rosso con «I» per interna) nell'Hub, nelle schede app e nelle informazioni, collegato alle variabili native di ciascuna applicazione.
- Gestione automatica conflitti: apertura immediata della pagina dei conflitti al rilevamento di dati modificati contemporaneamente su più dispositivi.
- Sincronizzazione: silenziati gli avvisi di sincronizzazione riuscita in background; segnalazione solo in caso di errore.
- Allineamento alla release Classroom Tools 26.11.1-001 (versione interna instabile).

## 26.11.0-010 (Stabile)
- Rilascio sul canale Stabile della suite Classroom Tools 26.11.
- Gestione centralizzata della sincronizzazione, avanzamento libri e aggiornamenti per la suite.

## 26.11.0-009 (Unstable)
- Allineamento alla release Classroom Tools 26.11.0-009.
- Gestione centralizzata della sincronizzazione lavagne e avanzamento libri per la suite.

## 26.11.0-008 (Unstable)
- Classroom Tools Release: pacchetti di installazione unificati rilasciati come Classroom Tools con indicazione esplicita per macOS (Apple Silicon) e Windows.
- Impostazioni e canali: commutazione del canale di aggiornamento («Stabile» e «Instabile (Beta)») configurabile unicamente dalle Impostazioni di HubDesk; corretta la localizzazione italiana.
- Windows: risolto il problema della finestra vuota/trasparente quando HubDesk viene aperto o richiamato dalla barra delle applicazioni di Windows.
- Sincronizzazione suite: supporto completo per la sincronizzazione dei libri e dei relativi progressi studio tra i nodi della classe.
- Interfaccia: rimosso il selettore del canale dalla schermata App e il numero di versione dal piè di pagina della barra laterale, mantenendolo centralizzato nei Crediti e nelle Informazioni.

## 26.11.0-007 (Unstable)
- Riapertura automatica: al termine di ogni aggiornamento, le applicazioni aperte (ClassDesk, StudyDesk e HubDesk stesso) si riaprono automaticamente conservando la sessione.
- Rimozione degli attributi di quarantena su macOS per garantire l'apertura immediata post-aggiornamento.
- Gestione aggiornamenti e sincronizzazione centralizzata come unico punto di riferimento della suite.

## 26.11.0-006 (Unstable)
- Lavagna condivisa e canale locale: corretta la consegna dei messaggi iniziali tra HubDesk e StudyDesk su Windows e macOS, evitando la perdita dello snapshot della lavagna alla connessione di un dispositivo.

## 26.11.0-005 (Unstable)
- Windows: HubDesk ora è un'app leggera e veloce (circa 1,5 MB invece di oltre 100 MB), si apre subito, resta nell'area di notifica e mantiene la rete tra i dispositivi, i conflitti e la lavagna condivisa; impostazioni e dati restano al loro posto.
- Windows: l'installer della suite (`ClassDesk-Suite-…-Setup.exe`) pesa ora circa 8–9 MB in totale e avvia l'installazione solo quando premi il pulsante «Installa», così puoi scegliere con calma quali app installare.

## 26.11.0-004 (Unstable)
- Un solo installer per sistema: `ClassDesk-Suite-…-Setup.exe` (Windows) e `ClassDesk-Suite-…-Installer.pkg` (macOS) contengono HubDesk, ClassDesk e StudyDesk; durante l'installazione si scelgono le app (HubDesk è sempre incluso).
- Windows: nuovo installer nativo e leggero con la scelta delle app; HubDesk prende dall'installer solo l'app da installare o aggiornare e la chiude prima di aggiornarla.
- macOS: gli aggiornamenti non si bloccano più sulle app installate dal pacchetto (appartenevano all'amministratore): ora l'installer le assegna all'utente e HubDesk, se serve, chiede la password.

## 26.11.0-003 (Unstable)
- Allineata alla suite 26.11.0-003; nessuna modifica a HubDesk.

## 26.11.0-002 (Unstable)
- Windows: HubDesk ora riconosce la versione di StudyDesk installata (prima mostrava «0.0.0-000» e l'aggiornamento non andava a buon fine).

## 26.11.0-001 (Unstable)
- Prima versione di HubDesk, il centro della ClassDesk Suite (macOS e Windows).
- Gestione app in stile Creative Cloud: installa, aggiorna, apre e disinstalla ClassDesk e StudyDesk; canale Stabile/Unstable, «Aggiorna tutto» e aggiornamenti automatici.
- Rete della suite: i computer con lo stesso codice si trovano da soli in rete locale, restano collegati, si ricollegano da soli e si scambiano subito ogni modifica di ClassDesk e StudyDesk.
- Conflitti: le modifiche fatte nello stesso momento su due computer vengono mostrate affiancate per scegliere quale tenere.
- Lavagna di StudyDesk condivisa in tempo reale tra i dispositivi collegati.
- Migrazione da ClassDesk 26.10: il normale aggiornamento installa la suite; su Windows HubDesk aggiorna subito ClassDesk.
- Icona nella barra dei menu / area di notifica e avvio automatico all'accesso.
