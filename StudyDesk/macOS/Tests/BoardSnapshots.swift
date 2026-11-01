// Lavagna 26.11 on macOS: tools, cells, text boxes, grid, laser, board colour, saved boards, export. Off-screen; uses a THROW-AWAY data folder.
// Build: swiftc -D SNAPSHOT_TESTS -parse-as-library -framework SwiftUI -framework AppKit -framework AVKit -framework AVFoundation -framework UniformTypeIdentifiers \
//          StudyDesk/macOS/Sources/*.swift StudyDesk/macOS/Tests/BoardSnapshots.swift Hub/swift/*.swift -o /tmp/boardsnap
// Run:   STUDYDESK_HOME=<empty tmp dir> DESKHUB_HOME=<empty tmp dir> DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 /tmp/boardsnap <outDir>
import SwiftUI
import AppKit

@MainActor func spin(_ s: Double) { RunLoop.main.run(until: Date().addingTimeInterval(s)) }
nonisolated(unsafe) var failures = 0
func ok(_ c: Bool, _ msg: String) { print(c ? "✓ \(msg)" : "✗ \(msg)"); if !c { failures += 1 } }

@MainActor
func snapshot<V: View>(_ view: V, _ name: String, size: CGSize, out: URL, before: (() -> Void)? = nil) {
    let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -5000, y: -5000), size: size), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
    let host = NSHostingView(rootView: view)
    window.contentView = host
    window.orderBack(nil)
    spin(1.0)
    before?()
    spin(0.4)
    host.layoutSubtreeIfNeeded()
    if let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) {
        host.cacheDisplay(in: host.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("\(name).png"))
        print("  snapshot \(name).png")
    }
    window.orderOut(nil); window.contentView = nil; window.isReleasedWhenClosed = false; window.close()
}

@main
struct BoardSnapshots {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.accessory)
        guard ProcessInfo.processInfo.environment["STUDYDESK_HOME"] != nil else { print("✗ STUDYDESK_HOME must point to a throw-away folder"); exit(2) }
        let out = URL(fileURLWithPath: CommandLine.arguments[1])
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        UserDefaults.standard.set(true, forKey: "studydesk.boardDate")
        let store = AppStore()
        store.state.role = "teacher"
        var g = StudyGroup(); g.name = "A1 sera – prova lavagna"; store.upsertGroup(g)

        let m = BoardModel.shared
        m.clear(); m.background = "#ffffff"; m.color = "#111827"; m.width = 0.004; m.textStyle = BoardTextStyle()
        let boardW = 1344.0
        m.setGrid(cm: 2, boardWidth: boardW, pointsPerCm: 96 / 2.54)
        ok(abs((m.grid?.g ?? 0) - 2 * 96 / 2.54 / boardW) < 1e-4, "grid of 2 cm on a \(Int(boardW)) pt board (g=\(m.grid?.g ?? 0))")

        // table 2x2 drawn with polar tracking (slightly crooked movements)
        func line(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) {
            let a = BoardKit.snapPoint(m.strokes, grid: m.grid, BoardPoint(x: x1, y: y1, p: 0.5))
            m.addLine(a, BoardKit.polarEnd(grid: m.grid, a, BoardPoint(x: x2, y: y2, p: 0.5)))
        }
        line(0.11, 0.21, 0.5, 0.215); line(0.11, 0.40, 0.5, 0.39); line(0.11, 0.6, 0.5, 0.61)
        line(0.11, 0.21, 0.115, 0.6); line(0.33, 0.21, 0.325, 0.6); line(0.5, 0.21, 0.505, 0.6)
        ok(m.strokes.allSatisfy { $0.line == true && ($0.points[0].x == $0.points[1].x || $0.points[0].y == $0.points[1].y) }, "6 straight horizontal/vertical lines")
        let r = CGRect(x: 0, y: 0, width: boardW, height: boardW / BoardKit.aspect)
        let c1 = BoardKit.findCell(m.strokes, grid: m.grid, BoardPoint(x: 0.2, y: 0.3, p: 0.5))
        ok(c1?.table == true, "a click inside the table gives the table cell, not the grid square (\(String(describing: c1)))")
        let cells: [(Double, Double, String)] = [(0.2, 0.3, "Verbo"), (0.42, 0.3, "Significato"), (0.2, 0.5, "essere"), (0.42, 0.5, "to be, être, ser")]
        for (i, (x, y, s)) in cells.enumerated() {
            var t = m.newText(at: BoardPoint(x: x, y: y, p: 0.5), boardRect: r)
            if i < 2 { t.bold = true }
            t.text = s; m.beginEditing(t); m.commitEditing()
        }
        var gt = m.newText(at: BoardPoint(x: 0.72, y: 0.33, p: 0.5), boardRect: r)
        ok(gt.cw != nil && gt.cell, "outside the table: a grid square that widens with the text")
        gt.text = "Testo in un quadretto della griglia"; m.beginEditing(gt); m.commitEditing()
        var free = m.newText(at: BoardPoint(x: 0.6, y: 0.8, p: 0.5), boardRect: r)
        m.setGrid(cm: nil, boardWidth: boardW, pointsPerCm: 96 / 2.54)
        free = m.newText(at: BoardPoint(x: 0.6, y: 0.8, p: 0.5), boardRect: r)
        ok(!free.cell, "without grid and outside tables: a free text box")
        free.text = "Testo libero sottolineato, allineato a destra"; free.underline = true; free.align = "right"; m.beginEditing(free); m.commitEditing()
        m.setGrid(cm: 2, boardWidth: boardW, pointsPerCm: 96 / 2.54)
        ok(m.texts.count == 6, "6 text boxes (\(m.texts.count))")
        // empty box is dropped
        var empty = m.newText(at: BoardPoint(x: 0.9, y: 0.9, p: 0.5), boardRect: r); empty.text = "   "; m.beginEditing(empty); m.commitEditing()
        ok(m.texts.count == 6, "an empty text box is not kept")

        // freehand + eraser
        m.mode = .pen; m.color = "#dc2626"; m.width = 0.006
        m.begin(BoardPoint(x: 0.6, y: 0.55, p: 0.5)); for i in 1...30 { m.add(BoardPoint(x: 0.6 + Double(i) * 0.008, y: 0.55 + sin(Double(i) / 3) * 0.05, p: 0.7)) }; m.end()
        m.mode = .eraser
        m.begin(BoardPoint(x: 0.7, y: 0.5, p: 0.5)); m.add(BoardPoint(x: 0.72, y: 0.62, p: 0.5)); m.end()
        m.mode = .pen

        // undo order: last added (text or stroke) goes first
        let before = (m.strokes.count, m.texts.count)
        var last = m.newText(at: BoardPoint(x: 0.05, y: 0.9, p: 0.5), boardRect: r); last.text = "da annullare"; m.beginEditing(last); m.commitEditing()
        m.undo()
        ok(m.strokes.count == before.0 && m.texts.count == before.1, "undo removes the newest item (the text box)")

        // laser trail
        m.mode = .laser
        for i in 0..<20 { m.laserPoint("me/laser1", x: 0.15 + Double(i) * 0.015, y: 0.75 - Double(i) * 0.004) }
        ok(m.laser["me/laser1"]?.count == 20, "laser trail recorded")
        m.mode = .pen
        m.color = "#111827"

        snapshot(BoardView().environment(store), "board-light-1368", size: CGSize(width: 1368, height: 900), out: out)
        m.mode = .text
        snapshot(BoardView().environment(store), "board-text-tool-1368", size: CGSize(width: 1368, height: 900), out: out) {
            var t = m.newText(at: BoardPoint(x: 0.08, y: 0.08, p: 0.5), boardRect: m.canvas?.boardRect ?? r)
            t.text = "Titolo della lezione\nseconda riga"; t.cell = false; t.cw = nil; t.h = 0; t.x = 0.55; t.y = 0.05; t.w = 0.35
            m.beginEditing(t)
            spin(0.3)
            ok(m.canvas?.subviews.contains { $0 is NSTextView } == true, "the text box opens an editor on the board")
        }
        let canvas = m.canvas
        m.commitEditing()
        ok(canvas?.subviews.contains { $0 is NSTextView } != true && m.texts.contains { $0.text.hasPrefix("Titolo") }, "committing closes the editor and keeps the text")
        m.mode = .pen

        // dark board: recommended inks switch family
        m.setBackground("#2f3437")
        ok(m.strokes.first?.color == "#f8fafc" && m.texts.first?.color == "#f8fafc" && m.color == "#f8fafc", "dark board: black ink and text become white, the pen too")
        ok(m.strokes.contains { $0.color == "#f87171" }, "red becomes coral")
        snapshot(BoardView().environment(store), "board-dark-1368", size: CGSize(width: 1368, height: 900), out: out)

        // controls
        snapshot(BoardColorPicker(value: "#1d4ed8", sections: [("Consigliati per lavagna chiara", BoardKit.lightInks), ("Per lavagna scura", BoardKit.darkInks)], recent: ["#123456"]) { _, _ in }
            .background(Color(nsColor: .windowBackgroundColor)), "color-picker", size: CGSize(width: 290, height: 420), out: out)
        snapshot(VStack(spacing: 16) {
            ConeSlider(value: .constant(0.1), ink: "#111827", paper: "#ffffff", dot: { BoardKit.widthFromSlider($0) * 1344 })
            ConeSlider(value: .constant(0.6), ink: "#dc2626", paper: "#ffffff", dot: { BoardKit.widthFromSlider($0) * 1344 })
            ConeSlider(value: .constant(1), ink: "#f8fafc", paper: "#2f3437", dot: { BoardKit.widthFromSlider($0) * 1344 })
        }.padding().background(Color(nsColor: .windowBackgroundColor)), "cone-slider", size: CGSize(width: 240, height: 160), out: out)

        // saved in a group
        let rec = BoardLibrary.save(id: nil, groupId: g.id, name: "Lezione 4", board: m.savedData, thumb: m.thumbnail())
        ok(BoardLibrary.list(groupId: g.id).count == 1 && rec.thumbImage != nil, "saved in the group with a thumbnail")
        ok(rec.board.date == BoardKit.localDay(), "a saved board keeps today's date (\(rec.board.date ?? "nil"))")
        let snapStrokes = m.strokes.count, snapTexts = m.texts.count
        m.clear()
        ok(m.isEmpty, "clear removes strokes and texts")
        m.load(BoardLibrary.get(rec.id)!)
        ok(m.strokes.count == snapStrokes && m.texts.count == snapTexts && m.background == "#2f3437" && m.grid != nil && m.saved?.id == rec.id, "reopened as it was saved")
        // the web app can read it: same JSON keys
        if let d = try? Data(contentsOf: BoardLibrary.dir.appendingPathComponent(rec.id + ".json")), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let b = j["board"] as? [String: Any] {
            ok(Set(["id", "groupId", "name", "createdAt", "updatedAt", "board", "thumb"]).isSubset(of: Set(j.keys)) && Set(["strokes", "texts", "background", "grid", "date"]).isSubset(of: Set(b.keys)), "record format = web app")
            ok(((b["strokes"] as? [[String: Any]])?.first?["line"] as? Bool) == true, "straight lines keep line:true")
        } else { ok(false, "saved record readable") }
        store.openGroupId = g.id; store.currentTab = .groups
        snapshot(GroupBoardsTab(groupId: g.id).environment(store).padding(20).frame(width: 900, height: 420).background(Color(nsColor: .windowBackgroundColor)), "group-boards-tab", size: CGSize(width: 900, height: 420), out: out)

        // export
        if let rep = BoardRenderer.bitmap(m.content, width: 2560, height: 1440, date: m.dateText) {
            ok(rep.pixelsWide == 2560 && rep.pixelsHigh == 1440, "export bitmap 2560×1440")
            try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("export.png"))
            let pdf = BoardRenderer.pdf(from: rep)
            ok(pdf.map { String(decoding: $0.prefix(5), as: UTF8.self) == "%PDF-" } == true, "PDF export")
            try? pdf?.write(to: out.appendingPathComponent("export.pdf"))
            ok(rep.representation(using: .jpeg, properties: [.compressionFactor: 0.92]) != nil, "JPEG export")
        } else { ok(false, "export bitmap") }

        // protocol: a text box and the grid from the web app
        m.receiveShared(["t": "text", "item": ["id": "web:1", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0, "text": "dal Surface", "size": 0.02, "color": "#f8fafc", "bold": false, "italic": true, "underline": false, "align": "left", "cell": false, "v": 1]], from: "web", name: "Surface")
        ok(m.texts.contains { $0.id == "web:1" && $0.italic }, "text box from another device")
        m.receiveShared(["t": "textdel", "id": "web:1"], from: "web", name: "Surface")
        ok(!m.texts.contains { $0.id == "web:1" }, "text box deleted by another device")
        m.receiveShared(["t": "grid", "grid": NSNull()], from: "web", name: "Surface")
        ok(m.grid == nil, "grid turned off by another device")

        BoardLibrary.deleteGroup(g.id)
        ok(BoardLibrary.list(groupId: g.id).isEmpty, "deleting the group deletes its boards")
        print(failures == 0 ? "ALL BOARD CHECKS PASSED" : "\(failures) FAILED")
        exit(failures == 0 ? 0 : 1)
    }
}
