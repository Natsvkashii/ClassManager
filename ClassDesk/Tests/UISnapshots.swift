// Offscreen snapshots of every ClassDesk page on a COPY of a data folder, to review layout and labels.
// Run via Tests/run_ui_snapshots.sh <state.json> <outDir>.
import SwiftUI
import AppKit

@MainActor func shot<V: View>(_ view: V, _ name: String, out: URL, size: CGSize = CGSize(width: 1368, height: 860)) {
    let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -5000, y: -5000), size: size), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
    let host = NSHostingView(rootView: view)
    window.contentView = host
    window.orderBack(nil)
    RunLoop.main.run(until: Date().addingTimeInterval(1.2))
    host.layoutSubtreeIfNeeded()
    guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
    host.cacheDisplay(in: host.bounds, to: rep)
    try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("\(name).png"))
    print("✓ \(name)")
    window.orderOut(nil); window.contentView = nil; window.isReleasedWhenClosed = false; window.close()
}

@MainActor func run() {
    NSApplication.shared.setActivationPolicy(.accessory)
    let out = URL(fileURLWithPath: CommandLine.arguments[1])
    try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    let store = AppStore()
    store.state.settings.checkForUpdatesAutomatically = false
    for tab in NavigationTab.allCases {
        store.currentTab = tab
        shot(ContentView().environment(store), tab.rawValue, out: out)
    }
    exit(0)
}
DispatchQueue.main.async { MainActor.assumeIsolated { run() } }
dispatchMain()
