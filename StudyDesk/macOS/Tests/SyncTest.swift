// Two-process LAN sync test. Build with -D SNAPSHOT_TESTS -parse-as-library with macOS/Sources/*.swift and Hub/swift/DeskHub.swift.
// STUDYDESK_HOME=<dirA> STUDYDESK_DEVICE_NAME=A DESKHUB_HOME=<hubA> synctest serve <scenario>
// STUDYDESK_HOME=<dirB> STUDYDESK_DEVICE_NAME=B DESKHUB_HOME=<hubB> synctest sync A <scenario>
import SwiftUI
import AppKit

@main
struct SyncTest {
    @MainActor static func main() {
        _ = NSApplication.shared
        let args = CommandLine.arguments
        let store = AppStore()
        store.state.role = "teacher"
        store.state.profile = StudentProfile(firstName: "T", lastName: "T", email: "t@x.it")
        store.state.settings.syncCode = "classe-2026"
        let mode = args[1]
        let scenario = args.last ?? ""
        if mode == "serve" {
            if scenario == "seed" {
                var g = StudyGroup(name: "Gruppo dal Mac A"); g.id = "grp-shared"
                g.students = [GroupStudent(firstName: "Mario", lastName: "Rossi", email: "m@x.it")]
                store.state.groups = [g]
            } else if scenario == "conflict" {
                if let i = store.state.groups.firstIndex(where: { $0.id == "grp-shared" }) { store.state.groups[i].name = "Nome cambiato su A" }
            }
            store.persist()
            store.sync.start()
            print("serving as \(store.sync.deviceName): \(store.state.groups.map(\.name))"); fflush(stdout)
            RunLoop.main.run(until: Date().addingTimeInterval(25))
            print("A final groups: \(store.state.groups.map(\.name))")
            return
        }
        // client
        if scenario == "conflict", let i = store.state.groups.firstIndex(where: { $0.id == "grp-shared" }) {
            store.state.groups[i].name = "Nome cambiato su B"; store.persist()
        }
        store.sync.start()
        let deadline = Date().addingTimeInterval(10)
        while store.sync.peers.isEmpty && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.2)) }
        guard let peer = store.sync.peers.first(where: { if case .service(let n, _, _, _) = $0.endpoint { return n == args[2] }; return false }) else {
            print("✗ peer not found (Bonjour / local network permission?) peers=\(store.sync.peers.count)"); return
        }
        var done = false
        Task { await store.sync.sync(with: peer); done = true }
        while !done { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
        print("B status: \(store.sync.status)")
        print("B groups: \(store.state.groups.map(\.name))")
        print("B conflicts: \(store.sync.conflicts.map { store.sync.describe($0.key) })")
        if scenario == "conflict", !store.sync.conflicts.isEmpty {
            var resolved = false
            Task { await store.sync.resolve(store.sync.conflicts.map(\.key), keepLocal: true); resolved = true }
            while !resolved { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
            print("B resolved (kept B): \(store.sync.status)")
        }
        RunLoop.main.run(until: Date().addingTimeInterval(1))
    }
}
