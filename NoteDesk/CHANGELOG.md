# Note di Rilascio di NoteDesk

Tutti i cambiamenti notevoli a questo progetto sono documentati in questo file.
Concepito, progettato e sviluppato da **Guaira Jaramillo Nitoglia** (<guaira.jaramillo.nitoglia@gmail.com>).
Rilasciato sotto licenza **GNU General Public License v3.0 (GPL-3.0)**.

---

## [26.11.2-004] – 2026-11-10 (Canale: BETA)

### 🚀 Miglioramenti e Correzioni
- **Qualità vettoriale ad alto ingrandimento (Zoom)**: Risolto il rendering sfocato durante lo zoom. Tratti calligrafici, evidenziazioni ad alto contrasto, pattern della carta e pagine PDF vengono disegnati a piena risoluzione Retina/Metal, preservando massima nitidezza a qualsiasi scala (fino al 400%).
- **Strumento Testo**: Risolto il problema delle caselle di testo duplicate all'infinito ad ogni clic. Cliccare su un campo di testo esistente ora lo seleziona per la modifica e lo spostamento; le caselle vuote vengono rimosse e non lasciano ghost text; il trascinamento e il ridimensionamento scalano fluidamente 1:1 sotto qualsiasi fattore di zoom.
- **Stabilità Barra degli Strumenti**: Larghezza fissa per ogni pulsante del dock superiore. Il cambio tra penna stilografica, penna a sfera e pennello non sposta più i controlli e la tavolozza colori adiacenti.
- **Tema Scuro e Indicatori di Spessore**: I tre cerchi di spessore preimpostato includono un disco di sfondo ad alto contrasto in stile GoodNotes, rendendo il punto centrale ben visibile sia in tema scuro che chiaro.

## [26.11.2-002] – 2026-11-10 (Canale: INTERNAL)

### 🌟 Lancio Ufficiale di NoteDesk
NoteDesk debutta nella suite Classroom Tools come applicazione nativa ad altissime prestazioni per la scrittura a mano libera, l'annotazione di libri di testo PDF e il disegno calligrafico avanzato, ispirata all'esperienza d'uso di GoodNotes 6.

### ✨ Funzionalità Principali

#### 🖊️ Motore di Scrittura e 13 Strumenti Dedicati
- **Dock Strumenti a 2 Livelli**: Barra superiore navy profondo (`#1E3A5F`) con comandi di navigazione, miniature pagine, ricerca, zoom, split view e sincronizzazione HubDesk; dock inferiore adattivo con tutti i 13 strumenti ad accesso immediato con un solo clic.
- **Penna stilografica** (`fountainPen`): larghezza calligrafica dinamica in tempo reale basata su velocità, direzione e pressione, con popover dedicato (anteprima sinusoidale dal vivo, selettore stilografica/sfera/pennello, slider Affilatura Punta 0–100%, slider Sensibilità Pressione 0–100%, toggle Disegna e Tieni Premuto).
- **Penna a sfera** (`ballPen`): tratto uniforme con interpolazione curva Catmull-Rom ad altissima fluidità.
- **Pennello** (`brushPen`): cono dinamico espressivo a contrasto elevato per calligrafia artistica.
- **Matita** (`pencil`): rendering grafite testurizzata con micro-puntinatura organica lungo la traiettoria del tratto.
- **Pennarello** (`marker`): tratto deciso a punta tronca con rendering solido.
- **Evidenziatore con Moltiplicazione Colore** (`highlighter`): tecnologia multi-layer con modalità di fusione `.blendMode(.multiply)` (e `CGBlendMode.multiply` nell'esportazione PDF). Il testo nero sottostante dei PDF e l'inchiostro scuro rimangono sempre al 100% neri e nitidi, mentre la carta assume tinte pastello brillanti.
- **Gomma Intelligente** (`eraser`): popover completo con anteprima `Aa`, stili Gomma di Precisione, Gomma Standard e Gomma per Tratti, interruttore "Cancella solo evidenziatore", "Cancella pagina" e "Deselezione automatica".
- **Forme e Tabelle** (`shapes`): riconoscimento automatico di linee rette, rettangoli, ellissi, triangoli e frecce con Disegna e Tieni Premuto, più inserimento di tabelle interattive con celle modificabili.
- **Lazo** (`lasso`): selezione libera vettoriale per spostare, duplicare, ricolorare ed eliminare gruppi di tratti.
- **Sticker ed Elementi** (`stickers`): catalogo integrato di timbri, post-it, stelle e callout per la correzione e la didattica.
- **Immagini** (`image`): inserimento, ridimensionamento e posizionamento di immagini fotografiche e schemi.
- **Casella di Testo** (`text`): testo tipografico con dimensione del font, grassetto, corsivo e colore personalizzabile.
- **Puntatore Laser** (`laser`): raggio laser rosso con scia luminosa ad attenuazione graduale per presentazioni e lezioni dal vivo.

#### 🎨 Palette Colori GoodNotes e Spessori Millimetrici
- **Tavolozza a 24 Colori GoodNotes**: griglia 3x8 di sfumature classiche, pastello e moderne per cartelle, copertine ed inchiostri.
- **Selettore Spessori a Cuneo Tapered**: 3 slot di accesso rapido con popover millimetrico preciso (da 0.10 mm a 10.00 mm), etichetta numerica `X.XX mm` e cursore a pillola verticale.

#### 📚 Gestione Documenti e Studio su PDF
- **Importazione e Studio PDF**: visualizzazione di libri di testo PDF a risoluzione retina e annotazione diretta.
- **Modalità Vista Doppia Pagina (Split View)**: consultazione e scrittura affiancata su due pagine consecutive (come su quaderno aperto).
- **Nuova Cartella Modale**: finestra a scomparsa fedele a GoodNotes con icona cartella dinamica 110x90, campo nome con cancellazione rapida, selettore Colore / Icona e griglia a 24 colori.
- **Modelli di Carta e Colori**: Bianca, Quadretti, Righe, Puntinata, Cornell Notes, Planner Settimanale e Lavagna Scura, con carta Bianca, Crema Calda (`#FDFBF0`) e Lavagna Dark (`#1E242B`).

#### 🔄 Integrazione Classroom Tools e HubDesk
- **Sincronizzazione DeskHub**: connessione a `DeskHubRecords` e `DeskHubLink` (`app: "notedesk"`) per il mirroring dei quaderni e delle cartelle.
- **Lavagna Live Condivisa**: protocollo di trasmissione tratti in tempo reale via LAN (Bonjour `_sdboard._tcp`) compatibile tra macOS e Windows.

---
© 2026 Guaira Jaramillo Nitoglia · Rilasciato sotto Licenza GPL-3.0
