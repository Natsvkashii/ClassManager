# StudyDesk – Sincronizzazione e Lavagna condivisa

> **Dalla 26.11.0-001 la rete è gestita da HubDesk** (ClassDesk Suite). La specifica è in `Hub/HUBDESK.md` (§1 record, §3 rete,
> §4 canale locale, §5 lavagna condivisa, §6 migrazione/aggiornamenti). Le sezioni 1 e 2 di questo documento (`_sdsync._tcp`,
> `_sdboard._tcp`) descrivono il **protocollo diretto delle versioni 26.10**, che resta disponibile (spento di default, nella pagina
> Sincronizzazione sotto «Sincronizzazione diretta (versioni 26.10)») per i dispositivi non ancora aggiornati.

## 0. StudyDesk e HubDesk

### Record (`records/studydesk/…` in `DeskHub/`, o `DESKHUB_HOME`)
StudyDesk specchia i propri dati sincronizzabili in `DeskHubRecords(app:"studydesk")` (macOS) / `createRecords('studydesk')` (Windows),
con le **stesse chiavi e gli stessi valori** del vecchio `_sdsync` (§1 più sotto):

| chiave | valore |
|---|---|
| `group:<groupId>` | il gruppo |
| `progress:<contesto>::<moduleId>::<partId>` (o `progress:<moduleId>::<partId>`) | il risultato della parte |

- Le cancellazioni sono **tombstone** (`deleted:true, value:null`) scritti con `remove`; il vecchio `deleted:<chiave>` resta solo nel protocollo diretto.
- **Salvataggio**: a ogni salvataggio (debounce 400 ms) si scrivono solo i record il cui hash è cambiato (`put` non riscrive se l'hash è uguale).
- **Arrivo**: file watch su `records/studydesk/` e messaggio `{"t":"records"}` dal canale locale → i valori diversi vengono applicati ai dati
  (stessa logica di apply/delete del vecchio motore); un tombstone cancella il dato locale e registra la cancellazione.
- **Niente eco**: StudyDesk ricorda per ogni chiave l'hash su cui i due lati erano d'accordo (`mirror-studydesk.json` in `DeskHub/`):
  riscrive un record solo se il dato locale è cambiato rispetto a quell'hash, e applica un record solo se è cambiato lui.
- **Avvio** (import + export): senza storia (primo avvio, o chiave mai vista) un dato presente solo qui viene esportato, uno presente solo
  nell'hub viene importato; **se esistono entrambi e sono diversi, vince il record dell'hub solo se il suo `device` è diverso da questo
  dispositivo ed è più recente per `updatedAt` (confrontato con `updatedAt`/`createdAt` del valore locale); altrimenti si esporta il dato locale.**
  Un tombstone dell'hub cancella il dato locale con la stessa regola.
- I conflitti tra dispositivi non si risolvono in StudyDesk: li gestisce HubDesk (pagina *Conflitti*).

Codice: `electron/records-mirror.js` + `electron/hubdesk.js` (Windows), `macOS/Sources/HubDeskSuite.swift` (macOS).

### Pagina Sincronizzazione
Pannello di stato di HubDesk: installato / in esecuzione, dispositivi collegati (dal canale locale, ripiego `peers.json`), conflitti
(`conflicts.json`), pulsanti «Apri HubDesk» (pagina *Dispositivi*) e «Installa HubDesk» se manca. Android e versione web, senza HubDesk,
mantengono il comportamento precedente.

### Lavagna condivisa automatica (§5 di HUBDESK.md)
Con il canale locale collegato, almeno un peer collegato e `autoBoard` attivo (`settings.json` di DeskHub, predefinito `true`):
- ogni evento locale (`begin`/`pt`/`end`/`undo`/`clear`/`background`) è inviato come `{"t":"board","msg":{…}}`; i tratti hanno id globali `<deviceId>:<n>`;
- i messaggi `{"t":"board","from":…,"msg":…}` in arrivo sono disegnati sulla **stessa lavagna** (collaborativa, non di sola lettura), anche con la
  lavagna chiusa (il modello vive nello store/modulo `hubdesk.js`); `undo` rimuove l'ultimo tratto **di quel dispositivo**; `clear` e `background` valgono per tutti;
- all'apertura della lavagna, a `peer-joined` e quando un peer si collega si invia `{"t":"snapshot","strokes":[…],"background":…}`; chi la riceve unisce per `id`
  (idempotente; lo sfondo dello snapshot vale solo se la lavagna era vuota);
- barra: indicatore «Condivisa con: <nomi>» e pulsante pausa; la barra sta su **una sola riga** (icone compatte, il resto nel menu «…»).
- La condivisione `_sdboard` (sola visione) resta per compatibilità, nel menu «…».

### Aggiornamenti e asset
StudyDesk si aggiorna da HubDesk (il pulsante «Cerca aggiornamenti» apre HubDesk → *Aggiornamenti*); l'aggiornatore interno è il ripiego se HubDesk manca.
Repo `Natsvkashii/ClassManager`, tag `v26.11.0-001`. Asset propri: `StudyDesk-<v>-mac.zip` (nome senza «macos»/«classdesk»), `StudyDesk-<v>-win-x64.exe` (senza «setup»),
`StudyDesk-<v>-Android.apk`; `StudyDesk-<v>-mac-Installer.pkg` solo in locale. L'aggiornatore sceglie solo gli asset che iniziano con `StudyDesk-`.

---

# Protocollo diretto delle versioni 26.10

Entrambi i servizi usano **TCP + JSON a righe** (un oggetto JSON per riga, terminato da `\n`, UTF-8) e vengono
annunciati con **Bonjour / mDNS** sulla rete locale. Nessun server esterno: i dati non escono dalla rete.

## 1. Sincronizzazione (`_sdsync._tcp`)

### Sicurezza
In *Sincronizzazione* l'utente imposta lo stesso **codice di sincronizzazione** su tutti i suoi dispositivi.
Solo i dispositivi con lo stesso codice si vedono e si scambiano dati: `secret = sha256("studydesk-sync:" + codice)` in esadecimale.
Senza codice la sincronizzazione è disattivata (il servizio non viene annunciato).

### Record sincronizzati
Ogni dato è un **record** con chiave stabile e valore JSON. Hash = `sha256` del JSON canonico (chiavi ordinate, senza spazi), in esadecimale.

| chiave | valore |
|---|---|
| `group:<groupId>` | il gruppo (BOOKS_ROLES_GROUPS.md §3) |
| `progress:<contesto>::<moduleId>::<partId>` oppure `progress:<moduleId>::<partId>` | il risultato della parte (PROGRESS_FORMAT.md) |
| `book-groups:<bookId>` | `{"groupIds":[…]}` (non usato da macOS: i gruppi contengono già `bookIds`) |
| `deleted:<chiave>` | `{"deletedAt":"ISO"}` — tombstone di un record eliminato |

I file dei moduli e dei libri **non** sono record: il manifest li elenca (`modules`) e si possono copiare su richiesta.

### Messaggi
```jsonc
// 1. chi si connette
{"t":"hello","device":"<uuid>","name":"MacBook di Guaira","platform":"macos","secret":"<hex>","proto":1}
// risposta
{"t":"hello","device":"…","name":"…","platform":"windows","proto":1}         // oppure {"t":"error","message":"codice errato"} e chiusura
// 2. elenco dei record
{"t":"manifest"}  →  {"t":"manifest","records":{"group:grp-1":"<hash>",…},"modules":[{"id":"…","version":"1.0.0","title":"…","bytes":12345}]}
// 3. scaricare record
{"t":"get","keys":["group:grp-1",…]}  →  {"t":"records","records":{"group:grp-1":{…valore…},…}}
// 4. inviare record (il destinatario li salva così come sono)
{"t":"put","records":{"group:grp-1":{…}}}  →  {"t":"ok"}
// 5. registrare l'accordo raggiunto (hash comune per chiave)
{"t":"base","hashes":{"group:grp-1":"<hash>",…}}  →  {"t":"ok"}
// 6. copiare un modulo: la risposta è una riga di intestazione seguita da `bytes` byte grezzi (zip .sdmod)
{"t":"getModule","id":"…"}  →  {"t":"moduleData","id":"…","bytes":N}\n<N byte>
```

### Algoritmo (eseguito da chi avvia la sincronizzazione)
Per ogni dispositivo remoto si conserva `base[deviceRemoto][chiave] = hash` concordato all'ultima sincronizzazione.
Per ogni chiave presente su almeno uno dei due lati (L = hash locale, R = hash remoto, B = base):
- `L == R` → già allineati; B := L.
- `R` assente, `L` presente: se `B == nil` → invia; se `B == L` → il remoto l'ha eliminato → elimina in locale; altrimenti **conflitto**.
- `L` assente, `R` presente: simmetrico (scarica / elimina sul remoto / conflitto).
- `L != R`: se `B == L` → scarica (solo il remoto è cambiato); se `B == R` → invia; altrimenti **conflitto**.

I **conflitti** non vengono risolti automaticamente: l'app mostra l'elenco con i due valori affiancati (questo dispositivo / l'altro)
e l'utente sceglie quale conservare per ciascuno (o «tutti questo» / «tutti l'altro»). Poi si invia `base` con gli hash concordati,
così entrambi i lati salvano la stessa base per la volta successiva.

## 2. Lavagna condivisa (`_sdboard._tcp`)

Chi condivide la lavagna apre un listener TCP annunciato come `_sdboard._tcp` (nome = nome del computer). Chi guarda si connette e
riceve i messaggi; la lavagna remota è in sola lettura. Le coordinate sono **normalizzate** (0–1) su una lavagna 16:9, lo spessore
`w` è una frazione della larghezza, `p` è la pressione (0–1, 0.5 se assente).

```jsonc
{"t":"snapshot","strokes":[{"id":"…","color":"#0f172a","w":0.004,"eraser":false,"points":[{"x":0.1,"y":0.2,"p":0.5},…]}],"background":"#ffffff"}  // appena connessi
{"t":"begin","id":"…","color":"#ef4444","w":0.004,"eraser":false}
{"t":"pt","id":"…","x":0.52,"y":0.31,"p":0.7}
{"t":"end","id":"…"}
{"t":"undo"}   {"t":"clear"}   {"t":"background","color":"#ffffff"}
```

Dalla 26.11 (le versioni precedenti ignorano i messaggi che non conoscono e continuano a mostrare i tratti):

```jsonc
{"t":"begin","id":"dev:12","color":"#111827","w":0.004,"eraser":false,"line":true}   // linea dritta (puntamento polare): 2 punti
{"t":"text","item":{"id":"dev:13","x":0.1,"y":0.2,"w":0.3,"h":0,"text":"…","size":0.02,"color":"#111827",
                    "bold":false,"italic":false,"underline":false,"align":"left","cell":false,"v":3,"cw":0.05}}  // crea o aggiorna
{"t":"textdel","id":"dev:13"}
{"t":"grid","grid":{"g":0.0562,"cm":2}}      // g = lato del quadretto in frazione della larghezza; null = senza griglia
{"t":"laser","id":"dev:14","x":0.4,"y":0.5}  // puntatore laser: non si salva, svanisce dopo 1,6 s
```

- `snapshot` porta anche `texts` e `grid`; `clear` cancella tratti e testi (non colore e griglia).
- Un testo con `v` più alto sostituisce quello con lo stesso id; `h` = altezza minima (celle), `size` = grandezza del carattere in
  frazione della larghezza; `cell` = scritto in una cella (centrato in verticale); `cw` = quadretto della griglia (il riquadro si
  allarga di quadretti interi).
- `undo` toglie l'ultimo tratto **o testo** del dispositivo (ordine dato dal contatore dell'id `<deviceId>:<n>`).
- `background`: passando da lavagna chiara a scura (e viceversa) gli inchiostri consigliati cambiano nella coppia leggibile
  (`INK_PAIRS` in `boardlogic.js`, uguale su Mac); i colori personalizzati restano.
- La gomma cancella solo l'inchiostro (livello separato): griglia, testi e colore restano.
- Lavagne salvate in un gruppo: `{id, groupId, name, createdAt, updatedAt, board:{strokes,texts,background,grid,date}, thumb}`
  (web: IndexedDB `boards`; Mac: `<StudyDesk>/Boards/<id>.json`), solo sul dispositivo.

Windows: supporto della **penna Microsoft** (Pointer Events: `pointerType == "pen"`, `pressure`, tasto gomma = `buttons & 32`,
palm rejection: i tocchi vengono ignorati mentre la penna è attiva). Mac: mouse, trackpad e tavolette grafiche (pressione da NSEvent),
più la visione in diretta di una lavagna remota. Entrambe a schermo intero, ESC per uscire.
