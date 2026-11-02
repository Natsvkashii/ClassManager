# HubDesk – Changelog

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
