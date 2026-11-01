// Headless test of the ClassDesk Suite records mirror. Phases (argv[1]): seed | apply | delete | dump.
// Environment: CLASSDESK_DATA_DIR (data), DESKHUB_HOME (hub folder), DESKHUB_NO_LAUNCH=1, DESKHUB_NO_BOOTSTRAP=1, DESKHUB_NO_LINK=1.
import Foundation
import AppKit

@MainActor func summary(_ s: AppStore) -> String {
    let cs = s.state.courses.map { "\($0.name)[\($0.levels.count)lv]" }.sorted().joined(separator: ", ")
    let st = s.state.studentsDirectory.map { $0.fullName }.sorted().joined(separator: ", ")
    return "courses=\(s.state.courses.count) {\(cs)} students=\(s.state.studentsDirectory.count) {\(st)} rubrics=\(s.state.rubrics.count) currency=\(s.state.settings.currency) lang=\(s.state.settings.language)"
}

@MainActor func recordFiles(_ s: AppStore) -> [String] {
    let all = s.suite.records.all()
    return all.keys.sorted().map { k in "\(k)\((all[k]!["deleted"] as? Bool ?? false) ? "  [TOMBSTONE]" : "")" }
}

@MainActor func run() {
    let phase = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "dump"
    let store = AppStore()
    print("[\(phase)] data=\(ProcessInfo.processInfo.environment["CLASSDESK_DATA_DIR"] ?? "?") hub=\(ProcessInfo.processInfo.environment["DESKHUB_HOME"] ?? "?")")
    switch phase {
    case "seed":
        var c1 = Course(name: "Inglese Aziendale è ñ", type: "group", level: "B1", color: store.pickNextAvailableCourseColor())
        c1.levels = [CourseLevel(code: "B1", name: "B1", modules: [CourseModule(name: "M1")])]
        store.state.courses.append(c1)
        var c2 = Course(name: "Spagnolo privato", type: "individual", level: "A2", color: store.pickNextAvailableCourseColor())
        c2.levels = [CourseLevel(code: "A2", name: "A2", modules: [CourseModule(name: "M1")])]
        store.state.courses.append(c2)
        store.state.studentsDirectory.append(Student(firstName: "Giulia", lastName: "Rossi", email: "g@example.com", currentLevel: "B1"))
        store.state.studentsDirectory.append(Student(firstName: "José", lastName: "Núñez", email: "j@example.com", currentLevel: "A2"))
        store.state.settings.currency = "€"
        store.state.settings.googleAccessToken = "SECRET-TOKEN-MUST-NOT-SYNC"
        store.persist()
        store.suite.startup()
        let w = store.suite.exportChanges()
        print("exported now: \(w.count)")
    case "apply":
        store.suite.startup()
        print("backup: \(store.suite.lastBackupURL?.path ?? "none")")
    case "delete":
        store.suite.startup()
        let cid = store.state.courses.first(where: { $0.name.hasPrefix("Spagnolo") })!.id
        store.state.courses.removeAll { $0.id == cid }
        store.state.studentsDirectory.removeAll { $0.firstName == "José" }
        store.persist()
        let w = store.suite.exportChanges()
        print("exported now: \(w.sorted())")
    default:
        store.suite.startup()
    }
    print("state: " + summary(store))
    print("token-leak-in-records: \(store.suite.records.all().values.contains { String(describing: $0["value"] ?? "").contains("SECRET-TOKEN") })")
    print("records(\(store.suite.records.all().count)):")
    for r in recordFiles(store).filter({ !$0.hasPrefix("rubric:") }) { print("  " + r) }
    print("rubric records: \(recordFiles(store).filter { $0.hasPrefix("rubric:") }.count)")
    exit(0)
}
DispatchQueue.main.async { MainActor.assumeIsolated { run() } }
dispatchMain()
