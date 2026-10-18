# Class Management v26.10.1-1 — Cross-Platform Suite (macOS Native & Windows Edition)

> **Author & Creator:** **Guaira Jaramillo Nitoglia**  
> **Contact:** [guaira.jaramillo.nitoglia@gmail.com](mailto:guaira.jaramillo.nitoglia@gmail.com)  
> **License:** [GNU General Public License v3.0 (GPL-3.0)](file:///Users/guaira/Documents/GitHub/ClassManager/LICENSE)

---

## Overview

**Class Management v26.10.1-1** is the official stable release of the comprehensive academic platform for course management, attendance tracking, QCER/CEFR rubrics, and scheduling across macOS and Windows:

- **macOS Edition:** Written in **pure native Swift 6.4 and SwiftUI for macOS 27** with native **EventKit (`Apple Calendar`)** integration, modern toolbar navigation, and automated updates with pre-update backups.
- **Windows Edition:** Built on **Electron + HTML5/CSS/JavaScript (Tailwind CSS)** with full feature parity, including installer (`Setup .exe`) and portable single-file binary (`Portable .exe`).

All authorship watermarks, metadata, sidebar attribution badges, footer attributions, and the **Informazioni (`About`)** section attributing **Guaira Jaramillo Nitoglia** (`guaira.jaramillo.nitoglia@gmail.com`) are strictly preserved.

---

## Versioning System

Class Management adopts a calendar-based release numbering scheme:
- Format: `YY.MM.R` with sub-release/hotfix `-X` (e.g. `26.10.1-1`)
- **Current Stable:** `26.10.1-1` (October 2026, Release 1, Revision 1)
- **Next Beta:** `26.10.2b` (Release 2 Beta)
- Release counter `R` scales beyond 9 as needed (`26.10.10`, etc.).

---

## Ready-to-Use Packages (v26.10.1-1 Stable)

- **macOS Standard Installer Package (`.pkg`):** `Class-Management-26.10.1-1-Installer.pkg` (installs directly to `/Applications/Class Management.app`)
- **Windows NSIS Installer (`.exe`):** `Class-Management-26.10.1-1-Setup.exe` (with automatic desktop & start menu shortcuts and clean uninstaller)
- **Windows Portable Standalone (`.exe`):** `Class-Management-26.10.1-1-Portable.exe` (ready-to-run single executable without installation)

---

## Native Swift Architecture (`Sources/`)

- [`Sources/ContentView.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/ContentView.swift): Main `@main struct ClassManagementApp: App` entry point, native `NavigationSplitView` sidebar, unified top header bar (Active Course selector + Level pills + Module pills + theme switcher), toast overlay, and bottom authorship footer.
- [`Sources/Models.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/Models.swift): All `Codable` data structures (`AppState`, `Course`, `CourseLevel`, `CourseModule`, `Student`, `ActivityItem`, `Rubric`, `LessonPlan`, `BillingInfo`, `ModuleBilling`), the 10-color course palette (`COURSE_COLOR_PALETTE`), 21 international WhatsApp dial prefixes (`COUNTRY_DIAL_PREFIXES`), and `AuthorAttribution`.
- [`Sources/AppStore.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/AppStore.swift): Native `@Observable @MainActor final class AppStore` managing state persistence in `~/Library/Application Support/ClassManagement/class_management_state_v1.json` with seamless migration from legacy files, progressive attendance evaluation, weighted grades, rubric scoring, WhatsApp international phone detection, and native `NSSavePanel`/`NSOpenPanel` JSON import/export.
- [`Sources/AppleCalendarManager.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/AppleCalendarManager.swift): Native macOS **EventKit (`EKEventStore`)** integration that creates, updates, and removes lesson events in the macOS **Calendar** app (`Calendario`), supporting either a dedicated calendar per Course (matching the course's color) or a single `"Class Management"` calendar, with automatic duplicate prevention.
- [`Sources/CourseViews.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/CourseViews.swift): Native SwiftUI views for Course Dashboard (`HomeView`), Attendance Register (`AttendanceView`), Final Grades (`GradesView`), Graded Activities (`ActivitiesView`), Module Calendar (`ModuleCalendarView`), Course Structure (`CourseStructureView`), and Group Roster (`RosterView`).
- [`Sources/GlobalViews.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/GlobalViews.swift): Native SwiftUI views for General Calendar (`GlobalCalendarView`), Global Students Directory (`StudentsDirectoryView`), Archived Courses (`ArchiveView`), Billing & Invoicing (`BillingView`), Settings (`SettingsView`), and Credits (`CreditsView` with GNU GPL-3.0 license card).
- [`Sources/ModalsAndSheets.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/ModalsAndSheets.swift): All native SwiftUI modal sheets (`CourseFormSheet`, `LevelFormSheet`, `ModuleFormSheet`, `LessonPlanSheet`, `RecurringLessonsSheet`, `ManageModuleStudentsSheet`, `ActivityFormSheet`, `StudentRubricEvalSheet`, `StudentDetailSheet`, `NewGlobalStudentSheet`, `RubricsManagerSheet`).
- [`Sources/Localization.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/Localization.swift): Complete trilingual localization dictionary (`Italiano`, `English`, `Español`).
- [`Sources/UpdateManager.swift`](file:///Users/guaira/Documents/GitHub/ClassManager/Sources/UpdateManager.swift): Native macOS auto-updater using GitHub Releases API with support for the `YY.MM.R` scheme and automated pre-update backups.

---

## Building from Source

### macOS

```bash
python3 manage_version.py build
```

Or manually:

```bash
swiftc -disable-sandbox -module-cache-path /tmp/swift-module-cache \
  Sources/*.swift \
  -framework SwiftUI -framework AppKit -framework EventKit -framework UniformTypeIdentifiers \
  -O -o "Class Management.app/Contents/MacOS/ClassManagement"

codesign --force --deep --sign - "Class Management.app"
```

### Windows

```bash
cd Windows-Version
npm install
npm run build:win
```

---

## License

This software is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [`LICENSE`](file:///Users/guaira/Documents/GitHub/ClassManager/LICENSE) file for details.
