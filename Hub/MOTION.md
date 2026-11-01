# Animazioni della ClassDesk Suite

Un solo sistema per ClassDesk, StudyDesk e HubDesk, su Mac (SwiftUI) e Windows/web (CSS). Le animazioni accompagnano il
lavoro senza rallentarlo: brevi, morbide, mai sui dati che si stanno scrivendo.

## Principi
1. **Durata breve**: 0,16–0,36 s. Nessuna animazione blocca un clic.
2. **Solo quando cambia il contesto**: cambio pagina, apertura di un pannello o di una finestra, comparsa di una scheda. Non a
   ogni salvataggio o ridisegno della stessa pagina (ClassDesk Windows ridisegna la pagina a ogni modifica: l'entrata parte
   solo da `switchTab`).
3. **Stesso linguaggio su tutte le piattaforme** (tabella sotto).
4. **Accessibilità**: con «Riduci movimento» (macOS) o `prefers-reduced-motion` (Windows) tutto è disattivato.
5. **Riutilizzabile nella versione nativa di Windows**: su Windows le animazioni sono solo CSS dell'interfaccia, quindi passano
   così come sono quando StudyDesk e HubDesk lasciano Electron.

## Vocabolario
| nome | uso | Mac (SwiftUI) | Windows/web (CSS) |
|---|---|---|---|
| **entrata pagina** | cambio di sezione | `.id(tab)` + `.transition(.opacity + offset y 8)`, `easeOut 0,25 s` | `rise` 0,32 s su `vista > *` |
| **entrata scheda** | schede, riquadri, statistiche | `.appearIn(index)` (opacità + y 10, molla 0,42 s, ritardo 40 ms per indice, max 6) | `rise` con ritardo per `:nth-child` |
| **sollevamento** | schede cliccabili al passaggio del mouse | `.hoverLift()` (scala 1,02 + ombra, molla 0,28 s) | `translateY(-3px)` + ombra |
| **pressione** | pulsanti | `PressScale` (0,96) | `:active scale(.97)` |
| **pannello** | menu, popover, finestre modali | sistema (popover/sheet) | `pop` / `drop` 0,16–0,22 s |
| **conferma** | messaggi in basso | `.move(edge: .bottom) + opacity` | `slide` con molla |

Curve: uscita morbida `cubic-bezier(.2,.8,.2,1)`, molla `cubic-bezier(.34,1.56,.64,1)` (SwiftUI `spring(response:dampingFraction:)`).

## Dove si trova
- StudyDesk Mac: `StudyDesk/macOS/Sources/Motion.swift`; ClassDesk Mac: `ClassDesk/Sources/Motion.swift` (stesso file).
- StudyDesk Windows/web: `StudyDesk/app/css/app.css` (sezione «motion»); ClassDesk Windows: `<style>` di `index.html`
  (sezione «motion») + classe `cd-enter` messa da `switchTab`.
