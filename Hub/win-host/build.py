#!/usr/bin/env python3
# Builds HubDesk-<version>-win-x64.exe, the native Windows HubDesk (hubdesk_native.cpp + the page files appended).
# usage: python3 Hub/win-host/build.py [out.exe]   (needs zig: ~/.local/bin/zig or PATH). Not used by suite.py yet:
# the network engine is not native (StudyDesk/docs/WINDOWS_NATIVE_PLAN.md §3).
import json, os, re, shutil, struct, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HUB = os.path.dirname(HERE)
INCLUDE = os.path.join(HUB, "..", "ClassDesk", "Windows-Version", "native", "include")
ELECTRON = os.path.join(HUB, "electron")


def version_tuple(v):
    nums = [int(x) for x in re.findall(r"\d+", v)]
    while len(nums) < 4:
        nums.append(0)
    return ",".join(str(x) for x in nums[:4])


def detected_build_type():
    info_swift = os.path.join(HUB, "macOS", "Sources", "HubInfo.swift")
    if os.path.exists(info_swift):
        m = re.search(r'buildType\s*:\s*String\s*=\s*"([^"]+)"', open(info_swift, encoding="utf-8").read())
        if m:
            return m.group(1)
    return "beta"


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
    b_type = detected_build_type()
    vt = version_tuple(v)
    shutil.copy(os.path.join(ELECTRON, "build", "icon.ico"), os.path.join(work, "app.ico"))
    shutil.copy(os.path.join(HERE, "app.manifest"), os.path.join(work, "app.manifest"))
    open(os.path.join(work, "app.rc"), "w", encoding="utf-8").write(f"""#include <winver.h>
1 ICON "app.ico"
1 24 "app.manifest"
1 VERSIONINFO
FILEVERSION {vt}
PRODUCTVERSION {vt}
FILEFLAGSMASK 0x3fL
FILEFLAGS 0x0L
FILEOS 0x40004L
FILETYPE 0x1L
FILESUBTYPE 0x0L
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "040904b0"
        BEGIN
            VALUE "CompanyName", "Guaira Jaramillo Nitoglia\\0"
            VALUE "FileDescription", "HubDesk - Classroom Tools Suite Hub\\0"
            VALUE "FileVersion", "{v}\\0"
            VALUE "InternalName", "HubDesk\\0"
            VALUE "LegalCopyright", "Copyright (C) 2026 Guaira Jaramillo Nitoglia (GPL-3.0)\\0"
            VALUE "OriginalFilename", "HubDesk.exe\\0"
            VALUE "ProductName", "HubDesk\\0"
            VALUE "ProductVersion", "{v}\\0"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x0409, 1200
    END
END
""")
    exe = os.path.join(work, "HubDesk.exe")
    subprocess.run([zig, "c++", "-target", "x86_64-windows", "-municode", "-Wl,--subsystem,windows", "-O2", "-std=c++17",
                    f'-DBUNDLED_APP_VERSION=L"{v}"', f'-DBUNDLED_APP_BUILD_TYPE=L"{b_type}"', "-I", INCLUDE, os.path.join(HERE, "hubdesk_native.cpp"), os.path.join(work, "app.rc"),
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
