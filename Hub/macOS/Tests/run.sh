#!/bin/sh
# Compiles HubDesk's sources (without the @main entry) with the tests and runs them.
# usage: Hub/macOS/Tests/run.sh [snapshotOutDir]
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-/tmp/hubdesk-snapshots}"
BIN="${TMPDIR:-/tmp}/hubdesk-tests"
swiftc -swift-version 5 -D HUBDESK_TESTS -disable-sandbox -module-cache-path "${TMPDIR:-/tmp}/hubdesk-swift-module-cache" \
  -framework SwiftUI -framework AppKit -framework Network -framework UserNotifications -framework ServiceManagement \
  -o "$BIN" "$HERE"/../Sources/*.swift "$HERE"/../../swift/*.swift "$HERE"/main.swift
"$BIN" "$OUT"
