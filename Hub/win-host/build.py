#!/usr/bin/env python3
# Builds HubDesk-<version>-win-x64.exe, the native Windows HubDesk (hubdesk_native.cpp + the page files appended).
# usage: python3 Hub/win-host/build.py [out.exe]   (needs zig: ~/.local/bin/zig or PATH). Not used by suite.py yet:
# the network engine is not native (StudyDesk/docs/WINDOWS_NATIVE_PLAN.md §3).
import json, os, shutil, struct, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HUB = os.path.dirname(HERE)
INCLUDE = os.path.join(HUB, "..", "ClassDesk", "Windows-Version", "native", "include")
ELECTRON = os.path.join(HUB, "electron")


def page_bundle():
    """page/hubdesk-native.js with catalog.js and manager.js in front, as functions (no fetch, no eval: the page has a CSP)."""
    mods = []
    sources = [("catalog", os.path.join(ELECTRON, "catalog", "catalog.js")), ("manager", os.path.join(ELECTRON, "catalog", "manager.js")),
               ("sync-core", os.path.join(ELECTRON, "net", "sync-core.js")), ("describe", os.path.join(ELECTRON, "net", "describe.js")),
               ("hub-engine", os.path.join(HERE, "page", "hub-engine.js"))]
    for name, path in sources:
        src = open(path, encoding="utf-8").read()
        mods.append(f"{json.dumps(name)}: function (module, exports, require) {{\n{src}\n}}")
    return "window.__hd_modules = {\n" + ",\n".join(mods) + "\n};\n" + open(os.path.join(HERE, "page", "hubdesk-native.js"), encoding="utf-8").read()


def build(out=None):
    v = json.load(open(os.path.join(ELECTRON, "package.json")))["version"]
    v = os.environ.get("SUITE_VERSION", v)
    out = out or os.path.join(HUB, "dist", f"HubDesk-{v}-win-x64.exe")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    zig = shutil.which("zig") or os.path.expanduser("~/.local/bin/zig")
    work = tempfile.mkdtemp(prefix="hd-native-")
    shutil.copy(os.path.join(ELECTRON, "build", "icon.ico"), os.path.join(work, "app.ico"))
    shutil.copy(os.path.join(HERE, "app.manifest"), os.path.join(work, "app.manifest"))
    open(os.path.join(work, "app.rc"), "w").write('1 ICON "app.ico"\n1 24 "app.manifest"\n')
    exe = os.path.join(work, "HubDesk.exe")
    subprocess.run([zig, "c++", "-target", "x86_64-windows", "-municode", "-Wl,--subsystem,windows", "-O2", "-std=c++17",
                    f'-DBUNDLED_APP_VERSION=L"{v}"', '-DBUNDLED_APP_BUILD_TYPE=L"beta"', "-I", INCLUDE, os.path.join(HERE, "hubdesk_native.cpp"), os.path.join(work, "app.rc"),
                    "-o", exe, "-lole32", "-loleaut32", "-luser32", "-lshlwapi", "-lshell32", "-lcomctl32", "-ladvapi32",
                    "-lwinhttp", "-lgdi32", "-lws2_32", "-lversion", "-ldnsapi"], check=True, cwd=work)
    files = []
    for d, _, names in os.walk(os.path.join(ELECTRON, "renderer")):
        for n in sorted(names):
            p = os.path.join(d, n)
            files.append(("renderer/" + os.path.relpath(p, os.path.join(ELECTRON, "renderer")).replace(os.sep, "/"), p))
    bundle = os.path.join(work, "hubdesk-native.js")
    open(bundle, "w", encoding="utf-8").write(page_bundle())
    files.append(("page/hubdesk-native.js", bundle))
    with open(out, "wb") as o:
        o.write(open(exe, "rb").read())
        start = o.tell()
        for rel, p in files:
            data = open(p, "rb").read(); r = rel.encode()
            o.write(struct.pack("<I", len(r)) + r + struct.pack("<Q", len(data)) + data)
        o.write(struct.pack("<QI", start, len(files)) + b"SDAPP001")
    shutil.rmtree(work, ignore_errors=True)
    print(f"✓ {out}  ({os.path.getsize(out) / 1e6:.1f} MB, {len(files)} files)")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else None)
