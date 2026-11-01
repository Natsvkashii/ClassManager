// Headless checks for the shared module/progress contract: decode a module and grade every part with its own solutions.
// Build & run: see README ("Test macOS").
import Foundation

var failures = 0
func expect(_ cond: Bool, _ msg: String) { if !cond { failures += 1; print("✗ \(msg)") } }

// Grading rules (docs/PROGRESS_FORMAT.md)
expect(Grading.normalize("  L’acqua   minerale. ") == "l'acqua minerale", "normalize")
expect(Grading.check("perche", against: ["perché"]) == .close, "close accent")
expect(Grading.check("Voglio", against: ["voglio", "vorrei"]) == .right, "alternatives")
expect(Grading.check("", against: ["x"]) == .empty, "empty")
expect(Grading.gaps("Io [[sono]] e tu [[]] e [[a|b]]") == [["sono"], [], ["a", "b"]], "gap parse")

guard CommandLine.arguments.count > 1 else {
    print(failures == 0 ? "rules ok" : "FAILED: \(failures)")
    exit(failures == 0 ? 0 : 1)
}
let moduleURL = URL(fileURLWithPath: CommandLine.arguments[1])
let mod = try JSONDecoder().decode(StudyModule.self, from: Data(contentsOf: moduleURL))
print("module \(mod.id): \(mod.sections.count) sections, \(mod.sections.flatMap(\.activities).count) activities, \(mod.allParts.count) parts")

/// Builds the perfect answer for a part from its own solution data.
func perfect(_ p: Exercise) -> AnswerValue? {
    switch p.type {
    case "choice": return .indexSets((p.questions ?? []).map { Array($0.answer.set).sorted() })
    case "truefalse": return .bools((p.statements ?? []).map { $0.answer })
    case "gapfill": return .strings2D((p.items ?? []).map { Grading.gaps($0.text ?? "").map { $0.first ?? "" } })
    case "table": return .strings2D((p.rows ?? []).map { $0.flatMap { Grading.gaps($0).map { $0.first ?? "" } } })
    case "match": return .mapping(Dictionary((p.pairs ?? []).map { ($0[0], $0[1]) }, uniquingKeysWith: { a, _ in a }))
    case "categorize": return .optionalStrings((p.items ?? []).map { $0.category?.values.first })
    case "order": return .order(Array(0..<(p.items?.count ?? 0)))
    default: return nil
    }
}

var graded = 0
for (a, p) in mod.allParts where p.isAutoGraded {
    let ans = perfect(p)
    let o = Grading.grade(p, ans)
    graded += 1
    expect(o.max > 0, "\(a.id)/\(p.id) has no gradable items")
    expect(o.score == o.max, "\(a.id)/\(p.id) perfect answer scored \(o.score)/\(o.max)")
    let back = try JSONDecoder().decode(AnswerValue.self, from: JSONEncoder().encode(ans))
    expect(Grading.grade(p, back).score == o.max, "\(p.id) answer JSON round-trip")
    expect(Grading.grade(p, nil).score == 0, "\(p.id) empty answer must score 0")
}

let root = moduleURL.deletingLastPathComponent()
func exists(_ rel: String?) -> Bool { rel == nil || FileManager.default.fileExists(atPath: root.appendingPathComponent(rel!).path) }
for (a, p) in mod.allParts {
    for m in (a.media ?? []) + (p.media ?? []) { expect(exists(m.src), "missing asset \(m.src ?? "") in \(p.id)") }
    for q in p.questions ?? [] { for o in q.options { expect(exists(o.image), "missing option image in \(p.id)") } }
    for i in (p.left ?? []) + (p.right ?? []) + (p.items ?? []) { expect(exists(i.image), "missing item image in \(p.id)") }
}
expect(exists(mod.cover), "missing cover")
print("auto-graded parts checked: \(graded)")
print(failures == 0 ? "ALL CHECKS PASSED" : "FAILED: \(failures)")
exit(failures == 0 ? 0 : 1)
