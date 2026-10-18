# Gestione Corsi v2.2.0 — Cross-Platform Suite (macOS Native & Windows Edition)

> **Author & Creator:** **Guaira Jaramillo Nitoglia**  
> **Contact:** [guaira.jaramillo.nitoglia@gmail.com](mailto:guaira.jaramillo.nitoglia@gmail.com)

---

## Overview

**Gestione Corsi v2.2.0** is the official stable release of the comprehensive academic platform for course management, attendance tracking, QCER CEFR criteria, and scheduling across macOS and Windows:

- **macOS Edition:** Written in **pure native Swift 6.4 and SwiftUI for macOS 27** with native **EventKit (`Apple Calendar`)** integration, modern toolbar navigation, and automated updates.
- **Windows Edition:** Built on **Electron + HTML5/CSS/JavaScript (Tailwind CSS)** with full feature parity, including installer (`Setup .exe`) and portable single-file binary (`Portable .exe`).

All authorship watermarks, metadata, sidebar attribution badges, footer attributions, and the **Credits (`Crediti` / `Credits` / `Créditos`)** section attributing **Guaira Jaramillo Nitoglia** (`guaira.jaramillo.nitoglia@gmail.com`) are strictly preserved.

---

## Installable Packages Ready to Use (v2.2.0 Stable)

- **macOS Standard Installer Package (`.pkg`):** `Gestione-Corsi-2.2.0-Installer.pkg` (installs directly to `/Applications/Gestione Corsi.app`)
- **Windows NSIS Installer (`.exe`):** `Gestione-Corsi-2.2.0-Setup.exe` (with automatic desktop & start menu shortcuts and clean uninstaller)
- **Windows Portable Standalone (`.exe`):** `Gestione-Corsi-2.2.0-Portable.exe` (ready-to-run single executable without installation)

---

## Native Swift Architecture (`Sources/`)

- [`Sources/ContentView.swift`](file:///Users/guaira/Documents/Project%200/Sources/ContentView.swift): Main `@main struct GestioneCorsiApp: App` entry point, native `NavigationSplitView` sidebar (with custom uploaded logo and bottom author card), unified top header bar (Active Course selector + Level pills + Module pills + theme switcher), toast overlay, and bottom authorship footer.
- [`Sources/Models.swift`](file:///Users/guaira/Documents/Project%200/Sources/Models.swift): All `Codable` data structures (`AppState`, `Course`, `CourseLevel`, `CourseModule`, `Student`, `ActivityItem`, `Rubric`, `LessonPlan`, `BillingInfo`, `ModuleBilling`), the 10-color course palette (`COURSE_COLOR_PALETTE`), 21 international WhatsApp dial prefixes (`COUNTRY_DIAL_PREFIXES`), and `AuthorAttribution`.
- [`Sources/AppStore.swift`](file:///Users/guaira/Documents/Project%200/Sources/AppStore.swift): Native `@Observable @MainActor final class AppStore` managing state persistence in `~/Library/Application Support/GestioneCorsi/gestione_corsi_state_v1.json` (100% compatible with `gestione_corsi_backup_*.json`), progressive attendance evaluation, weighted grades, rubric scoring, WhatsApp international phone detection, and native `NSSavePanel`/`NSOpenPanel` JSON import/export.
- [`Sources/AppleCalendarManager.swift`](file:///Users/guaira/Documents/Project%200/Sources/AppleCalendarManager.swift): Native macOS **EventKit (`EKEventStore`)** integration that creates, updates, and removes lesson events in the macOS **Calendar** app (`Calendario`), supporting either a dedicated calendar per Course (matching the course's color) or a single `"Gestione Corsi"` calendar, with automatic duplicate prevention via `[GestioneCorsiSlot:...]` tags.
- [`Sources/CourseViews.swift`](file:///Users/guaira/Documents/Project%200/Sources/CourseViews.swift): Native SwiftUI views for Course Dashboard (`HomeView`), Attendance Register (`AttendanceView`), Final Grades (`GradesView`), Graded Activities (`ActivitiesView`), Module Calendar (`ModuleCalendarView`), Course Structure (`CourseStructureView`), and Group Roster (`RosterView`).
- [`Sources/GlobalViews.swift`](file:///Users/guaira/Documents/Project%200/Sources/GlobalViews.swift): Native SwiftUI views for General Calendar (`GlobalCalendarView`), Global Students Directory (`StudentsDirectoryView`), Archived Courses (`ArchiveView`), Billing & Invoicing (`BillingView`), Settings (`SettingsView`), and Credits (`CreditsView`).
- [`Sources/ModalsAndSheets.swift`](file:///Users/guaira/Documents/Project%200/Sources/ModalsAndSheets.swift): All native SwiftUI modal sheets (`CourseFormSheet`, `LevelFormSheet`, `ModuleFormSheet`, `LessonPlanSheet`, `RecurringLessonsSheet`, `ManageModuleStudentsSheet`, `ActivityFormSheet`, `StudentRubricEvalSheet`, `StudentDetailSheet`, `NewGlobalStudentSheet`, `RubricsManagerSheet`).
- [`Sources/Localization.swift`](file:///Users/guaira/Documents/Project%200/Sources/Localization.swift): Complete trilingual localization dictionary (`Italiano`, `English`, `Español`).

---

## Building from Source

```bash
swiftc -disable-sandbox -module-cache-path /tmp/swift-module-cache \
  Sources/*.swift \
  -framework SwiftUI -framework AppKit -framework EventKit -framework UniformTypeIdentifiers \
  -O -o "Gestione Corsi.app/Contents/MacOS/GestioneCorsi"

codesign --force --deep --sign - "Gestione Corsi.app"
```
