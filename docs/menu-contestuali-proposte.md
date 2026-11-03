# Proposte di menu contestuali «⋯» — ClassDesk e StudyDesk

Approva i punti per numero (es. «C1, C2, S3»). Ogni menu ha un pulsante «⋯»; le azioni principali restano visibili.

## ClassDesk

| # | Piattaforma | Dove (file:riga) | Nel menu «⋯» | Resta visibile | Perché |
|---|---|---|---|---|---|
| C1 | macOS + Windows | Corsi archiviati, scheda corso — `Sources/GlobalViews.swift:2578`; `Windows-Version/src/index.html:8978` | Ripristina, Elimina definitivamente | Apri | Tre pulsanti uguali; l'eliminazione definitiva è accanto al ripristino |
| C2 | macOS + Windows | Elenco studenti del corso, colonna azioni — `Sources/CourseViews.swift:4014`; `index.html:8019` | Archivia / Reinserisci, Rimuovi | Scheda | 2–3 comandi per riga, due sono azioni di archiviazione/rimozione |
| C3 | macOS + Windows | Cestino, riga elemento — `Sources/GlobalViews.swift:1044`; `index.html:6458` | Elimina definitivamente | Ripristina | L'eliminazione definitiva è attaccata al ripristino |
| C4 | macOS | Scheda corso (piè di pagina) — `Sources/CourseViews.swift:406` | Esporta PDF, Elimina/Archivia | Apri corso | Tre comandi; il cestino è accanto al pulsante principale |
| C5 | macOS + Windows | Fatturazione, riga contatto — `Sources/GlobalViews.swift:1414`; `index.html:9441` | Usa nel corso (macOS), Elimina | Modifica | Modifica ed elimina affiancati in ogni riga |
| C6 | Windows | Schede livello e modulo — `index.html:6705`, `:6726` | Elimina livello / Elimina modulo | Modifica | Eliminazione accanto a Modifica in ogni scheda |
| C7 | macOS + Windows | Rubriche, intestazione criterio / riga rubrica — `Sources/CourseViews.swift:2228`; `index.html:5570` | Elimina | Modifica | Cestino rosso attaccato al pulsante principale |
| C8 | Windows | Editor rubrica, intestazione — `index.html:6612` | Duplica | Modifica avanzata | Guadagno piccolo: da due pulsanti a uno |
| C9 | macOS | Anagrafica studenti, riga — `Sources/GlobalViews.swift:836` | Elimina | Scheda | Cestino rosso in ogni riga (solo due comandi) |

## StudyDesk

| # | Piattaforma | Dove (file:riga) | Nel menu «⋯» | Resta visibile | Perché |
|---|---|---|---|---|---|
| S1 | macOS | Lavagna, barra strumenti — `macOS/Sources/Board.swift:1475` | Cancella la lavagna, Schermo intero, Nascondi barra (nel menu «Altro» già esistente) | Annulla, File, Chiudi, «Altro» | La barra più affollata dell'app (~9 comandi) |
| S2 | Web/Windows | Lavagna, barra strumenti — `app/js/views/board.js:1118` | Cancella la lavagna, Nascondi barra (Schermo intero facoltativo) | Annulla, Salva ed esporta, Chiudi | Cinque icone sciolte; il menu «Altro» oggi compare solo in rete |
| S3 | Web/Windows | Libreria, scheda modulo — `app/js/views/library.js:59` | Esporta .sdmod, Elimina | Apri | Tre pulsanti ripetuti su ogni scheda della griglia |
| S4 | Web/Windows | Gruppo, riga studente — `app/js/views/groups.js:259` | Modifica studente, Rimuovi studente | Dettaglio | Tre azioni per riga; rimuovere non è più a un clic |
| S5 | macOS | Esercizio, barra in alto — `macOS/Sources/MainViews.swift:306` | Esporta progressi, Apri nell'editor (docente), dimensione testo | Indice, gruppo, schermo intero | Azioni rare mescolate a quelle frequenti |
| S6 | Web/Windows | Editor libro, riga capitolo — `app/js/views/editor-books.js:105` | Modifica il modulo, Rimuovi dal libro | Su / Giù | Quattro icone per riga; il riordino resta visibile |
| S7 | macOS | Editor libro, riga capitolo — `macOS/Sources/TeacherViews.swift:562` | «Modifica» (già presente nel menu «⋯») | Su / Giù, «⋯» | Pulsante doppio: stessa azione due volte |
| S8 | macOS | Editor modulo, barra — `macOS/Sources/EditorViews.swift:164` | Esporta .sdmod, Prova | Salva, Chiudi | Quattro pulsanti di pari peso; conta solo Salva |
| S9 | Web/Windows | Gruppo, intestazione studenti — `app/js/views/groups.js:247` | Sincronizza da ClassDesk, Cambia collegamento, Scollega | Aggiungi | Comandi ClassDesk usati di rado dopo il collegamento |
| S10 | Web/Windows | Gruppo, lavagne salvate — `app/js/views/groups.js:281` | Rinomina, Elimina | Apri | Schede strette con tre pulsanti |
| S11 | Web/Windows | Editor modulo, parte — `app/js/views/editor.js:350` | Duplica, Elimina | Anteprima, Su / Giù | Azioni rare accanto a quelle di uso continuo |
| S12 | macOS | Gruppo (docente), intestazione — `macOS/Sources/TeacherViews.swift:164` | Invito per gli studenti (nel menu «Altro») | Importa progressi, «Altro» | L'invito si usa meno dell'importazione |
| S13 | macOS | Avviso di aggiornamento — `macOS/Sources/UpdateViews.swift:41` | Vedi su GitHub | Scarica e installa, × | Avviso più leggero |
| S14 | Web/Windows | Gruppo, intestazione — `app/js/views/groups.js:189` | Gruppi, Modifica | Esporta invito | Navigazione e modifica sono secondarie |

Le righe sono indicative: indicano il contenitore dove andrebbe il pulsante «⋯».
