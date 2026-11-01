#!/bin/bash
# Builds and runs the headless Suite sync test with temporary data folders (never touches real ClassDesk data).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
mkdir -p "$T/src"
cp "$ROOT"/Sources/*.swift "$T/src/"
sed -i '' 's/^@main$//' "$T/src/ContentView.swift"
cp "$ROOT/Tests/SuiteSyncTest.swift" "$T/main.swift"
swiftc -disable-sandbox -module-cache-path /tmp/swift-module-cache -framework SwiftUI -framework AppKit -framework EventKit \
  -framework UniformTypeIdentifiers -Onone -suppress-warnings -o "$T/suitetest" "$T"/src/*.swift "$ROOT"/../Hub/swift/*.swift "$T/main.swift"
export DESKHUB_NO_LAUNCH=1 DESKHUB_NO_BOOTSTRAP=1 DESKHUB_NO_LINK=1
runA() { CLASSDESK_DATA_DIR="$T/dataA" DESKHUB_HOME="$T/hubA" "$T/suitetest" "$@"; }
runB() { CLASSDESK_DATA_DIR="$T/dataB" DESKHUB_HOME="$T/hubB" "$T/suitetest" "$@"; }
copyrec() { rm -rf "$T/hubB/records/classdesk"; mkdir -p "$T/hubB/records"; cp -R "$T/hubA/records/classdesk" "$T/hubB/records/classdesk"; }
echo "===== 1. device A: seed + export ====="; runA seed
echo; echo "record files on A:"; ls "$T/hubA/records/classdesk" | head -20
echo; echo "===== 2. HubDesk copies A's records to B; B (empty) starts ====="; copyrec; runB apply
echo "backups on B:"; find "$T/dataB/Documents" -name '*.json' | sed "s|$T/||"
BEFORE=$(cd "$T/hubB/records/classdesk" && shasum *.json | shasum)
echo; echo "===== 3. B restarts (no echo: record folder must stay identical, no 2nd backup) ====="; runB dump | head -4
AFTER=$(cd "$T/hubB/records/classdesk" && shasum *.json | shasum)
[ "$BEFORE" = "$AFTER" ] && echo "records unchanged after B restart: OK" || echo "records CHANGED after B restart: FAIL"
echo "backups on B: $(find "$T/dataB/Documents" -name '*.json' | wc -l | tr -d ' ')"
echo; echo "===== 4. device A deletes a course and a student ====="; runA delete
echo; echo "===== 5. HubDesk copies tombstones to B; B restarts ====="; copyrec; runB apply
echo "backups on B: $(find "$T/dataB/Documents" -name '*.json' | wc -l | tr -d ' ') (still 1 expected)"
echo; echo "temp dir: $T"
