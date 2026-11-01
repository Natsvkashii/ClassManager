// ClassDesk courses in StudyDesk: ClassDesk publishes one hub group per module; StudyDesk must show one group per course,
// merge the groups imported per module and never duplicate students (a student without e-mail used to be re-added every poll).
// Build: swiftc -D SNAPSHOT_TESTS -parse-as-library -framework SwiftUI -framework AppKit macOS/Sources/*.swift macOS/Tests/HubCourseTest.swift Hub/swift/*.swift -o /tmp/hubcourse
// Run:   DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 /tmp/hubcourse [state.json hub.json]   (the files are copied, never modified)
import SwiftUI
import AppKit

var failed = 0
func ok(_ c: Bool, _ m: String) { if c { print("  ok  \(m)") } else { failed += 1; print("  ✗✗ \(m)") } }
func tmpDir(_ n: String) -> URL {
    let d = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("hubcourse-\(n)-\(UUID().uuidString)")
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
    return d
}

@main
struct HubCourseTest {
    @MainActor static func main() async {
        _ = NSApplication.shared
        let sd = tmpDir("sd"), hub = tmpDir("hub")
        setenv("STUDYDESK_HOME", sd.path, 1)
        setenv("DESKHUB_HOME", hub.path, 1)
        let args = CommandLine.arguments
        if args.count > 2 {
            try? FileManager.default.copyItem(at: URL(fileURLWithPath: args[1]), to: sd.appendingPathComponent("state.json"))
            try? FileManager.default.copyItem(at: URL(fileURLWithPath: args[2]), to: hub.appendingPathComponent("hub.json"))
        } else {
            // Synthetic hub: course "Sera" with modules M1 and M2; Bea (no e-mail) is in both, Ugo only in M2.
            let st = { (id: String, f: String, e: String, cd: String) in
                ["id": id, "firstName": f, "lastName": "X", "email": e, "refs": ["classdesk": cd], "updatedAt": "", "updatedBy": "classdesk"] as [String: Any] }
            let gr = { (id: String, name: String, mod: String, ids: [String]) in
                ["id": id, "name": name, "level": "A1", "owner": "classdesk", "refs": ["classdesk": ["courseId": "crs-1", "levelId": "lvl-1", "moduleId": mod]],
                 "studentIds": ids, "updatedAt": "", "updatedBy": "classdesk"] as [String: Any] }
            let data: [String: Any] = ["format": "deskhub", "formatVersion": 1, "updatedAt": "",
                "students": [st("h1", "Ada", "ada@x.it", "c1"), st("h2", "Bea", "", "c2"), st("h3", "Ugo", "ugo@x.it", "c3")],
                "groups": [gr("g1", "Sera 20:00 › A1 › M1", "m1", ["h1", "h2"]), gr("g2", "Sera 20:00 › A1 › M2", "m2", ["h2", "h3"])]]
            try? JSONSerialization.data(withJSONObject: data).write(to: hub.appendingPathComponent("hub.json"))
        }
        let store = AppStore()
        store.state.role = "teacher"
        let before = store.state.groups.count
        for _ in 0..<4 { store.pullFromHub() }
        let hubData = HubBridge.hub.load()
        let courses = HubCourse.from(hubData.groups.filter { $0.owner == "classdesk" })
        let active = store.state.groups.filter { $0.hubId != nil && $0.archived != true }
        print("== groups: \(before) before, \(store.state.groups.count) after; \(courses.count) ClassDesk courses in the hub")
        for g in active { print("     \(g.name) · \(g.level) · \(g.students.count) studenti · \(g.classDesk?.label ?? "-")") }
        ok(active.count == courses.count, "one StudyDesk group per ClassDesk course")
        ok(Set(active.compactMap { $0.classDesk?.courseId }).count == active.count, "no course appears twice")
        for c in courses {
            guard let g = active.first(where: { $0.classDesk?.courseId == c.courseId }) else { ok(false, "group for \(c.name)"); continue }
            ok(g.students.count == c.studentCount, "\(c.name): \(g.students.count) students = \(c.studentCount) in its modules")
            ok(!g.name.contains(" › "), "\(c.name): name without level/module")
        }
        let linked = HubBridge.hub.load().groups.filter { $0.owner == "classdesk" }
        ok(linked.allSatisfy { m in active.contains { $0.id == m.refs.studydesk } }, "every module linked to its course group")
        ok(HubBridge.hub.available().isEmpty, "nothing left to import")
        let saved = (try? JSONDecoder().decode(AppState.self, from: Data(contentsOf: sd.appendingPathComponent("state.json"))))?.groups.count
        ok(saved == store.state.groups.count, "state saved")
        print(failed == 0 ? "ALL CHECKS PASSED" : "FAILED: \(failed)")
        exit(failed == 0 ? 0 : 1)
    }
}
