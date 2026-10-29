# Upstream KaraokeEternal issue roadmap

## 1. Scope and methodology

- **Local repository:** `C:\Users\toman\repos\music\PerfectKaraokeEternal`
- **Upstream project and issue tracker:** <https://github.com/bhj/KaraokeEternal/issues>
- **Audit date:** 2026-10-28
- **Intended product scope:** a standalone, local MP3+G and MP4 karaoke player. The browser reads a music folder through the File System Access API (or a file picker), plays audio with a matching `.cdg`, supports zipped MP3+G and MP4 files, and keeps the queue, favourites and display preferences locally. There are no accounts, rooms, uploads or media server. `serve.js` is a static file server only.
- **Authoritative implementation:** the current working tree, including the pre-existing uncommitted simplification and audit work. `HEAD` (`9513de4`) is already the HTML/CSS/vanilla-JS rewrite; the working tree adds resilient scanning, audio-track support, ZIP improvements and tests. No commit was created.
- **Issue retrieval:** `gh` is not installed, so the GitHub REST API was used unauthenticated. `GET /repos/bhj/KaraokeEternal/issues?state=all&per_page=100&page=1` returned 92 items. Pull requests were excluded, leaving 54 issues: 9 open and 45 closed. The `open` list was rechecked on 2026-10-28 and matches the nine issues named in the task.
- **Discussion retrieval:** `GET /repos/bhj/KaraokeEternal/issues/comments` returned 226 comments and `GET /repos/bhj/KaraokeEternal/issues/events` returned 252 events. Close/reopen/reference events and comments were used as closure context.
- **Completeness:** the issue inventory is complete for the public tracker at audit time. Every issue number, title and upstream state in the table below comes from the API response. The audit did not modify, close or comment on any upstream issue.
- **Limitations:**
  - The API was unauthenticated; rate limits did not prevent retrieval, but per-issue timeline cross-references and some linked-PR details were not enumerated exhaustively. Where closure context was unavailable, the table says so rather than assuming the fix was correct.
  - Only Chromium was available for browser automation. Safari and Firefox behaviour, fullscreen in a headless browser, and the real File System Access folder picker on another Windows machine remain manual checks.
  - Playback was exercised with synthetic WAV+CDG fixtures (valid PCM audio and CD+G packet streams), not a large commercial karaoke collection. Real-media and long-track soak tests remain manual.

### Deliberately removed upstream architecture

The rewrite intentionally removed the Koa/React/SQLite server, accounts, rooms, QR joining, fairness scheduling, multi-folder libraries and server-side media scanning. Issues that depend on those systems are marked `NOT_APPLICABLE` rather than recreated. The local equivalents are a single browser library, a single shared queue, local favourites and preferences, and a static Node file server.

## 2. Executive summary

| Metric | Count |
| --- | ---: |
| Total upstream issues reviewed | 54 |
| Open upstream issues | 9 |
| Closed upstream issues | 45 |
| Upstream issues classified `REGRESSION` | 0 |
| Separate local regressions found and fixed | 2 |
| Upstream issues classified `BUG` | 1 |
| Upstream issues classified `IMPLEMENT` | 0 |
| Upstream issues classified `PARTIAL` | 6 |
| Upstream issues classified `ALREADY_SUPPORTED` | 9 |
| Upstream issues classified `NOT_APPLICABLE` | 31 |
| Upstream issues classified `DEFERRED` | 6 |
| Upstream issues classified `UNVERIFIED` | 1 |

Classification counts sum to 54. Priorities are P1: 1, P2: 10, P3: 43.

Local status counts are `FIXED`: 1, `TEST ADDED`: 3, `VERIFIED`: 6, `IN PROGRESS`: 1, `NEEDS INVESTIGATION`: 1, `DEFERRED`: 11, `OUT OF SCOPE`: 31; these sum to 54.

**What changed locally:**

- **Two upstream issues are fully resolved:** #91 (scan failures now produce warnings and do not abort the scan) and #44 (ZIP support is complete, including multi-song and deflated archives). #53 is verified and test-backed.
- **One is partially resolved:** #79 has a working audio-track selector in browsers that implement `HTMLMediaElement.audioTracks` (Safari). Chromium and Firefox currently disable the API, so the selector is hidden and they play the default track; this is a browser limitation, not a missing code path.
- **Two local regressions were found and fixed:** the rewrite painted the CD+G background opaque after the first changed frame, hiding the visualizer and making the background-opacity control ineffective for media whose background colour is not already the transparent key; the working tree also blocked duplicate queue entries, although upstream explicitly decided that duplicates should remain allowed for valid cases. Both regressions are detailed in section 4.
- **Additional correctness fixes:** multi-song ZIP entries now use their folder as an artist fallback instead of every track inheriting the archive title; “Play now” removes one matching upcoming entry so it cannot play twice, without consuming other duplicate entries; audio tracks with empty ids get stable index-based ids; folder-scan warnings no longer end with a slash.
- **Verified already-working behaviour:** queue reordering and visible queue controls, duplicate queue entries with a confirmation toast on every add, previous/restart, manual queue management, Windows drive selection via the folder picker, and Hebrew `Artist - Title` parsing.

## 3. Complete issue inventory

Every upstream issue appears exactly once. “Upstream state” is the state on 2026-10-28; “Local status” is independent of it. Links point to the original GitHub issue.

| Issue | Title | Upstream state | Classification | Priority | Local status | Evidence / rationale |
| --- | --- | --- | --- | --- | --- | --- |
| [#11](https://github.com/bhj/KaraokeEternal/issues/11) | How to contact you ? | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Contact request only; resolved by the maintainer by email. No product behavior. |
| [#12](https://github.com/bhj/KaraokeEternal/issues/12) | logo contribution | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Brand/logo contribution for the upstream project; this app has its own icon and identity. |
| [#13](https://github.com/bhj/KaraokeEternal/issues/13) | The Road to v1.0 | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Meta checklist for the server/React v1 release. ReplayGain, drag-drop queueing and ZIP support exist locally; account, room and server items are outside the standalone scope. |
| [#14](https://github.com/bhj/KaraokeEternal/issues/14) | Error when trying to scan media folders | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Upstream npm music-metadata dependency failure. This fork has no runtime dependencies; scanner resilience is covered by #91. |
| [#16](https://github.com/bhj/KaraokeEternal/issues/16) | Daemonize | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Daemon/service setup for the hosted Node server; the local static server is started manually. |
| [#17](https://github.com/bhj/KaraokeEternal/issues/17) | Scanning media freezes | closed | ALREADY_SUPPORTED | P2 | TEST ADDED | Historical server freeze on corrupt media. Local scanning contains per-file errors and continues; a corrupt-archive regression test was added. |
| [#20](https://github.com/bhj/KaraokeEternal/issues/20) | Big suggestion: record and stream live audio to server, and do audio mixing and de-reverberation on the server | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Server-side microphone capture, mixing and streaming; outside a local file player. |
| [#23](https://github.com/bhj/KaraokeEternal/issues/23) | [Feature Request] Add ability to re-order queued songs | closed | ALREADY_SUPPORTED | P2 | VERIFIED | Queue reordering is available through drag-and-drop and up/down controls; verified in the browser. |
| [#24](https://github.com/bhj/KaraokeEternal/issues/24) | reverse proxy | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Reverse-proxy deployment advice for the hosted server; the local static app has no proxy requirement. |
| [#25](https://github.com/bhj/KaraokeEternal/issues/25) | [Feature Request] Song Score | open | DEFERRED | P3 | DEFERRED | Vocal scoring needs microphone input and reliable pitch/note data that MP3+G and ordinary MP4 do not contain. No scope-compatible method without inventing scoring. |
| [#26](https://github.com/bhj/KaraokeEternal/issues/26) | Reset Server? | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Resetting the upstream server database; the local app has no accounts or database. |
| [#27](https://github.com/bhj/KaraokeEternal/issues/27) | [Feature Request] Allow option to refresh specific media folder | closed | PARTIAL | P3 | DEFERRED | Any selected folder can be rescanned, but the app holds one library at a time and has no per-folder priority or refresh. Multi-folder support is a larger library model. |
| [#29](https://github.com/bhj/KaraokeEternal/issues/29) | [Feature Request] Docker Container Implementation | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Docker packaging for the upstream Node/React server; this fork is static files plus a tiny Node static server. |
| [#30](https://github.com/bhj/KaraokeEternal/issues/30) | Just for Song Book Purposes | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Song-book style collection through rooms and accounts; the local queue is single-session. |
| [#31](https://github.com/bhj/KaraokeEternal/issues/31) | [Feature Request] - Song Ratings | closed | DEFERRED | P3 | DEFERRED | Crowd or tag-based song ratings require tagging, multi-user data and third-party metadata; not part of a local single-user player. |
| [#32](https://github.com/bhj/KaraokeEternal/issues/32) | [FEATURE REQUEST] - QR Code to load app on mobile devices | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | QR joining requires server-hosted rooms and mobile clients. |
| [#33](https://github.com/bhj/KaraokeEternal/issues/33) | Node.appendChild: Argument 1 is not an object | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Crash in the removed React client dependency react-github-btn. |
| [#40](https://github.com/bhj/KaraokeEternal/issues/40) | Duplicate Songs | closed | ALREADY_SUPPORTED | P2 | VERIFIED | Queueing shows a confirmation toast, and duplicate entries remain allowed; the upstream maintainer explicitly preferred that over blocking valid duplicates. Browser-verified. |
| [#41](https://github.com/bhj/KaraokeEternal/issues/41) | Order change last second | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Fairness and locking of the next slot are multi-user server queue concepts; local queue order is explicit and stable. |
| [#42](https://github.com/bhj/KaraokeEternal/issues/42) | Format preference | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Preferred media version relies on song grouping and media-folder priority, which the local library intentionally does not model. |
| [#43](https://github.com/bhj/KaraokeEternal/issues/43) | Web Push Notifications API | open | DEFERRED | P3 | DEFERRED | Web Push needs a service worker, push service and permission model. A local tab has no hosting or notification use case. |
| [#44](https://github.com/bhj/KaraokeEternal/issues/44) | [Feature Request] Can we get zip support? | closed | ALREADY_SUPPORTED | P2 | TEST ADDED | Stored and deflated ZIPs, multiple songs per archive and mismatched single pairs are supported and covered by regression tests. |
| [#45](https://github.com/bhj/KaraokeEternal/issues/45) | [Enhancement/Feature Request] Ability to Pitch-Shift A Song (Both at User and System Levels) | open | DEFERRED | P3 | DEFERRED | Pitch shifting without tempo change needs a quality DSP phase-vocoder dependency or a native API. No browser-native option; introducing one needs listening tests first. |
| [#46](https://github.com/bhj/KaraokeEternal/issues/46) | [Feature Request] Provide Users With a "Sing" or "Start" and "Skip" Button | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Per-singer Sing/Skip and rotation belong to the room/account model. The local transport already has play and skip controls for the current track. |
| [#47](https://github.com/bhj/KaraokeEternal/issues/47) | NGINX Reverse proxy with subfolder | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Subfolder reverse-proxy configuration for the upstream server; the local static server has no URL-path feature. |
| [#48](https://github.com/bhj/KaraokeEternal/issues/48) | [Windows] NPM Build Error | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Windows webpack/license-plugin failure in the removed React build chain. There is no build step now; Windows paths are normalized on scan. |
| [#49](https://github.com/bhj/KaraokeEternal/issues/49) | Queue Enhancements | closed | PARTIAL | P3 | DEFERRED | Clear-queue and a queue view are implemented; a separate queue display or player overlay is not. |
| [#50](https://github.com/bhj/KaraokeEternal/issues/50) | Few Great feature missing | closed | PARTIAL | P3 | DEFERRED | Replay exists through the queue-complete button and history restart; left/right channel toggling is not implemented and overlaps the audio-track work in #79. |
| [#51](https://github.com/bhj/KaraokeEternal/issues/51) | [Feature Request] Video or image/slideshow backgrounds | open | DEFERRED | P3 | DEFERRED | Custom video/image backgrounds need a persisted media source, layering and file-permission design; the current visualizer is deliberately lightweight. |
| [#53](https://github.com/bhj/KaraokeEternal/issues/53) | Metadata parsing / file format parsing does not work for Hebrew | closed | ALREADY_SUPPORTED | P2 | TEST ADDED | Hebrew Artist - Title names parse correctly and an RTL regression fixture was added. Configurable title-first parsing is still not supported. |
| [#54](https://github.com/bhj/KaraokeEternal/issues/54) | Control brightness of player background | closed | PARTIAL | P3 | DEFERRED | CDG background alpha and a visualizer toggle exist; there is no separate visualizer brightness control. |
| [#55](https://github.com/bhj/KaraokeEternal/issues/55) | Text background doesn't match text | closed | UNVERIFIED | P2 | NEEDS INVESTIGATION | The original report was a browser-specific backdrop-filter mismatch and was never confirmed. The rewrite recomputes content bounds per frame and tests them, but no reproduction of the reported visual bug is available. |
| [#56](https://github.com/bhj/KaraokeEternal/issues/56) | Better way to get queue options for desktop. | closed | ALREADY_SUPPORTED | P3 | VERIFIED | Queue rows expose visible play, move and remove buttons plus drag handles on desktop; no swipe-only interaction. |
| [#58](https://github.com/bhj/KaraokeEternal/issues/58) | [Feedback Wanted] User permissions | open | NOT_APPLICABLE | P3 | OUT OF SCOPE | Role-based permissions require accounts, rooms and server authorization. |
| [#59](https://github.com/bhj/KaraokeEternal/issues/59) | [Feature Request] Android/Google/Apple TV App Frontend | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Native TV frontends are outside the browser-only local scope. |
| [#60](https://github.com/bhj/KaraokeEternal/issues/60) | Enhancement - Allow user to select preferred version of a track | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Per-user preferred media versions require song/media grouping and user accounts. |
| [#61](https://github.com/bhj/KaraokeEternal/issues/61) | Prev Playing for admin | closed | ALREADY_SUPPORTED | P2 | VERIFIED | Previous restarts the current song after three seconds and history can restart the queue from a played song; browser-verified. |
| [#62](https://github.com/bhj/KaraokeEternal/issues/62) | [Feature Request] Manual Queue Management | closed | ALREADY_SUPPORTED | P2 | VERIFIED | Manual queue control exists through drag-and-drop, move buttons, play now and clear queue; browser-verified. |
| [#63](https://github.com/bhj/KaraokeEternal/issues/63) | [Feature Request] Manual User Management | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Admin user impersonation requires accounts and sessions. |
| [#64](https://github.com/bhj/KaraokeEternal/issues/64) | [Bug] Multiple player windows open causes at least one to fail | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Synchronized multiple player windows require the room/server architecture that was intentionally removed. |
| [#65](https://github.com/bhj/KaraokeEternal/issues/65) | Trouble with the player (never shown) | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Admin-only player access was an upstream authorization rule; the local app has no accounts. |
| [#69](https://github.com/bhj/KaraokeEternal/issues/69) | [Feature Request] "Roll up" artist names to the first artist when there are multiple artists in the track name | closed | DEFERRED | P3 | DEFERRED | Rolling multi-artist names up to a primary artist needs a configurable artist model; current grouping uses the full artist string and a naive split risks wrong grouping. |
| [#70](https://github.com/bhj/KaraokeEternal/issues/70) | Feature Req: Casual user mode | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Casual or guest accounts are account-system features; the local app has no sign-in. |
| [#71](https://github.com/bhj/KaraokeEternal/issues/71) | Investigate alternative for listing drives on Windows | closed | ALREADY_SUPPORTED | P2 | VERIFIED | The wmic-based drive enumeration is gone; the File System Access folder picker lists drives natively. |
| [#73](https://github.com/bhj/KaraokeEternal/issues/73) | Feature Request - More admin function | closed | PARTIAL | P3 | DEFERRED | Clear, reorder and remove are implemented; manual user/song entry and multi-user admin controls are not. |
| [#74](https://github.com/bhj/KaraokeEternal/issues/74) | Feature request: Github Actions to auto release the latest Docker image | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Docker release automation is deployment infrastructure for the upstream server. |
| [#75](https://github.com/bhj/KaraokeEternal/issues/75) | QR Code | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Duplicate of #32; QR joining is not applicable. |
| [#77](https://github.com/bhj/KaraokeEternal/issues/77) | [Feature Request] Kodi Add-on | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | A Kodi add-on needs a server API; outside the browser-only local scope. |
| [#79](https://github.com/bhj/KaraokeEternal/issues/79) | Add Audio Track Switching in Player Interface | open | PARTIAL | P2 | IN PROGRESS | Audio-track selection is implemented through HTMLMediaElement.audioTracks, including empty-id fallback and per-song memory. Chromium and Firefox ship the API disabled (verified false in Chromium); Safari is the supported browser. |
| [#87](https://github.com/bhj/KaraokeEternal/issues/87) | Login Screen | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Room password and login recovery are account/room features. |
| [#88](https://github.com/bhj/KaraokeEternal/issues/88) | Right way to use KE | closed | NOT_APPLICABLE | P3 | OUT OF SCOPE | Guidance for the hosted room workflow; the local app has no login or rooms. |
| [#91](https://github.com/bhj/KaraokeEternal/issues/91) | Scan media files issue | open | BUG | P1 | FIXED | The scanner now contains failures per file and folder, reports them as warnings, and continues. Corrupt ZIP and unreadable-entry regression tests were added and the warning UI was browser-checked. |
| [#93](https://github.com/bhj/KaraokeEternal/issues/93) | [Feature Request] Accepting authentication headers from a service like Authelia | open | NOT_APPLICABLE | P3 | OUT OF SCOPE | Trusted reverse-proxy identity headers require a server identity layer, accounts and authorization. |
| [#96](https://github.com/bhj/KaraokeEternal/issues/96) | [Feature request] YouTube search and song download (admin-only) | open | NOT_APPLICABLE | P3 | OUT OF SCOPE | YouTube search and download need network access, a downloader, API/ToS review and copyright controls. A local file player must not scrape or download unauthorized media. |

## 4. Regression findings

### R1 — CD+G background painted over the visualizer (P1, fixed)

- **Expected behaviour:** the CD+G background is keyed transparent on every rendered frame, exactly as the pre-rewrite `CDGPlayer` did with `cdg.render(time, { forceKey: true })`. The stage visualizer and the user-selected background opacity remain visible; only the lyric content gets the translucent backdrop.
- **Actual behaviour before the fix:** the first frame was keyed, but every later frame was rendered with `forceKey: false`. Once a CDG packet changed the background colour, the 300×216 canvas was painted opaque above the visualizer (`z-index: 2` versus `z-index: 1`). For any stream whose background colour was not already the transparent key, the visualizer disappeared and the backdrop-opacity control had no visible effect.
- **Root cause:** `js/player.js` called `renderFrame(false)` from `startLoop()`, while the upstream player forced the key on every animation frame. `CDGDecoder` supported `forceKey`; the caller stopped passing it.
- **Files changed:** `js/player.js`, `test/cdg.test.js`.
- **Regression test:** `CDGDecoder keys out the background for the visualizer when requested` builds a CD+G stream whose background colour differs from its transparent key and asserts the normal render is opaque while the keyed render is transparent. The browser check independently sampled the player canvas: background pixel alpha `0`, lyric-band pixel opaque, visualizer had 239,026 non-transparent pixels while playing.
- **Result:** fixed; unit test passes and manual browser verification passes.

This regression was not filed as an upstream issue; it was introduced by the local rewrite. The closest upstream discussions are #54 (background brightness) and #55 (backdrop bounds).

### R2 — Duplicate queue entries were blocked (P2, fixed)

- **Expected behaviour:** queueing the same song twice is allowed, as it was at `HEAD` and as upstream explicitly decided in #40 (“I'm not in favor of preventing duplicate songs in the queue since there can be valid cases for that”). Each add should show clear feedback.
- **Actual behaviour before the fix:** a second tap on an upcoming song was ignored with an “already in the queue” toast, removing a legitimate workflow. The added comment also claimed, incorrectly, that upstream behaved the same way.
- **Root cause:** an `if (state.queue.includes(id)) return` guard in `queueTrack()` and a related over-broad queue removal in the working tree. `playQueueItem()` removed its selected entry and then `playNow()` removed another entry with the same id, so with duplicates allowed a different queued copy could disappear.
- **Files changed:** `js/app.js`.
- **Verification:** with a duplicate queued, both entries remain and each add shows a toast; playing a queue row removes only that row, leaving the other copy queued; library “Play now” still consumes exactly one matching entry.
- **Result:** fixed; browser-verified. No unit test was added because queue state lives in the DOM module; the behaviour is recorded in section 7.

### D1 — Multi-song ZIPs inherited the archive title (P2, fixed)

- **Expected:** each audio+`.cdg` pair in a multi-song archive becomes one track with its own parsed artist and title.
- **Actual before the fix:** every pair without its own `Artist - Title` delimiter fell back to the archive name, so an archive named `Artist - Karaoke Album.zip` produced several tracks all titled “Karaoke Album” (and the in-progress test failed).
- **Root cause:** `parseOrWarn` only accepted the entry base name and the archive name; it had no folder fallback for archives organised as `Folder/Song.mp3`.
- **Files changed:** `js/library.js`, `test/library.test.js`.
- **Test:** the multi-song archive test now asserts two distinct titles and ids; deflated archives and corrupt archives have additional tests.
- **Result:** fixed; 44 tests pass.

### D2 — “Play now” left the song queued (P2, fixed)

- **Expected:** choosing “Play now” for an upcoming song starts it immediately and removes that entry from the upcoming queue, so it does not play a second time later.
- **Actual before the fix:** the song started but stayed in the queue; when the queue reached it, it played again.
- **Root cause:** `playNow()` in `js/app.js` changed the current track without consuming the matching queue entry. `playQueueItem()` removed its item separately, so only library “Play now” was affected.
- **Files changed:** `js/app.js`.
- **Verification:** queue `[Sync, Next]`, “Play now” on Sync → queue `[Next]`, current Sync, audio playing.
- **Result:** fixed; browser-verified. No unit test was added because the queue state lives in the DOM module; the behaviour is recorded in the verification section.

### D3 — Audio tracks with empty ids could not be selected (P2, fixed)

- **Expected:** an `AudioTrack` without an id can still be identified and enabled.
- **Actual before the fix:** `String(track.id ?? i)` produced `''` for every track with an empty id, so all options shared the same value and selecting any of them enabled the first track.
- **Root cause:** empty string was treated as a valid id instead of falling back to the index.
- **Files changed:** `js/audio-tracks.js`, `test/audio-tracks.test.js`.
- **Test:** `listAudioTracks falls back to stable indexes for empty ids` asserts ids `['0', '1']` and that enabling `'0'` switches the first track.
- **Result:** fixed; tests pass.

### Other test-only corrections

- `collectDirectoryRecords` warning paths no longer retain the trailing slash for an unreadable folder (`Broken Folder/` → `Broken Folder`), matching the user-facing path.
- The in-progress test file had a generator-spacing lint error and `js/library.js` lacked a final newline; both are fixed.
- Existing tests were not weakened or skipped. The suite grew from 40 to 44 tests.

## 5. Remaining open issues

There are nine open upstream issues. Each is listed here with the user problem, scope decision, current state and a concrete acceptance test.

### #91 — Scan media files issue (P1, BUG, FIXED)

- **User problem:** one corrupt or unreadable media file aborts or restarts a scan, and the user cannot tell which file caused it.
- **Fit:** yes. Library discovery is core to the local player, and the browser scan must report failures without losing the rest of the folder.
- **Current state:** `collectDirectoryRecords()` catches errors from reading folders and individual files; `buildLibrary()` catches malformed archives per record and returns warnings. The UI lists each skipped path/reason. Corrupt ZIP and unreadable-entry tests pass; the warning UI was checked in Chromium (`0 songs loaded · 2 skipped`).
- **Next steps:** run a large real folder (the upstream report used a very large library) and confirm the warnings list stays usable. No code change is currently planned.
- **Acceptance criteria:** a folder containing one corrupt archive, one audio file without `.cdg` and valid pairs still loads the valid pairs; each failure appears once in the warning list; the scan does not restart or abort.
- **Dependencies/risks:** the browser cannot delete or quarantine local files, so the local alternative is reporting rather than mutation. A huge warning list may need virtualisation later.

### #79 — Add Audio Track Switching in Player Interface (P2, PARTIAL, IN PROGRESS)

- **User problem:** a multi-track MP4 may contain vocal and instrumental tracks; the singer wants to switch without reloading the song.
- **Fit:** yes for MP4 playback, but only where the browser exposes the native audio-track API.
- **Current state:** `js/audio-tracks.js` enumerates tracks, describes labels/languages, enables exactly one track, assigns stable fallback ids, and `js/app.js` remembers the last selected track per media file (bounded to 50 entries). The selector appears only when at least two tracks are exposed.
- **Browser evidence:** `'audioTracks' in document.createElement('video')` is `false` in the Chromium build used for this audit. MDN/caniuse report the API as limited availability, supported by Safari and disabled by default in Chromium/Firefox. The selector therefore cannot work in the README’s recommended Chromium browsers today.
- **Next steps:** validate on Safari with a real MP4 containing two labelled audio tracks; confirm switching during playback, memory across reload and cleanup on track change. Keep the selector hidden when the API is unavailable.
- **Acceptance criteria:** Safari shows a two-option selector; switching changes the audible track without changing playback position; the selection is restored for that file; Chromium/Firefox still play the default track with no broken control.
- **Dependencies/risks:** the native API is non-standard and may change. A Chromium fallback would require MP4 demuxing/WebCodecs or server transcoding and is not justified for the simplified app.

### #51 — Video or image/slideshow backgrounds (P3, DEFERRED)

- **User problem:** replace the spectrum visualizer with a prepared video, image or slideshow.
- **Fit:** potentially, but it expands the media model and persistence.
- **Current state:** the app has a lightweight spectrum visualizer and a CDG background-opacity control, not a user-supplied background.
- **Next steps:** design a file-handle/object-URL lifetime model, an opt-in background picker and a readability rule for CDG lyrics; prototype with one image and one video.
- **Acceptance criteria:** a user can choose an image/video; it persists across reload only with permission; CDG text remains legible; turning it off restores the visualizer; no playback or sync regression.
- **Dependencies/risks:** File System Access permission, object-URL cleanup, video decoding cost, and interaction with the CDG backdrop. Not worth the complexity without a demonstrated need.

### #45 — Pitch shifting (P3, DEFERRED)

- **User problem:** older karaoke tracks may be off-pitch, and singers want to transpose to their range without changing tempo.
- **Fit:** conceptually yes; technically not with native browser APIs alone.
- **Current state:** no pitch-shift implementation. `playbackRate` changes speed and pitch together, so it is not a substitute.
- **Next steps:** evaluate a WebAudio phase-vocoder implementation (for example the approach referenced upstream) in isolation; measure artefacts, latency and CPU before adding any dependency.
- **Acceptance criteria:** ±N semitones without tempo drift or CDG/audio desync; acceptable vocal quality on real tracks; no large dependency until the prototype and listening tests pass.
- **Dependencies/risks:** DSP quality, CPU on low-end devices, and the project’s no-unnecessary-dependency rule. Deferred rather than adding a fragile effect.

### #43 — Web Push Notifications API (P3, DEFERRED)

- **User problem:** singers wander away and want a notification before their turn.
- **Fit:** low. The local app is used at the player; there is no room membership or remote singer identity.
- **Current state:** no service worker, no push subscription, no hosting component.
- **Next steps:** only if a hosted/notification use case is added; a simpler in-tab notification when the tab is backgrounded could be evaluated first.
- **Acceptance criteria:** permission is requested only after a gesture; a notification arrives before the queued turn; no notification when the app is closed without a push service; opt-out is respected.
- **Dependencies/risks:** service worker, push service, VAPID keys, HTTPS hosting, permission denial and browser throttling. Out of scope for the standalone file player.

### #25 — Song Score (P3, DEFERRED)

- **User problem:** score a performance after the song.
- **Fit:** no, not without changing the product into a microphone/analysis app.
- **Current state:** MP3+G carries audio and CD+G graphics, not pitch/note data. Ordinary MP4 karaoke files do not carry scoring metadata either. The upstream discussion reached the same conclusion (SingStar-style note data or human voting are required).
- **Next steps:** none unless microphone capture and a scoring data model become an explicit product goal. A human “clap”/star vote would be a separate, simpler feature, but it needs multi-user identity.
- **Acceptance criteria:** if revisited, microphone permission, pitch estimation, latency calibration and a transparent scoring explanation are mandatory; never show a random score as if it were measured.
- **Dependencies/risks:** microphone access, DSP, privacy, fairness and scope expansion. Deferred.

### #58 — User permissions (P3, NOT_APPLICABLE)

- **User problem:** a role between standard user and admin for running rooms.
- **Fit:** no. The local app has no accounts, rooms or server-side authorization.
- **Current state:** absent by design; all local controls are available to the person at the browser.
- **Next steps:** only with a hosted multi-user architecture, which would reverse the simplification.
- **Acceptance criteria (if ever hosted):** least-privilege roles, server-side enforcement, audit logging and tests for every protected route.
- **Dependencies/risks:** identity, sessions, database and authorization. Out of scope.

### #93 — Accepting authentication headers from Authelia (P3, NOT_APPLICABLE)

- **User problem:** use a reverse proxy’s identity headers to sign in.
- **Fit:** no. There is no login or server identity layer.
- **Current state:** the static server serves files only; it does not authenticate or read identity headers.
- **Next steps:** a future hosted variant would need trusted-proxy configuration, header allowlisting, shared-secret verification, account mapping and local-login fallback.
- **Acceptance criteria:** headers are accepted only from configured proxies; spoofed headers are rejected; users are mapped by a stable identity; admin mapping is explicit; local login remains available.
- **Dependencies/risks:** security-sensitive header trust, account storage and authorization. Out of scope.

### #96 — YouTube search and song download (P3, NOT_APPLICABLE)

- **User problem:** find and download karaoke media from inside the app.
- **Fit:** no. The app deliberately reads local files and has no downloader, network service or write access to the library.
- **Current state:** absent by design.
- **Next steps:** none for this app. A user who has the rights to a media file should obtain it through an authorised source and add it to the folder. Any future integration would need official APIs, explicit ToS/copyright review, admin-only controls and safe file naming.
- **Acceptance criteria (if ever considered):** lawful API use, no DRM circumvention, no scraping, explicit admin opt-in, download sandboxing and user-visible provenance.
- **Dependencies/risks:** legal/ToS compliance, network access, yt-dlp/ffmpeg distribution and security. Out of scope.

## 6. Implementation roadmap

Ordered by value, risk and cost rather than upstream issue age.

### Phase 0 — Critical regressions and correctness (complete)

| Task | Issue | Status | Evidence |
| --- | --- | --- | --- |
| Key the CD+G background on every frame | Local regression R1 | Done | Decoder test plus browser pixel check |
| Continue scanning after corrupt/unreadable files | #91 | Done | Corrupt-ZIP test, unreadable-entry test, warning UI check |
| Parse each song in multi-song ZIPs with a folder fallback | #44 / D1 | Done | Multi-song and deflated-ZIP tests |
| Consume exactly one queue entry when using “Play now” | Local D2 | Done | Browser check |
| Allow duplicate queue entries again and keep toast feedback | Local R2 / #40 | Done | Browser check |
| Stable ids for audio tracks without ids | #79 / D3 | Done | Audio-track test |
| Fix baseline test and lint failures | — | Done | 44 tests pass, lint clean |

### Phase 1 — Core usability and verification (next)

1. **Investigate #55 with real CD+G media** (P2). Reproduce in Chromium and Firefox with the same file; compare `contentBounds` and the backdrop rectangle across pause, seek and resize. Acceptance: either a reproducible mismatch is fixed with a regression test, or the browser limitation is documented with evidence. Risk: the original report was never confirmed and may be a browser paint bug.
2. **Run a browser playback matrix** (P2). Chrome/Edge, Firefox and Safari; open a folder, load MP3+G, pause/resume, seek backwards, let a track end, repeat the same track, and leave a long track playing. Acceptance: no console errors, no stale lyrics after seek, no growing blob URLs, audio remains the timing source. Current automated evidence is Chromium only.
3. **Validate #79 on Safari** (P2). Use a real MP4 with two labelled audio tracks. Acceptance criteria are in section 5. If Safari also hides the tracks for the test file, document the exact container/track requirement and keep the selector hidden.
4. **Consider static-server hardening** (P3, engineering follow-up). The server currently serves the repository root, including `.git`, tests and `node_modules`, and binds to all interfaces. A future change could restrict serving to `index.html`, `css/`, `js/` and `assets/`, and add an explicit `--host` option. Acceptance: those paths return 404, while the app and assets still load; LAN use remains an explicit opt-in. This is not an upstream issue and is not required for local single-user use.

### Phase 2 — Worthwhile features consistent with scope

1. **#51 custom backgrounds** (P3): prototype image only first; require readability and cleanup tests before video/slideshow support.
2. **#45 pitch shifting** (P3): isolate the DSP prototype and listening tests before any dependency decision.
3. **#27 multi-folder library model** (P3): only if users need more than one folder at once; would require replacing the one-library-at-a-time scan model and adding explicit priorities.
4. **#69 artist roll-up** (P3): add a configurable primary-artist rule only after defining how multi-artist names should group; do not guess.
5. **#50 channel toggle** (P3): evaluate only alongside #79; stereo channel switching is not a general multi-track solution.

### Phase 3 — Deferred or out of scope

- **#25 scoring** and **#43 push notifications** require microphone/analysis or push hosting; keep deferred.
- **#58 permissions**, **#93 proxy auth**, **#96 YouTube download** and the other server/account/room issues would require the removed multi-user server architecture. Do not reintroduce it for a local player.
- **#51**, **#45** and **#27** remain documented opportunities, not commitments. Each has explicit acceptance criteria above so a future decision is testable.

## 7. Verification

### Commands executed

```text
npm test
  -> 44 tests, 44 pass, 0 fail

npm run lint
  -> exit 0

node serve.js --port 4173
  -> "Karaoke player running at http://localhost:4173"
curl http://127.0.0.1:4173/                 -> 200 text/html
curl http://127.0.0.1:4173/js/player.js     -> 200 text/javascript
curl -I <fixture>                            -> 200
```

### Browser checks (Chromium, Windows)

Synthetic fixtures were generated under `node_modules/.audit/fixtures/` (ignored by Git): an 8-second mono WAV+CDG pair and a 3-second pair, plus a corrupt ZIP and an audio file without `.cdg`. They were dropped into the running app through its normal drag-and-drop handler.

- **Library discovery:** 2 tracks from 2 pairs; no warnings. `audioTracksSupported: false` in Chromium.
- **Playback:** audio duration 8s, current time advanced, stage mode `cdg`, message hidden.
- **CD+G render:** white lyric band at 2.18s `[255,255,255,255]`; background `[0,0,0,0]`; backdrop `rgba(0,0,255,0.5)`; visualizer had 239,026 non-transparent pixels.
- **Seek forward:** at ~7.0s the band was magenta `[255,0,255,255]` and the border green `[0,255,0,255]`.
- **Seek backward:** at ~2.5s the band was white again and the border was transparent (no stale graphics).
- **Auto-advance:** seeking the first track to ~7.5s advanced to the 3-second second track; queue count 0, history 1, current card “Next”, yellow band `[255,255,0,255]`, background transparent, visualizer 238,581 pixels.
- **Pause/resume:** paused time stayed fixed; resume advanced it.
- **Queue:** tapping an upcoming song twice left both entries in the queue and showed “Queued: Sync” each time; playing one duplicate queue row removed only that row; moving the first item down changed up-next from Sync to Next.
- **Play now:** with queue `[Sync, Next]`, playing Sync now left queue `[Next]`.
- **Scan resilience UI:** dropping a corrupt ZIP and an audio file without `.cdg` produced “2 files skipped during the scan”, with both paths/reasons, and did not abort.
- **Responsive layout:** at 480×800 the document width was 463px, no horizontal overflow; transport and search remained visible.
- **Console/network:** no application errors or failed app-asset requests. The only console messages were Canvas2D readback warnings caused by the test’s own `getImageData` sampling.

### Checks not completed

- **Fullscreen:** the headless Chromium session did not enter fullscreen when the button was clicked (`document.fullscreenElement` stayed null). The implementation uses the standard `requestFullscreen`/`exitFullscreen` API with error handling; verify in a normal desktop browser.
- **Safari audio-track switching:** no Safari environment was available. The Chromium API-absence result is recorded, but #79 remains partial until a real Safari multi-track MP4 test.
- **Firefox:** not available in this environment.
- **Real commercial karaoke library and very long tracks:** not available; synthetic CD+G/audio fixtures were used. Run a long-track resource/seek soak manually.
- **Actual File System Access permission prompt and Windows drive picker:** the browser checks used drag-and-drop, not `showDirectoryPicker`; verify the permission/reopen flow on the target Windows machine.

### Working-tree preservation

The audit preserved the pre-existing uncommitted changes in `css/app.css`, `index.html`, `js/app.js`, `js/library.js`, `js/player.js`, `serve.js`, `js/audio-tracks.js`, the test fixtures and tests. No `git reset`, stash, checkout, commit or upstream write was performed. The only new deliverable outside the existing modified/untracked set is this document and the README/CHANGELOG notes.
