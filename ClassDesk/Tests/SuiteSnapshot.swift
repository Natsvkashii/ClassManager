// Offscreen snapshot of the Suite settings section. Run via Tests/run_suite_snapshot.sh (temp data, fake HubDesk status files).
import SwiftUI
import AppKit

@MainActor func snap<V: View>(_ view: V, _ name: String, dark: Bool, out: URL) {
    let size = CGSize(width: 640, height: 420)
    let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -4000, y: -4000), size: size), styleMask: [.titled], backing: .buffered, defer: false)
    window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
    let host = NSHostingView(rootView: view.padding(16).frame(width: size.width, height: size.height, alignment: .top))
    window.contentView = host
    window.orderBack(nil)
    RunLoop.main.run(until: Date().addingTimeInterval(0.8))
    host.layoutSubtreeIfNeeded()
    guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
    host.cacheDisplay(in: host.bounds, to: rep)
    try? rep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("\(name).png"))
    print("snapshot \(name)")
}

@MainActor func run() {
    NSApplication.shared.setActivationPolicy(.accessory)
    let out = URL(fileURLWithPath: CommandLine.arguments[1])
    try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    // fake HubDesk status
    let hub = DeskHubPaths.base
    try? FileManager.default.createDirectory(at: hub, withIntermediateDirectories: true)
    let now = ISO8601DateFormatter().string(from: Date())
    let peers: [String: Any] = ["peers": [["deviceId": "d1", "name": "Surface di Guaira", "platform": "windows", "connected": true],
                                          ["deviceId": "d2", "name": "MacBook Aula", "platform": "macos", "connected": false]]]
    try? JSONSerialization.data(withJSONObject: peers).write(to: hub.appendingPathComponent("peers.json"))
    try? JSONSerialization.data(withJSONObject: [["key": "classdesk/course:x"]]).write(to: hub.appendingPathComponent("conflicts.json"))
    try? JSONSerialization.data(withJSONObject: ["port": 1, "token": "x", "heartbeat": now]).write(to: hub.appendingPathComponent("runtime.json"))
    let store = AppStore()
    store.suite.refreshStatus()
    for (l, name) in [("it", "suite-it"), ("en", "suite-en")] {
        store.state.settings.language = l
        snap(SuiteSettingsSection().environment(store), name, dark: false, out: out)
    }
    store.state.settings.language = "es"
    snap(SuiteSettingsSection().environment(store), "suite-es-dark", dark: true, out: out)
    exit(0)
}
DispatchQueue.main.async { MainActor.assumeIsolated { run() } }
dispatchMain()
