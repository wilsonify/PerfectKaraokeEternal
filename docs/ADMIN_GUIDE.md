# PerfectKaraokeEternal administrator guide

This guide is for the person who runs the player: installing it, choosing how it is reached on the
network, keeping it updated, and understanding what is stored where.

PerfectKaraokeEternal has **no application backend**. It is a static HTML/CSS/JavaScript app plus a
small Node static file server (`serve.js`). There are no accounts, no database, no uploads, and no
server-side user data. Each visitor's browser reads that visitor's own music folder. The server
never serves music files.

If you only want to sing on your own computer, the [user guide](USER_GUIDE.md) is enough.

## 1. Requirements

| Requirement | Details |
| --- | --- |
| Node.js | 20 or newer |
| Runtime dependencies | None; `serve.js` uses only Node's standard library |
| Disk | The repository itself (a few MB); your music lives wherever you keep it |
| Browser | Chrome or Edge recommended; other modern browsers can still load songs (see §8) |
| Network | Loopback only by default; LAN access is an explicit opt-in |

## 2. Install and start

```bash
git clone <repository-url> PerfectKaraokeEternal
cd PerfectKaraokeEternal
npm start
```

Then open <http://localhost:3000>.

`npm install` is **not** required to run the player. Install the development dependencies only if
you want to run tests, lint, or the OpenSpec CLI (see the [developer guide](DEVELOPER_GUIDE.md)).

Typical output:

```text
Karaoke player running at http://localhost:3000
Press Ctrl+C to stop.
```

### Port and host

| Setting | Flag | Environment variable | Default |
| --- | --- | --- | --- |
| Port | `--port 8080` | `PORT=8080` | `3000` |
| Bind address | `--host 0.0.0.0` | `HOST=0.0.0.0` | `127.0.0.1` |

```bash
node serve.js --port 8080
PORT=8080 npm start

node serve.js --host 0.0.0.0
HOST=0.0.0.0 npm start
```

- A port must be an integer from 1 to 65535; anything else stops startup with an error.
- `--host` requires a value and accepts any interface name or address. `127.0.0.1`, `localhost`, and
  `::1` count as loopback.
- When binding to a non-loopback interface, the server prints:
  `Listening on <host>; other devices on your network can reach this player.`
- When binding to `0.0.0.0` or `::`, the printed URL still says `localhost`, because that is the
  address on the machine itself.

Stop the server with `Ctrl+C`. It runs in the foreground; there is no built-in daemon mode,
service installer, or restart-on-crash. For an always-on setup, run `node serve.js` under your
operating system's process manager.

## 3. Choose an exposure level

| Mode | Command | Who can reach it | Suitable for |
| --- | --- | --- | --- |
| Local (default) | `npm start` | Only this computer (`127.0.0.1`) | Normal single-machine use |
| LAN | `node serve.js --host 0.0.0.0` | Any device that can reach this computer's IP and port | A trusted home or party network |
| Internet | Not supported directly | — | Do not expose this server to the internet |

### Local operation

Everything stays on one machine. This keeps the app in a secure context (`http://localhost` counts
as secure) and lets Chrome or Edge remember the chosen folder between visits.

### LAN access

1. Start with `--host 0.0.0.0` (or `HOST=0.0.0.0`).
2. Allow the port through the operating system firewall if prompted.
3. Open `http://<this-computer-ip>:3000` from the other device.

Notes:

- **There is no authentication.** Anyone who can reach the address can open the player.
- Each device's browser loads **its own** local folder. A tablet reaching the server does not see
  the host's music library; it must open its own files, or you must copy the music to that device.
- A LAN address over plain HTTP is not a secure context, so the native folder picker is unavailable
  there. The player falls back to the browser's directory input, and the Reopen button asks for the
  folder again each visit. Use `https://` (for example through a TLS-terminating reverse proxy) if
  you need the picker on other devices.
- Treat the network as trusted. Prefer a private network, and do not port-forward this server.

### Internet exposure

The server is not designed for public hosting. It has:

- no authentication or accounts,
- no TLS, no rate limiting, and no request logging beyond console output,
- no protection against someone loading the app and using their own local files,
- no way to restrict who may read the static app files.

Do not publish it directly. If you must put it behind a reverse proxy, add TLS and access control at
the proxy, keep the upstream bound to loopback, and understand that the proxy protects the app
shell only — the app itself has no user model. Do not expose it on an untrusted network.

## 4. What the server actually does

`serve.js` is intentionally small. Its behavior is the contract in
[`openspec/specs/local-server/spec.md`](../openspec/specs/local-server/spec.md).

| Aspect | Behavior |
| --- | --- |
| Served files | `index.html` plus everything under `css/`, `js/`, and `assets/` |
| Not served | Everything else in the repository: `.git`, `node_modules`, `test/`, `docs/`, `package.json`, `serve.js` → `404` |
| Default route | `/` serves `index.html` |
| Methods | `GET` and `HEAD`; anything else → `405` with `Allow: GET, HEAD` |
| Path traversal | Resolved against the repository root; outside-root paths → `403`; malformed encoding → `400` |
| Content types | Fixed map for HTML, CSS, JS, JSON, SVG, PNG, JPEG, ICO, plain text, web manifest; unknown extensions → `application/octet-stream` |
| Caching | `cache-control: no-cache` (edits are picked up on reload) |
| Compression | None |
| Range requests | Not implemented |
| Authentication | None |
| Cookies or sessions | None |
| HTTPS | Not provided; terminate TLS in front of it if needed |

Because only the app shell is served, the server cannot leak your music, test files, documentation,
or Git metadata. Music is read by the browser directly from the folder each visitor selects.

### Health check

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/js/app.js
```

Both should return `200` with the expected `Content-Type`. A `404` for `/package.json` is correct.

## 5. Security checklist

- Keep the default loopback binding unless you specifically need LAN access.
- On a LAN, use a trusted network and do not forward the port from the internet.
- Prefer HTTPS for any non-localhost address; it also restores the native folder picker.
- Run Node as an unprivileged user and keep Node updated.
- Keep the repository free of secrets; the app needs none.
- Remember that file access is granted by each visitor's browser, is read-only, and can be revoked
  in the browser's site settings.
- Understand that the app makes no external requests: no CDNs, fonts, analytics, or APIs.

## 6. Data, backup, and recovery

The server is stateless. There is nothing server-side to back up except the code.

Each browser stores the following for the player's origin:

| Storage | Key or database | Contents |
| --- | --- | --- |
| `localStorage` | `pke.prefs.v1` | Volume, ReplayGain, lyric size and dimming, visual style, sensitivity, favourites, per-file audio-track choices |
| `localStorage` | `pke.session.v1` | Queue, current song, played history (last 200 entries) |
| `localStorage` | `pke.folder.v1` | Name and source mode of the last loaded folder |
| IndexedDB | `pke-files` / `handles` | File System Access handle for the remembered folder (Chromium-based browsers) |

Implications:

- **Back up your music files** as you normally would; they are the only irreplaceable data.
- Preferences and queues are per browser, per profile, and per address. Changing the port or host
  creates a different origin with empty saved state.
- Clearing site data for the address removes the queue, favourites, and preferences but never
  touches the music.
- To rebuild state, reopen the folder and rebuild the queue. Files that still exist restore their
  saved entries; missing ones are reported and removed after the scan.
- There is no export/import feature for the queue or preferences.

## 7. Updating

```bash
git pull
# restart the server process
```

There is no build step and no migration to run. Reload the page in each browser. Saved preferences
are versioned (`v1` keys) and read defensively; unknown or corrupt values fall back to defaults.
The package version lives in [`package.json`](../package.json).

## 8. Browser support and limits

| Capability | Chrome / Edge | Firefox | Safari | Notes |
| --- | --- | --- | --- | --- |
| Native folder picker and remembered folder | Yes | No | No | Requires a secure context |
| Directory input fallback | Yes | Yes | Yes | Reopen asks for the folder again |
| Add files and drag-and-drop | Yes | Yes | Yes | Works without the picker |
| Multi-track MP4 selector | No (API disabled) | No (API disabled) | Yes | Without the API the default track plays |
| Fullscreen | Yes | Yes | Yes | Expands the stage panel only |

Browser behavior outside Chromium/Edge has been exercised only for the paths recorded in the
historical QA report. Treat Firefox and Safari as supported for playback but not verified for every
control; see [troubleshooting](TROUBLESHOOTING.md) when something differs.

Operational limits:

- Scans run in the browser and read every candidate file; very large libraries take longer.
- Library rendering pages artist groups and search results; duration estimates are capped per pass.
- History is capped at 200 entries; per-file audio-track memory at 50 entries.
- No service worker: the app is not installable and does not work offline.

## 9. Maintenance

- **Logs:** startup lines and LAN warnings go to stdout; request errors are printed to stderr.
  There is no log file or rotation.
- **Monitoring:** no metrics endpoint. A periodic request to `/` is enough to confirm the process is
  alive.
- **Resource use:** the server is static and lightweight; CPU and memory cost comes from browsers
  scanning libraries, not from Node.
- **Multiple users:** each browser has an independent queue and library. There is no shared party
  queue, room, or sign-in.
- **Disk:** the app does not write to disk.

## 10. Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for symptoms such as the server not starting, the
folder picker not appearing, permissions being refused, and songs not being listed. Server-specific
checks are in the “Starting and serving” section there.

For the exact behavior contract, read [`openspec/specs/`](../openspec/specs/); for the design and
contribution workflow, read the [developer guide](DEVELOPER_GUIDE.md).
