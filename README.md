# ClassDesk v26.10.5-001

**Concepito e Sviluppato da:** Guaira Jaramillo Nitoglia  
**Contatto:** guaira.jaramillo.nitoglia@gmail.com  
**Licenza:** GNU General Public License v3.0 (GPL-3.0) — Vedi [LICENSE](LICENSE)

---

## Panoramica
**ClassDesk** è una suite gestionale accademica multi-livello (QCER: A1, A2, B1, B2, C1, C2) nativa per **macOS** e **Windows 10/11 (64-bit)** per la gestione completa di:
- **Presenze** (con barra di stato della partecipazione, colonna studenti fissa, evidenziazione del giorno odierno e selezione multipla)
- **Piano Lezioni** (con stati visivi di completamento/ritardo, drag & drop, esportazione PNG 1:1 e testo WhatsApp)
- **Voti, Attività e Criteri di Valutazione (Rubriche)** (con calcolo automatico del punteggio delle presenze in base alle ore effettive e massimale configurabile)
- **Anagrafica Studenti** (con storico note delle lezioni per i moduli attivi, filtri e contatti diretti WhatsApp/Email)
- **Fatturazione e Banca Dati Clienti** (con calcolo automatico delle ore dagli orari delle lezioni e rubrica fiscale integrata con ricerca)
- **Calendario Generale** (sincronizzazione bidirezionale Google Calendar & Google Meet / link riunioni personalizzati e integrazione macOS EventKit)
- **Aggiornamenti Silenziosi in Background** (verifica automatica all'avvio e ogni 24 ore con download in background e installazione automatica al riavvio successivo)

## Struttura del Repository
- `Sources/` — Codice sorgente nativo Swift / SwiftUI per macOS (`ClassDesk.app`)
- `Windows-Version/` — Codice sorgente nativo C++ / WebView2 (`native/app_native.cpp`, `src/index.html`) e configurazione Inno Setup per Windows (`ClassDesk-Setup.exe`)
- `manage_version.py` — Gestore centralizzato di versioni, build e canali (`stable` / `unstable`)

## Compilazione

### macOS
```bash
python3 manage_version.py set 26.10.5-001 --channel unstable
```

### Windows (Cross-Compilation + Inno Setup)
```bash
cd Windows-Version/native && ./build_native.sh
```
