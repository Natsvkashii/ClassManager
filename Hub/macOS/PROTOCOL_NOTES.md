# HubDesk macOS – decisions not pinned down by HUBDESK.md

Wire format follows §3 literally (JSON per line, `id`/`re`, `proto: 2`, hash = `DeskHubRecords.hash`, secret = sha256("deskhub-sync:"+code)).

## Network (§3)
- **Code** is trimmed of leading/trailing whitespace before hashing. Windows should do the same.
- **Who connects**: only the lower `deviceId` ever dials (Bonjour result, then every 10 s via the Bonjour endpoint or the last `host:port`). The other side only accepts. If a second connection for the same device arrives, the newer replaces the older.
- **hello**: the dialer sends `hello` with `id`; the answer is `hello` with `re` (no `secret`). Both sides then start a sync immediately. Wrong secret → `{"t":"error","re":id,"message":"codice errato"}` and close after 0.3 s. A `hello` with our own deviceId is dropped.
- **Ping**: every 15 s a `ping` request per connection; a counter of unanswered pings is reset by *any* inbound line; at 3 the connection is closed.
- **plan()** is the JS algorithm. Execution of the "absent record" cases is conservative (never deletes data): `delLocal` (we have it, peer lacks it, base == ours) is **pushed again**; `delRemote` is **pulled again**. Deletions travel only as tombstones.
- **put** is applied unconditionally (stores the record verbatim into `records/<app>/`, creating the folder). `put` batches: ≤100 records / ≈1.5 MB per message. A `base` message and a `put` also remove stale conflict entries for `(key, thatPeer)`.
- **base** is saved locally right after pulled records are stored (so an edit made immediately afterwards is not seen as a conflict), and again, together with the pushed keys, after the peer acknowledged `base`.
- **changed**: sent only for local records whose hash differs from what HubDesk last saw (records it stored itself from the network do not echo). A 5 s rescan also catches changes the file watcher missed.
- **Conflicts**: both devices record the conflict independently in their own `conflicts.json`. Resolution never needs the peer to be online: "keep mine" sets `base[peer][key] := hash(remote)` so the next sync pushes ours; "keep theirs" stores the remote record and sets `base := its hash`. Then a `changed` + sync is sent. Items are re-validated at the end of a sync (stale plans are dropped and a new sync queued).
- **peers.json**: all known peers, `lastSeen` / `lastSync` ISO with milliseconds; `host` is the numeric address seen on the socket (scope id `%en0` stripped), `port` the listener port of peers we dialled (0 for peers that only dialled us).
- **Bonjour**: service name = deviceName; TXT `id`, `v`, `p=macos`. Peers without `id` in TXT are ignored.
- Device name: `DESKHUB_DEVICE_NAME` overrides `settings.json.deviceName` for the running process (not persisted).

## settings.json extra keys (unknown keys are always preserved)
`autoUpdate` (bool, default true), `launchAtLogin` (bool, default true), `firstRunDone` (bool; absent → welcome sheet). `channel` / `autoBoard` as in §1.

## Local channel (§4)
- `hello` reply has no `re`/`id`; `{"t":"hello","ok":true,"self":{deviceId,deviceName},"peers":[…]}`; wrong token → `{"t":"hello","ok":false}` and close.
- `peers` = every known peer in the `peers.json` entry shape (with `connected` true/false); broadcast whenever that list changes.
- `board` from an app: `msg` is forwarded untouched inside `{"t":"board","from","fromName","msg"}`. From a peer, the whole network message is forwarded to local clients as received.
- `records` notifications carry the app-local keys (no `<app>/` prefix).
- `runtime.json.heartbeat` has no fractional seconds (so `DeskHubPaths.runtime()` parses it); the file is deleted on a clean quit.

## App manager
- Installed version = `CFBundleVersion` if it looks like `YY.MM.R-BBB`, otherwise `CFBundleShortVersionString` (the macOS apps write the short form without the build).
- A release's version for an app comes from the asset file name (`ClassDesk-<v>-macOS.zip` …); the highest version over all eligible releases wins. Stable channel ignores `prerelease` and drafts.
- `--page` can only be honoured at cold start (macOS does not deliver arguments to a running app). HubDesk also registers the `hubdesk://open?page=devices` URL scheme for that case, and always shows the window on a "reopen".
- ClassDesk/StudyDesk icons are bundled (`classdesk-icon.icns`, `studydesk-icon.png`) as a fallback when the app is not installed.

## Races
- `put` is *not* applied blindly: if the receiver has a local edit not yet agreed with that peer (hash ≠ incoming and ≠ base), the record is skipped and the reply is `{"t":"error","message":"modificato nel frattempo"}` (the sender then sends no `base`; the receiver starts a sync, which detects a conflict or pushes its newer version). Pulled records are likewise skipped if they changed locally after the plan.
- A conflict entry for `(key, peer)` lets that peer's `put` through (it is the resolution push). A refused `put` makes the sender retry in 2 s.
