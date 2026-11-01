// HubDesk integration tests: records mirror between two StudyDesk stores (record files copied like HubDesk would) and the shared
// whiteboard against a fake local HubDesk (TCP server + runtime.json).
// Build: swiftc -D SNAPSHOT_TESTS -parse-as-library -framework SwiftUI -framework AppKit macOS/Sources/*.swift macOS/Tests/HubSuiteTest.swift Hub/swift/*.swift -o /tmp/hubsuite
// Run:   DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 /tmp/hubsuite
import SwiftUI
import AppKit
import Network

var failed = 0
func ok(_ c: Bool, _ m: String) { if c { print("  ok  \(m)") } else { failed += 1; print("  ✗✗ \(m)") } }
@MainActor func spin(_ s: Double) { RunLoop.main.run(until: Date().addingTimeInterval(s)) }
@MainActor func waitFor(_ s: Double = 5, _ cond: () -> Bool) -> Bool {
    let end = Date().addingTimeInterval(s)
    while !cond() && Date() < end { spin(0.05) }
    return cond()
}
func tmpDir(_ n: String) -> String {
    let d = NSTemporaryDirectory() + "hubsuite-\(n)-\(UUID().uuidString)"
    try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true)
    return d
}

/// A device = its own StudyDesk data folder + its own DeskHub folder. Operations switch DESKHUB_HOME like a separate process would.
@MainActor final class Device {
    let hub: String, store: AppStore
    init(_ name: String) {
        hub = tmpDir(name + "-hub")
        setenv("STUDYDESK_HOME", tmpDir(name + "-sd"), 1)
        setenv("DESKHUB_HOME", hub, 1)
        store = AppStore()
        store.state.role = "teacher"
        store.state.profile = StudentProfile(firstName: name, lastName: "T", email: "t@x.it")
        DeskHubPaths.writeJSON(["deviceId": "dev-\(name)", "deviceName": "Mac \(name)"], to: DeskHubPaths.file("settings.json"))
    }
    func on<T>(_ f: () -> T) -> T { setenv("DESKHUB_HOME", hub, 1); return f() }
    var records: URL { URL(fileURLWithPath: hub).appendingPathComponent("records/studydesk") }
}
/// HubDesk copying record files from one device to the other.
@MainActor func hubdesk(_ a: Device, _ b: Device) {
    let fm = FileManager.default
    try? fm.createDirectory(at: b.records, withIntermediateDirectories: true)
    for f in (try? fm.contentsOfDirectory(at: a.records, includingPropertiesForKeys: nil)) ?? [] {
        let dest = b.records.appendingPathComponent(f.lastPathComponent)
        try? fm.removeItem(at: dest)
        try? fm.copyItem(at: f, to: dest)
    }
}

@main
struct HubSuiteTest {
    @MainActor static func main() async {
        _ = NSApplication.shared
        print("== records mirror: two stores")
        let A = Device("A"), B = Device("B")
        var g = StudyGroup(name: "Classe A1"); g.id = "grp-1"
        g.students = [GroupStudent(firstName: "Mario", lastName: "Rossi", email: "m@x.it")]
        A.store.state.groups = [g]
        let r = PartResult(activityId: "a1", partId: "p1", type: "choice", answer: nil, score: 2, maxScore: 3, status: "correct", attempts: 1, updatedAt: "2026-10-30T10:00:00Z")
        A.store.state.progress["mod1"] = ["p1": r]
        let outA = A.on { A.store.hubdesk.reconcile(full: true) }
        ok(outA.exported == 2, "A exports group + result (\(outA.exported))")
        let recs = A.on { DeskHubRecords(app: "studydesk").all() }
        ok(recs["group:grp-1"] != nil && recs["progress:mod1::p1"] != nil, "same keys as _sdsync: group:<id>, progress:<module>::<part>")
        ok((recs["group:grp-1"]?["device"] as? String) == "dev-A" && (recs["group:grp-1"]?["deleted"] as? Bool) == false, "record carries device and deleted=false")
        ok(A.on { A.store.hubdesk.reconcile(full: false) }.exported == 0, "no second write when nothing changed")

        hubdesk(A, B)
        let outB = B.on { B.store.hubdesk.reconcile(full: true) }
        ok(outB.imported == 2, "B imports 2 records (\(outB.imported))")
        ok(B.store.state.groups.first?.name == "Classe A1" && B.store.state.groups.first?.students.count == 1, "B has A's group")
        ok(B.store.state.progress["mod1"]?["p1"]?.score == 2, "B has A's result")
        ok(B.on { B.store.hubdesk.reconcile(full: true) }.exported == 0, "no echo from B")

        // B edits the group: goes back to A
        B.store.state.groups[0].name = "Classe A1 bis"
        B.on { _ = B.store.hubdesk.reconcile(full: false) }
        hubdesk(B, A)
        A.on { _ = A.store.hubdesk.reconcile(full: true) }
        ok(A.store.state.groups.first?.name == "Classe A1 bis", "A applies B's edit")
        ok(A.on { DeskHubRecords(app: "studydesk").get("group:grp-1") }?["device"] as? String == "dev-B", "A keeps B's record (no overwrite)")

        // A deletes the group: tombstone travels
        A.store.deleteGroup("grp-1")
        A.on { _ = A.store.hubdesk.reconcile(full: false) }
        let tomb = A.on { DeskHubRecords(app: "studydesk").get("group:grp-1") }
        ok((tomb?["deleted"] as? Bool) == true && tomb?["value"] is NSNull, "A writes a tombstone")
        hubdesk(A, B)
        B.on { _ = B.store.hubdesk.reconcile(full: true) }
        ok(B.store.state.groups.isEmpty, "B deletes the group")
        ok(B.on { B.store.hubdesk.reconcile(full: true) }.exported == 0, "no resurrection")

        // First-run rule (both have it, differ): hub wins only when another device wrote it and it is newer
        let me = "dev-A"
        let L: [String: Any] = ["id": "g", "name": "locale", "updatedAt": "2026-10-10T00:00:00Z"]
        func rec(_ dev: String, _ at: String) -> [String: Any] { ["key": "group:g", "device": dev, "updatedAt": at, "deleted": false, "value": ["id": "g", "name": "hub"]] }
        ok(RecordsMirror.decide(local: L, hasTomb: false, hub: rec("dev-B", "2026-10-20T00:00:00Z"), known: nil, me: me).act == .applyLocal, "rule: other device + newer -> hub wins")
        ok(RecordsMirror.decide(local: L, hasTomb: false, hub: rec("dev-B", "2026-10-05T00:00:00Z"), known: nil, me: me).act == .put, "rule: older -> export local")
        ok(RecordsMirror.decide(local: L, hasTomb: false, hub: rec(me, "2026-10-20T00:00:00Z"), known: nil, me: me).act == .put, "rule: same device -> export local")

        print("== shared whiteboard with a fake HubDesk")
        let C = Device("C")
        let client = C.store.hubdesk
        var received: [[String: Any]] = []
        var serverConn: NWConnection?
        var buf = Data()
        let listener = try! NWListener(using: .tcp)
        listener.newConnectionHandler = { c in
            serverConn = c
            c.start(queue: .main)
            func rx() {
                c.receive(minimumIncompleteLength: 1, maximumLength: 1 << 16) { d, _, done, err in
                    if let d { buf.append(d) }
                    while let nl = buf.firstIndex(of: 0x0A) {
                        let line = buf[buf.startIndex..<nl]; buf = Data(buf[buf.index(after: nl)...])
                        if let m = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any] {
                            received.append(m)
                            if m["t"] as? String == "hello" {
                                let hello: [String: Any] = ["t": "hello", "ok": true, "self": ["deviceId": "dev-C"], "peers": [["deviceId": "dev-X", "name": "Surface di Guaira", "platform": "windows", "connected": true]]]
                                var o = try! JSONSerialization.data(withJSONObject: hello); o.append(0x0A)
                                c.send(content: o, completion: .contentProcessed { _ in })
                            }
                        }
                    }
                    if !(done || err != nil) { rx() }
                }
            }
            rx()
        }
        listener.start(queue: .main)
        ok(waitFor { (listener.port?.rawValue ?? 0) != 0 }, "fake HubDesk listening")
        func serverSend(_ m: [String: Any]) { var o = try! JSONSerialization.data(withJSONObject: m); o.append(0x0A); serverConn?.send(content: o, completion: .contentProcessed { _ in }) }
        setenv("DESKHUB_HOME", C.hub, 1)
        DeskHubPaths.writeJSON(["port": Int(listener.port!.rawValue), "token": "tok", "pid": 1, "heartbeat": ISO8601DateFormatter().string(from: Date()), "version": "26.11.0-001"], to: DeskHubPaths.file("runtime.json"))
        DeskHubPaths.writeJSON(["deviceId": "dev-C", "deviceName": "Mac C", "autoBoard": true], to: DeskHubPaths.file("settings.json"))
        client.start()
        ok(waitFor(8) { client.linkConnected && client.connectedPeers.count == 1 }, "link connected, peer 'Surface di Guaira' seen")
        ok(received.first?["t"] as? String == "hello" && received.first?["app"] as? String == "studydesk", "hello sent as studydesk")

        let board = BoardModel.shared
        board.strokes = []
        ok(board.hubShared && board.sharedWithNames == ["Surface di Guaira"], "board is shared with the peer")
        board.begin(BoardPoint(x: 0.1, y: 0.1, p: 0.5)); board.add(BoardPoint(x: 0.2, y: 0.2, p: 0.5)); board.end()
        ok(waitFor { received.filter { $0["t"] as? String == "board" }.count >= 4 }, "begin/pt/pt/end sent as {t:board,msg:…}")
        let msgs = received.compactMap { $0["t"] as? String == "board" ? $0["msg"] as? [String: Any] : nil }
        let beginId = msgs.first { $0["t"] as? String == "begin" }?["id"] as? String ?? ""
        ok(beginId.hasPrefix("dev-C:") && BoardRelay.owner(of: beginId) == "dev-C", "stroke id is <deviceId>:<n> (\(beginId))")
        board.begin(BoardPoint(x: 0.3, y: 0.3, p: 0.5)); board.end()
        ok(Set(board.strokes.map(\.id)).count == 2, "stroke ids unique")

        // incoming strokes from the other device, board view not needed
        serverSend(["t": "board", "from": "dev-X", "fromName": "Surface di Guaira", "msg": ["t": "begin", "id": "dev-X:5", "color": "#ef4444", "w": 0.004, "eraser": false]])
        serverSend(["t": "board", "from": "dev-X", "fromName": "Surface di Guaira", "msg": ["t": "pt", "id": "dev-X:5", "x": 0.5, "y": 0.5, "p": 0.5]])
        ok(waitFor { board.strokes.contains { $0.id == "dev-X:5" && $0.points.count == 1 } }, "incoming stroke drawn on the same board")
        ok(board.strokes.count == 3, "collaborative: all strokes on one board (\(board.strokes.count))")
        serverSend(["t": "board", "from": "dev-X", "fromName": "S", "msg": ["t": "undo"]])
        ok(waitFor { !board.strokes.contains { $0.id == "dev-X:5" } } && board.strokes.count == 2, "undo from X removes only X's last stroke")
        board.undo()
        ok(board.strokes.count == 1 && BoardRelay.owner(of: board.strokes[0].id) == "dev-C", "local undo removes my last stroke")
        // snapshot merge by id
        serverSend(["t": "board", "from": "dev-X", "fromName": "S", "msg": ["t": "snapshot", "background": "#ffffff", "strokes": [["id": "dev-X:9", "color": "#000000", "w": 0.004, "eraser": false, "points": [["x": 0.1, "y": 0.1, "p": 0.5]]]]]])
        serverSend(["t": "board", "from": "dev-X", "fromName": "S", "msg": ["t": "snapshot", "background": "#ffffff", "strokes": [["id": "dev-X:9", "color": "#000000", "w": 0.004, "eraser": false, "points": [["x": 0.1, "y": 0.1, "p": 0.5]]]]]])
        ok(waitFor { board.strokes.contains { $0.id == "dev-X:9" } } && board.strokes.filter { $0.id == "dev-X:9" }.count == 1, "snapshot merged by id (idempotent)")
        // peer-joined -> snapshot sent
        received.removeAll()
        serverSend(["t": "peer-joined", "device": "dev-Y", "name": "iPad"])
        ok(waitFor { received.contains { ($0["msg"] as? [String: Any])?["t"] as? String == "snapshot" } }, "snapshot sent on peer-joined")
        // pause
        received.removeAll()
        board.sharingPaused = true
        board.begin(BoardPoint(x: 0.9, y: 0.9, p: 0.5)); board.end()
        spin(0.4)
        ok(received.filter { $0["t"] as? String == "board" }.isEmpty, "paused: nothing is sent")
        board.sharingPaused = false
        // autoBoard off
        DeskHubPaths.writeJSON(["deviceId": "dev-C", "deviceName": "Mac C", "autoBoard": false], to: DeskHubPaths.file("settings.json"))
        client.refreshStatus()
        ok(!board.hubShared, "autoBoard=false: not shared")
        // updater asset selection
        func asset(_ n: String) -> GitHubAsset { GitHubAsset(id: nil, name: n, size: 1, browser_download_url: "https://x/\(n)") }
        let rel = GitHubRelease(id: 1, tag_name: "v26.11.0-001", name: nil, body: nil, prerelease: true, published_at: nil, html_url: "x",
                                assets: ["ClassDesk-26.11.0-001-macOS.zip", "HubDesk-26.11.0-001-mac.zip", "ClassDesk-Suite-26.11.0-001-Installer.pkg", "StudyDesk-26.11.0-001-mac.zip"].map(asset))
        ok(rel.zipAsset?.name == "StudyDesk-26.11.0-001-mac.zip", "updater picks StudyDesk-<v>-mac.zip only")
        ok(rel.pkgAsset == nil, "updater ignores the suite pkg")
        ok(UpdateManager.repositoryName == "ClassManager", "repo = Natsvkashii/ClassManager")

        client.stop(); listener.cancel()
        print(failed == 0 ? "HUB SUITE: ALL PASSED" : "HUB SUITE: FAILED \(failed)")
        exit(failed == 0 ? 0 : 1)
    }
}
