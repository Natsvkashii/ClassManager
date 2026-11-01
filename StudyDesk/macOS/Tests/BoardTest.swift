// Watches a shared board on the LAN and prints what arrives. Build with -D SNAPSHOT_TESTS -parse-as-library + Sources + Hub.
// usage: boardtest <boardName> <seconds>
import SwiftUI
import AppKit
@main
struct BoardTest {
    @MainActor static func main() {
        _ = NSApplication.shared
        let name = CommandLine.arguments[1], secs = Double(CommandLine.arguments[2]) ?? 10
        let m = BoardModel.shared
        m.browse()
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline, !m.remotes.contains(where: { if case .service(let n, _, _, _) = $0.endpoint { return n == name }; return false }) { RunLoop.main.run(until: Date().addingTimeInterval(0.2)) }
        guard let r = m.remotes.first(where: { if case .service(let n, _, _, _) = $0.endpoint { return n == name }; return false }) else { print("✗ board not found"); return }
        m.watch(r)
        RunLoop.main.run(until: Date().addingTimeInterval(secs))
        print("status:", m.status)
        print("strokes:", m.strokes.count, "points:", m.strokes.map(\.points.count), "colors:", Set(m.strokes.map(\.color)).sorted())
    }
}
