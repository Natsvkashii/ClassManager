// make_icon.swift — draws the HubDesk icon (hub / network glyph) and writes AppIcon.icns + logo.png.
// Usage: swiftc -o /tmp/make_icon make_icon.swift && /tmp/make_icon <outDir>
import AppKit

func draw(_ s: CGFloat) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(s), pixelsHigh: Int(s), bitsPerSample: 8, samplesPerPixel: 4,
                               hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    let inset = s * 0.06
    let r = CGRect(x: inset, y: inset, width: s - 2 * inset, height: s - 2 * inset)
    let path = NSBezierPath(roundedRect: r, xRadius: s * 0.225, yRadius: s * 0.225)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.03, color: NSColor.black.withAlphaComponent(0.3).cgColor)
    NSColor.white.setFill(); path.fill()
    ctx.restoreGState()
    path.addClip()
    let grad = NSGradient(colors: [NSColor(red: 0.055, green: 0.647, blue: 0.914, alpha: 1), NSColor(red: 0.545, green: 0.361, blue: 0.965, alpha: 1)])!
    grad.draw(in: r, angle: -50)
    // hub glyph
    let c = CGPoint(x: s / 2, y: s / 2)
    let R = s * 0.27
    var pts: [CGPoint] = []
    for i in 0..<6 {
        let a = CGFloat(i) * .pi / 3 + .pi / 6
        pts.append(CGPoint(x: c.x + cos(a) * R, y: c.y + sin(a) * R))
    }
    NSColor.white.withAlphaComponent(0.85).setStroke()
    for p in pts {
        let l = NSBezierPath(); l.move(to: c); l.line(to: p); l.lineWidth = s * 0.028; l.lineCapStyle = .round; l.stroke()
    }
    let ring = NSBezierPath()
    for (i, p) in pts.enumerated() { i == 0 ? ring.move(to: p) : ring.line(to: p) }
    ring.close(); ring.lineWidth = s * 0.016; NSColor.white.withAlphaComponent(0.35).setStroke(); ring.stroke()
    NSColor.white.setFill()
    for p in pts { NSBezierPath(ovalIn: CGRect(x: p.x - s * 0.05, y: p.y - s * 0.05, width: s * 0.1, height: s * 0.1)).fill() }
    NSBezierPath(ovalIn: CGRect(x: c.x - s * 0.1, y: c.y - s * 0.1, width: s * 0.2, height: s * 0.2)).fill()
    NSColor(red: 0.055, green: 0.647, blue: 0.914, alpha: 1).setFill()
    NSBezierPath(ovalIn: CGRect(x: c.x - s * 0.045, y: c.y - s * 0.045, width: s * 0.09, height: s * 0.09)).fill()
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

let out = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
let iconset = out.appendingPathComponent("AppIcon.iconset")
try? FileManager.default.removeItem(at: iconset)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let px = CGFloat(size * scale)
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try draw(px).representation(using: .png, properties: [:])!.write(to: iconset.appendingPathComponent(name))
    }
}
try draw(512).representation(using: .png, properties: [:])!.write(to: out.appendingPathComponent("logo.png"))
let p = Process()
p.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
p.arguments = ["-c", "icns", iconset.path, "-o", out.appendingPathComponent("AppIcon.icns").path]
try p.run(); p.waitUntilExit()
try? FileManager.default.removeItem(at: iconset)
print("icon written to \(out.path)")
