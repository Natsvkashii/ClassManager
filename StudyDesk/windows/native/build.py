#!/usr/bin/env python3
# Builds StudyDesk-<version>-win-x64.exe, the native Windows app (studydesk_native.cpp + StudyDesk/app appended).
# usage: python3 windows/native/build.py [out.exe]   (from StudyDesk/; needs zig: ~/.local/bin/zig or PATH)
import os, re, shutil, struct, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))                 # StudyDesk/
INCLUDE = os.path.join(ROOT, "..", "ClassDesk", "Windows-Version", "native", "include")   # webview.h + WebView2.h, shared with ClassDesk
SKIP = {"sw.js"}                                                # offline cache: not used by the native app


def version():
    t = open(os.path.join(ROOT, "app", "js", "core", "version.js"), encoding="utf-8").read()
    return re.search(r"APP_VERSION\s*=\s*['\"]([^'\"]+)", t).group(1)


def build(out=None):
    v = version()
    out = out or os.path.join(ROOT, "dist", f"StudyDesk-{v}-win-x64.exe")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    zig = shutil.which("zig") or os.path.expanduser("~/.local/bin/zig")
    work = tempfile.mkdtemp(prefix="sd-native-")
    shutil.copy(os.path.join(ROOT, "build", "icon.ico"), os.path.join(work, "app.ico"))
    nums = [int(x) for x in re.findall(r"\d+", v)]
    while len(nums) < 4: nums.append(0)
    vt = ",".join(str(x) for x in nums[:4])
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
            VALUE "FileDescription", "StudyDesk - Classroom Tools Suite\\0"
            VALUE "FileVersion", "{v}\\0"
            VALUE "InternalName", "StudyDesk\\0"
            VALUE "LegalCopyright", "Copyright (C) 2026 Guaira Jaramillo Nitoglia (GPL-3.0)\\0"
            VALUE "OriginalFilename", "StudyDesk.exe\\0"
            VALUE "ProductName", "StudyDesk\\0"
            VALUE "ProductVersion", "{v}\\0"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x0409, 1200
    END
END
""")
    shutil.copy(os.path.join(HERE, "app.manifest"), os.path.join(work, "app.manifest"))
    exe = os.path.join(work, "StudyDesk.exe")
    subprocess.run([zig, "c++", "-target", "x86_64-windows", "-municode", "-Wl,--subsystem,windows", "-O2", "-std=c++17",
                    f'-DBUNDLED_APP_VERSION=L"{v}"', '-DBUNDLED_BUILD_TYPE=L"beta"', "-I", INCLUDE, os.path.join(HERE, "studydesk_native.cpp"), os.path.join(work, "app.rc"),
                    "-o", exe, "-lole32", "-loleaut32", "-luser32", "-lshlwapi", "-lshell32", "-lcomctl32", "-lcomdlg32", "-ladvapi32",
                    "-lversion", "-lgdi32", "-lws2_32"], check=True, cwd=work)
    app = os.path.join(ROOT, "app")
    files = []
    for d, _, names in os.walk(app):
        for n in sorted(names):
            if n in SKIP or n.startswith("."):
                continue
            p = os.path.join(d, n)
            files.append((os.path.relpath(p, app).replace(os.sep, "/"), p))
    shutil.copy(os.path.join(ROOT, "build", "icon.ico"), os.path.join(work, "StudyDesk.ico"))
    files.append(("icons/StudyDesk.ico", os.path.join(work, "StudyDesk.ico")))
    files.append(("deskhub.js", os.path.join(ROOT, "electron", "deskhub.js")))   # hub.json rules, loaded by core/hubnative.js
    with open(out, "wb") as o:
        o.write(open(exe, "rb").read())
        start = o.tell()
        for rel, p in files:
            data = open(p, "rb").read()
            r = rel.encode("utf-8")
            o.write(struct.pack("<I", len(r)) + r + struct.pack("<Q", len(data)) + data)
        o.write(struct.pack("<QI", start, len(files)) + b"SDAPP001")
    shutil.rmtree(work, ignore_errors=True)
    print(f"✓ {out}  ({os.path.getsize(out) / 1e6:.1f} MB, {len(files)} files)")
    return out


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else None)
