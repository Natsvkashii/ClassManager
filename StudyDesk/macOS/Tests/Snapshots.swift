// Off-screen UI snapshots of the real app window (no screen-recording permission needed).
// Build with -D SNAPSHOT_TESTS -parse-as-library together with macOS/Sources/*.swift.
// Usage: STUDYDESK_HOME=<tmp> snapshots <outDir> <book.sdbook> <classdesk-backup.json>
// The user's real data is never touched (STUDYDESK_HOME); ClassDesk is only read.
import SwiftUI
import AppKit

@MainActor
func spin(_ seconds: Double) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }

@MainActor
func snapshot<V: View>(_ view: V, _ name: String, size: CGSize, dark: Bool = false, wait: Double = 1.2, out: URL, before: (() -> Void)? = nil) {
    let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -4000, y: -4000), size: size), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
    window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
    let host = NSHostingView(rootView: view)
    window.contentView = host
    window.orderBack(nil)
    spin(0.4)
    before?()
    spin(wait)
    host.layoutSubtreeIfNeeded()
    guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { print("✗ \(name)"); return }
    host.cacheDisplay(in: host.bounds, to: rep)
    try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("\(name).png"))
    window.orderOut(nil)
    window.contentView = nil
    window.isReleasedWhenClosed = false
    window.close()
    print("✓ \(name)")
}

func check(_ cond: Bool, _ msg: String) { print(cond ? "  ok  \(msg)" : "  ✗✗ \(msg)") }

@main
struct SnapshotRunner {
    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let args = CommandLine.arguments
        let out = URL(fileURLWithPath: args[1])
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let store = AppStore()
        let size = CGSize(width: 1280, height: 860)
        let root = { ContentView().environment(store) }

        snapshot(OnboardingView().environment(store), "01-role", size: CGSize(width: 560, height: 420), out: out)

        // Teacher setup
        store.state.role = "teacher"
        store.state.profile = StudentProfile(firstName: "Guaira", lastName: "Jaramillo", email: "teacher@example.com")
        let book = store.importBook(from: URL(fileURLWithPath: args[2]))
        check(book != nil, "book imported")
        guard let b = book else { return }
        check(store.chapters(of: b).count == 3, "3 chapters in order: \(store.chapters(of: b).map(\.id))")
        check(store.standaloneModules.isEmpty, "no standalone modules")

        store.currentTab = .home
        store.openBookId = nil
        snapshot(root(), "02-home-shelf", size: size, out: out)
        snapshot(root(), "03-book-opening", size: size, wait: 0.35, out: out) { withAnimation(.spring(response: 0.6, dampingFraction: 0.86)) { store.openBookId = b.id } }
        store.openBookId = nil
        snapshot(root(), "04-book-open", size: size, wait: 2.0, out: out) { withAnimation(.spring(response: 0.6, dampingFraction: 0.86)) { store.openBookId = b.id } }

        // A student's work → report → teacher import
        let ch = store.chapters(of: b)
        for m in ch {
            for (a, p) in m.allParts.prefix(12) {
                if p.type == "choice" { store.saveResult(module: m, activity: a, part: p, answer: .indexSets((p.questions ?? []).map { Array($0.answer.set) })) }
                if p.type == "open" { store.saveResult(module: m, activity: a, part: p, answer: .strings(["Mi chiamo Mario e sono di Roma."])) }
                if p.type == "truefalse" { store.saveResult(module: m, activity: a, part: p, answer: .bools((p.statements ?? []).map { _ in true })) }
            }
        }
        let teacherProfile = store.state.profile
        store.state.profile = StudentProfile(firstName: "Mario", lastName: "Rossi", email: "Mario.Rossi@example.com")
        let reportURL = out.appendingPathComponent("mario.sdprogress.json")
        try? store.progressReport().write(to: reportURL)
        store.state.profile = teacherProfile

        var g = StudyGroup(name: "A1 sera – martedì")
        g.bookIds = [b.id]
        store.upsertGroup(g)
        let cdData = try! Data(contentsOf: URL(fileURLWithPath: args[3]))
        let snap = ClassDeskSnapshot.parse(cdData)!
        check(snap.courses.count == 1, "archived ClassDesk course hidden")
        let c = snap.courses[0], l = c.levels[0], mo = l.modules[0]
        store.link(g.id, to: snap, course: c, level: l, module: mo)
        check(store.group(g.id)?.students.count == 2, "2 students imported from ClassDesk")
        store.syncClassDesk(g.id, snapshot: snap)
        check(store.group(g.id)?.students.count == 2, "sync does not duplicate students")
        store.importProgressReports([reportURL], into: g.id)
        let reps = store.reports(for: g.id)
        check(reps["mario.rossi@example.com"] != nil, "report matched by email (case-insensitive)")
        check(store.group(g.id)?.students.count == 2, "report did not create a duplicate student")
        if let local = ClassDeskSnapshot.loadLocal() {
            print("  info real ClassDesk on this Mac: \(local.courses.count) active courses, \(local.students.count) students (read-only)")
        }

        store.currentTab = .groups
        store.openGroupId = g.id
        snapshot(root(), "05-groups-results", size: size, out: out)
        snapshot(StudentReportSheet(groupId: g.id, email: "mario.rossi@example.com").environment(store), "06-student-report", size: CGSize(width: 760, height: 620), out: out)
        snapshot(ClassDeskPickerSheet(groupId: g.id, snapshot: snap).environment(store), "07-classdesk-picker", size: CGSize(width: 520, height: 520), out: out)
        snapshot(BookEditorView(bookId: b.id) {}.environment(store), "08-book-editor", size: CGSize(width: 1000, height: 820), out: out)

        // Student view: no teacher tools; invite + groupId in report
        store.state.role = "student"
        store.currentTab = .home
        store.openBookId = nil
        let inviteURL = out.appendingPathComponent("invito.sdgroup")
        let invite = GroupInvite(groupId: g.id, groupName: g.name, teacher: ModuleAuthor(name: "Guaira", email: "teacher@example.com"), uploadUrl: nil, bookIds: [b.id], moduleIds: [])
        try? JSONEncoder().encode(invite).write(to: inviteURL)
        store.importInvite(from: inviteURL)
        let rep2 = try? JSONSerialization.jsonObject(with: store.progressReport()) as? [String: Any]
        check(rep2?["groupId"] as? String == g.id, "student report carries groupId")
        check(store.state.settings.teacherEmail == "teacher@example.com", "invite set teacher email")
        snapshot(root(), "09-student-home", size: size, out: out)
        store.currentTab = .settings
        snapshot(root(), "10-student-settings", size: size, out: out)
        print("done")
    }
}
