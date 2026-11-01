#!/bin/bash
# Snapshots of every page on a copy of a ClassDesk state file: run_ui_snapshots.sh <classdesk_state_v1.json> <outDir>. The state file is copied, never modified.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; STATE="$1"; OUT="${2:-$(mktemp -d)}"; T="$(mktemp -d)"; mkdir -p "$T/src" "$T/data/ClassDesk"
cp "$STATE" "$T/data/ClassDesk/classdesk_state_v1.json"
cp "$ROOT"/Sources/*.swift "$T/src/"; sed -i '' 's/^@main$//' "$T/src/ContentView.swift"; cp "$ROOT/Tests/UISnapshots.swift" "$T/main.swift"
swiftc -disable-sandbox -module-cache-path /tmp/swift-module-cache -framework SwiftUI -framework AppKit -framework EventKit -framework UniformTypeIdentifiers -Onone -suppress-warnings -o "$T/snap" "$T"/src/*.swift "$ROOT"/../Hub/swift/*.swift "$T/main.swift"
DESKHUB_HOME="$T/hub" CLASSDESK_DATA_DIR="$T/data" DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 "$T/snap" "$OUT"
echo "PNGs in $OUT"
