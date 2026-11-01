// Off-screen snapshots of the HubDesk features: Sync status panel and whiteboard toolbar at 1368x912 (Surface width).
// Build: swiftc -D SNAPSHOT_TESTS -parse-as-library … macOS/Sources/*.swift macOS/Tests/HubSnapshots.swift Hub/swift/*.swift -o /tmp/hubsnap
// Run:   STUDYDESK_HOME=<tmp> DESKHUB_HOME=<tmp> DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 /tmp/hubsnap <outDir>
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
struct HubSnapshots {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.accessory)
        let out = URL(fileURLWithPath: CommandLine.arguments[1])
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let store = AppStore()
        store.state.role = "teacher"
        store.state.profile = StudentProfile(firstName: "Guaira", lastName: "J", email: "g@x.it")
        let iso = ISO8601DateFormatter().string(from: Date())
        DeskHubPaths.writeJSON(["port": 1, "token": "x", "pid": 1, "heartbeat": iso, "version": "26.11.0-001"], to: DeskHubPaths.file("runtime.json"))
        DeskHubPaths.writeJSON(["deviceId": "dev-mac", "deviceName": "MacBook di Guaira", "autoBoard": true], to: DeskHubPaths.file("settings.json"))
        DeskHubPaths.writeJSON([["key": "studydesk/group:a"], ["key": "studydesk/group:b"]], to: DeskHubPaths.file("conflicts.json"))
        store.hubdesk.start()
        store.hubdesk.linkConnected = true
        store.hubdesk.peers = [HubPeer(["deviceId": "x", "name": "Surface di Guaira", "platform": "windows", "connected": true]),
                               HubPeer(["deviceId": "y", "name": "iMac della scuola", "platform": "macos", "connected": false])]
        let board = BoardModel.shared
        board.color = "#ef4444"; board.begin(BoardPoint(x: 0.1, y: 0.2, p: 0.5))
        for i in 0..<40 { board.add(BoardPoint(x: 0.1 + Double(i) * 0.01, y: 0.2 + sin(Double(i) / 5) * 0.08, p: 0.5)) }
        board.end()
        let wide = CGSize(width: 1368, height: 912)
        let root = { ContentView().environment(store) }
        store.currentTab = .board
        snapshot(root(), "board-1368", size: wide, out: out)
        snapshot(root(), "board-1000", size: CGSize(width: 1000, height: 700), out: out)
        board.sharingPaused = true
        snapshot(root(), "board-1368-paused", size: wide, out: out)
        board.sharingPaused = false
        store.currentTab = .sync
        snapshot(root(), "sync-hubdesk", size: wide, out: out)
        store.hubdesk.peers = []; store.hubdesk.linkConnected = false
        try? FileManager.default.removeItem(at: DeskHubPaths.file("runtime.json"))
        try? FileManager.default.removeItem(at: DeskHubPaths.file("conflicts.json"))
        snapshot(root(), "sync-hubdesk-off", size: wide, out: out)
        exit(0)
    }
}
