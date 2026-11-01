// Off-screen snapshots of the features added for the full book (parts, crossword, group contexts, focus mode,
// whiteboard, sync, image framing). Build with -D SNAPSHOT_TESTS -parse-as-library with macOS/Sources/*.swift + Hub/swift/DeskHub.swift.
// Usage: STUDYDESK_HOME=<tmp> DESKHUB_HOME=<tmp> snapshots2 <outDir> <book.sdbook>
import SwiftUI
import AppKit

@MainActor func spin(_ s: Double) { RunLoop.main.run(until: Date().addingTimeInterval(s)) }

@MainActor
func snapshot<V: View>(_ view: V, _ name: String, size: CGSize, wait: Double = 1.4, out: URL) {
    let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -5000, y: -5000), size: size), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
    let host = NSHostingView(rootView: view)
    window.contentView = host
    window.orderBack(nil)
    spin(wait)
    host.layoutSubtreeIfNeeded()
    if let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) {
        host.cacheDisplay(in: host.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("\(name).png"))
        print("✓ \(name)")
    }
    window.orderOut(nil); window.contentView = nil; window.isReleasedWhenClosed = false; window.close()
}

func check(_ c: Bool, _ m: String) { print(c ? "  ok  \(m)" : "  ✗✗ \(m)") }

@main
struct Runner {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.accessory)
        let out = URL(fileURLWithPath: CommandLine.arguments[1])
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let store = AppStore()
        store.state.role = "teacher"
        store.state.profile = StudentProfile(firstName: "Guaira", lastName: "J", email: "t@x.it")
        guard let book = store.importBook(from: URL(fileURLWithPath: CommandLine.arguments[2])) else { print("no book"); return }
        let chapters = store.chapters(of: book)
        check(chapters.count >= 13, "chapters: \(chapters.count) — \(chapters.map { $0.book?.chapter ?? "?" })")
        let size = CGSize(width: 1300, height: 900)
        let root = { ContentView().environment(store) }

        // Book open with chapter cards (review chapters labelled)
        store.openBook(book.id, context: nil)
        snapshot(root(), "01-book-open", size: size, wait: 2.2, out: out)

        // Group contexts
        var g = StudyGroup(name: "A1 sera"); g.bookIds = [book.id]; store.upsertGroup(g)
        let u1 = chapters[0]
        let (act, part) = u1.allParts.first { $0.part.type == "choice" }!
        store.activeContext = g.id
        store.saveResult(module: u1, activity: act, part: part, answer: .indexSets((part.questions ?? []).map { Array($0.answer.set) }))
        check(store.result(u1.id, part.id) != nil, "answer saved in group context")
        store.activeContext = nil
        check(store.result(u1.id, part.id) == nil, "personal context does not see the group's answer")
        store.activeContext = AppStore.blankContext
        store.saveResult(module: u1, activity: act, part: part, answer: .indexSets([[0]]))
        check(store.state.progress.keys.allSatisfy { !$0.contains(AppStore.blankContext) }, "blank context saves nothing to disk")
        store.activeContext = g.id
        snapshot(BookContextSheet(bookId: book.id).environment(store), "02-context-sheet", size: CGSize(width: 460, height: 420), out: out)

        // Exercises part with a crossword
        if let (ca, cp) = u1.allParts.first(where: { $0.part.type == "crossword" }) {
            store.openModule(u1.id, activity: ca.id)
            snapshot(root(), "03-u01-crossword", size: CGSize(width: 1300, height: 1400), out: out)
            check(Grading.grade(cp, nil).max == Double(cp.entries?.count ?? -1), "crossword max = number of entries")
        }
        // Video part
        if let va = u1.sections.first(where: { $0.chapterPart == .video })?.activities.first {
            store.openModule(u1.id, activity: va.id)
            snapshot(root(), "04-u01-video", size: size, out: out)
        }
        // Unit 3, activity 5 (image that used to overflow)
        if let u3 = chapters.first(where: { $0.id.hasSuffix("u03") }) {
            store.openModule(u3.id, activity: "l03-a5")
            snapshot(root(), "05-u03-a5", size: CGSize(width: 1100, height: 1500), out: out)
            // framing editor on its first image
            if let m = u3.sections.flatMap(\.activities).first(where: { $0.id == "l03-a5" })?.parts.compactMap({ $0.media?.first { $0.type == "image" } }).first {
                var fr = ImageFraming(); fr.crop = [0.1, 0.05, 0.8, 0.9]; fr.width = 420; fr.align = "center"
                snapshot(ImageFramingEditor(moduleId: u3.id, path: m.src ?? "", framing: .constant(fr)).environment(store), "06-image-framing", size: CGSize(width: 760, height: 620), out: out)
            }
        }
        // Focus mode
        store.openModule(u1.id, activity: u1.sections.first!.activities[1].id)
        store.focusMode = true
        snapshot(root(), "07-focus-mode", size: size, out: out)
        store.focusMode = false

        // Whiteboard with a few strokes
        let board = BoardModel.shared
        board.color = "#ef4444"; board.begin(BoardPoint(x: 0.1, y: 0.2, p: 0.5))
        for i in 0..<40 { board.add(BoardPoint(x: 0.1 + Double(i) * 0.01, y: 0.2 + sin(Double(i) / 5) * 0.08, p: 0.3 + Double(i % 10) / 15)) }
        board.end()
        board.color = "#0ea5e9"; board.begin(BoardPoint(x: 0.5, y: 0.6, p: 0.5))
        for i in 0..<30 { board.add(BoardPoint(x: 0.5 + Double(i) * 0.008, y: 0.6 - Double(i) * 0.006, p: 0.6)) }
        board.end()
        store.currentTab = .board
        snapshot(root(), "08-board", size: size, out: out)
        store.currentTab = .sync
        store.state.settings.syncCode = "classe"
        snapshot(root(), "09-sync", size: size, out: out)
        // Unit 3 activity 5 part B alone, in a narrow window: the image must stay inside the card
        if let u3 = chapters.first(where: { $0.id.hasSuffix("u03") }), let a5 = u3.sections.flatMap(\.activities).first(where: { $0.id == "l03-a5" }) {
            for p in a5.parts where p.media?.contains(where: { $0.type == "image" }) == true {
                snapshot(ScrollView { ExercisePartView(module: u3, activity: a5, part: p).padding(20) }.environment(store), "10-u03-a5-\(p.id)", size: CGSize(width: 640, height: 900), out: out)
            }
        }
        store.openBook(book.id, context: nil)
        store.currentTab = .home
        snapshot(root(), "11-book-open-settled", size: size, wait: 4.5, out: out)
        if let (ca, _) = u1.allParts.first(where: { $0.part.type == "crossword" }) {
            store.openModule(u1.id, activity: ca.id)
            snapshot(root(), "12-crossword-fixed", size: CGSize(width: 1300, height: 1000), out: out)
        }
        print("done")
    }
}
