#!/usr/bin/env python3
"""
StudyDesk Android Build Script
Compiles, dexes, packages, aligns, and signs the native StudyDesk Android reader APK.
Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (GPL-3.0).
"""

import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(HERE))
STUDYDESK_ROOT = os.path.join(PROJECT_ROOT, "StudyDesk")
APP_ROOT = os.path.join(HERE, "app", "src", "main")

def get_version():
    try:
        with open(os.path.join(STUDYDESK_ROOT, "package.json"), "r", encoding="utf-8") as f:
            return json.load(f)["version"]
    except Exception:
        return "26.11.1-013"

# Auto-detect Android SDK
SDK = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or os.path.expanduser("~/Library/Android/sdk")
if not os.path.exists(SDK):
    raise SystemExit(f"Android SDK not found at {SDK}")

# Auto-detect Java 21 (from Minecraft runtime or system)
JAVA_HOME = os.environ.get("JAVA_HOME")
CANDIDATE_JARS = [
    os.path.expanduser("~/Library/Application Support/minecraft/runtime/java-runtime-delta/mac-os-arm64/java-runtime-delta/jre.bundle/Contents/Home"),
    os.path.expanduser("~/Library/Application Support/minecraft/runtime/java-runtime-epsilon/mac-os-arm64/java-runtime-epsilon/jre.bundle/Contents/Home"),
]
if not JAVA_HOME or not os.path.exists(os.path.join(JAVA_HOME, "bin", "javac")):
    for cand in CANDIDATE_JARS:
        if os.path.exists(os.path.join(cand, "bin", "javac")):
            JAVA_HOME = cand
            break

if not JAVA_HOME:
    raise SystemExit("Java 21 JDK not found. Please set JAVA_HOME.")

JAVAC = os.path.join(JAVA_HOME, "bin", "javac")
KEYTOOL = os.path.join(JAVA_HOME, "bin", "keytool")

# SDK Tools
BUILD_TOOLS_DIR = os.path.join(SDK, "build-tools")
available_bt = sorted(os.listdir(BUILD_TOOLS_DIR), reverse=True)
if not available_bt:
    raise SystemExit("No Android build-tools installed")
BT = os.path.join(BUILD_TOOLS_DIR, available_bt[0])

AAPT2 = os.path.join(BT, "aapt2")
D8 = os.path.join(BT, "d8")
ZIPALIGN = os.path.join(BT, "zipalign")
APKSIGNER = os.path.join(BT, "apksigner")

# Platform android.jar
PLATFORMS_DIR = os.path.join(SDK, "platforms")
available_platforms = sorted(os.listdir(PLATFORMS_DIR), reverse=True)
if not available_platforms:
    raise SystemExit("No Android platform installed in " + PLATFORMS_DIR)
ANDROID_JAR = os.path.join(PLATFORMS_DIR, available_platforms[0], "android.jar")

ENV = os.environ.copy()
ENV["JAVA_HOME"] = JAVA_HOME
ENV["PATH"] = f"{os.path.join(JAVA_HOME, 'bin')}:{ENV.get('PATH', '')}"


def build():
    print(f"=== Building StudyDesk Android Reader ===")
    print(f"  SDK: {SDK}")
    print(f"  Build Tools: {BT}")
    print(f"  Platform: {ANDROID_JAR}")
    print(f"  Java: {JAVA_HOME}")

    work = tempfile.mkdtemp(prefix="studydesk-apk-")
    try:
        # 1. Compile resources
        print("\n[1/6] Compiling Android resources with AAPT2...")
        compiled_res = os.path.join(work, "compiled")
        os.makedirs(compiled_res, exist_ok=True)
        res_dir = os.path.join(APP_ROOT, "res")
        subprocess.run([AAPT2, "compile", "--dir", res_dir, "-o", compiled_res], check=True, env=ENV)

        # 2. Link resources & generate R.java
        print("[2/6] Linking resources and generating R.java...")
        manifest = os.path.join(APP_ROOT, "AndroidManifest.xml")
        base_apk = os.path.join(work, "base.apk")
        gen_dir = os.path.join(work, "gen")
        os.makedirs(gen_dir, exist_ok=True)
        flats = [os.path.join(compiled_res, x) for x in os.listdir(compiled_res) if x.endswith(".flat")]
        ver = get_version()
        m = re.match(r"^(\d+)\.(\d+)\.(\d+)-(\d+)$", ver)
        v_code = int(f"{int(m.group(1)):02d}{int(m.group(2)):02d}{int(m.group(3)):02d}{int(m.group(4)):03d}") if m else 1
        subprocess.run([
            AAPT2, "link", "-I", ANDROID_JAR, "--manifest", manifest,
            "--version-code", str(v_code), "--version-name", ver,
            "-o", base_apk, "--java", gen_dir
        ] + flats, check=True, env=ENV)

        # 3. Compile Java sources
        print("[3/6] Compiling Java sources with javac...")
        java_sources = []
        for r, _, files in os.walk(os.path.join(APP_ROOT, "java")):
            for f in files:
                if f.endswith(".java"):
                    java_sources.append(os.path.join(r, f))
        for r, _, files in os.walk(gen_dir):
            for f in files:
                if f.endswith(".java"):
                    java_sources.append(os.path.join(r, f))

        bin_dir = os.path.join(work, "bin")
        os.makedirs(bin_dir, exist_ok=True)
        subprocess.run([JAVAC, "-cp", ANDROID_JAR, "-d", bin_dir] + java_sources, check=True, env=ENV)

        # 4. Dex with D8
        print("[4/6] Creating Dalvik Executable (classes.dex) with D8...")
        class_files = []
        for r, _, files in os.walk(bin_dir):
            for f in files:
                if f.endswith(".class"):
                    class_files.append(os.path.join(r, f))

        dex_dir = os.path.join(work, "dex")
        os.makedirs(dex_dir, exist_ok=True)
        subprocess.run([D8, "--lib", ANDROID_JAR, "--output", dex_dir] + class_files, check=True, env=ENV)

        # 5. Assemble APK with classes.dex and assets
        print("[5/6] Assembling package with web assets and preloaded books...")
        unaligned_apk = os.path.join(work, "unaligned.apk")
        shutil.copy(base_apk, unaligned_apk)

        with zipfile.ZipFile(unaligned_apk, "a") as zf:
            # Add classes.dex
            dex_file = os.path.join(dex_dir, "classes.dex")
            zf.write(dex_file, "classes.dex")

            # Add assets
            assets_dir = os.path.join(APP_ROOT, "assets")
            for r, _, files in os.walk(assets_dir):
                for f in files:
                    full = os.path.join(r, f)
                    rel = os.path.relpath(full, assets_dir)
                    zf.write(full, f"assets/{rel}")

        # 6. Align and Sign
        print("[6/6] Zipalign and signing APK...")
        aligned_apk = os.path.join(work, "aligned.apk")
        subprocess.run([ZIPALIGN, "-p", "4", unaligned_apk, aligned_apk], check=True)

        # Keystore
        keystore = os.path.join(HERE, "studydesk-release.keystore")
        if not os.path.exists(keystore):
            print("  -> Generating dedicated release keystore...")
            subprocess.run([
                KEYTOOL, "-genkeypair", "-keystore", keystore, "-storepass", "studydesk2026",
                "-alias", "studydesk", "-keypass", "studydesk2026",
                "-dname", "CN=StudyDesk, OU=Classroom Tools, O=Guaira Jaramillo Nitoglia, C=IT",
                "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000"
            ], check=True, env=ENV, stdout=subprocess.DEVNULL)

        final_apk_name = "StudyDesk-Reader.apk"
        root_apk_path = os.path.join(PROJECT_ROOT, final_apk_name)
        signed_apk = os.path.join(work, "signed.apk")

        subprocess.run([
            APKSIGNER, "sign", "--ks", keystore, "--ks-pass", "pass:studydesk2026",
            "--ks-key-alias", "studydesk", "--key-pass", "pass:studydesk2026",
            "--out", signed_apk, aligned_apk
        ], check=True, env=ENV)

        # Verify
        subprocess.run([APKSIGNER, "verify", signed_apk], check=True, env=ENV)

        # Copy to root and distribution locations
        shutil.copyfile(signed_apk, root_apk_path)
        shutil.copyfile(signed_apk, os.path.join(PROJECT_ROOT, "StudyDesk.apk"))
        
        # Also copy to StudyDesk/dist if present
        dist_dir = os.path.join(STUDYDESK_ROOT, "dist")
        os.makedirs(dist_dir, exist_ok=True)
        shutil.copyfile(signed_apk, os.path.join(dist_dir, f"StudyDesk-{ver}-Android.apk"))

        size_mb = os.path.getsize(root_apk_path) / (1024 * 1024)
        print(f"\n[SUCCESS] Installable Android APK built successfully!")
        print(f"  -> File: {root_apk_path} ({size_mb:.2f} MB)")
        print(f"  -> Alternate: {os.path.join(PROJECT_ROOT, 'StudyDesk.apk')}")
        print(f"  -> Package: com.guairajaramillo.studydesk (v{ver})")
        print(f"  -> Ready to install on Android smartphones!")

    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    build()
