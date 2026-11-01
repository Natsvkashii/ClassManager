// Off-screen snapshots of every main page (teacher), to review layout and labels. Uses a COPY of a data folder.
// Build: swiftc -D SNAPSHOT_TESTS -parse-as-library -framework SwiftUI -framework AppKit macOS/Sources/*.swift macOS/Tests/UISnapshots.swift Hub/swift/*.swift -o /tmp/uisnap
// Run:   STUDYDESK_HOME=<copy> DESKHUB_HOME=<copy> DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 /tmp/uisnap <outDir>
import SwiftUI
import AppKit

@MainActor func spin(_ s: Double) { RunLoop.main.run(until: Date().addingTimeInterval(s)) }

@MainActor
func snapshot<V: View>(_ view: V, _ name: String, size: CGSize, out: URL) {
    let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -5000, y: -5000), size: size), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
    let host = NSHostingView(rootView: view)
    window.contentView = host
    window.orderBack(nil)
    spin(1.2)
    host.layoutSubtreeIfNeeded()
    if let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) {
        host.cacheDisplay(in: host.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("\(name).png"))
        print("✓ \(name)")
    }
    window.orderOut(nil); window.contentView = nil; window.isReleasedWhenClosed = false; window.close()
}

@main
struct UISnapshots {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.accessory)
        let out = URL(fileURLWithPath: CommandLine.arguments[1])
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let store = AppStore()
        store.pullFromHub()
        let size = CGSize(width: 1368, height: 860)
        let root = { ContentView().environment(store) }
        for tab in NavigationTab.allCases where tab != .module && tab != .board {
            store.currentTab = tab
            snapshot(root(), tab.rawValue, size: size, out: out)
        }
        store.currentTab = .groups
        if let g = store.state.groups.first(where: { $0.archived != true }) {
            store.openGroupId = g.id
            snapshot(root(), "group-detail", size: size, out: out)
        }
        // Open book: chapters in a vertical grid
        if let b = store.books.first {
            store.currentTab = .home; store.openBookId = b.id
            snapshot(root(), "book-open", size: size, out: out)
            store.openBookId = nil
            if let m = store.chapters(of: b).first {
                store.openModule(m.id)
                UserDefaults.standard.set(false, forKey: "studydesk.outlineHidden")
                snapshot(root(), "player", size: size, out: out)
                UserDefaults.standard.set(true, forKey: "studydesk.outlineHidden")
                snapshot(root(), "player-outline-hidden", size: size, out: out)
                // Full screen: no navigation bar, whole width (rendered without the window so the test window is not made full screen)
                store.focusMode = true
                snapshot(ModulePlayerView(module: m).environment(store), "player-fullscreen-1920", size: CGSize(width: 1920, height: 1080), out: out)
                UserDefaults.standard.set(false, forKey: "studydesk.outlineHidden")
                snapshot(ModulePlayerView(module: m).environment(store), "player-fullscreen-outline-1920", size: CGSize(width: 1920, height: 1080), out: out)
                store.focusMode = false
            }
        }
        exit(0)
    }
}
