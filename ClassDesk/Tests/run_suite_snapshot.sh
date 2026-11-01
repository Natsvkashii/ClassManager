#!/bin/bash
# Builds the Suite settings snapshot with temporary data and writes PNGs to the folder given as $1.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${1:-$(mktemp -d)}"; T="$(mktemp -d)"; mkdir -p "$T/src"
cp "$ROOT"/Sources/*.swift "$T/src/"; sed -i '' 's/^@main$//' "$T/src/ContentView.swift"; cp "$ROOT/Tests/SuiteSnapshot.swift" "$T/main.swift"
swiftc -disable-sandbox -module-cache-path /tmp/swift-module-cache -framework SwiftUI -framework AppKit -framework EventKit -framework UniformTypeIdentifiers -Onone -suppress-warnings -o "$T/snap" "$T"/src/*.swift "$ROOT"/../Hub/swift/*.swift "$T/main.swift"
DESKHUB_HOME="$T/hub" CLASSDESK_DATA_DIR="$T/data" DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 "$T/snap" "$OUT"
echo "PNGs in $OUT"
