# PerfectKaraokeEternal troubleshooting

Find your symptom below. Each entry says what you see, the likely cause, and what to do. When a
problem is caused by a browser capability rather than the player, it is called out as a browser
limitation.

- [Starting and serving](#starting-and-serving)
- [Opening a folder](#opening-a-folder)
- [Library contents](#library-contents)
- [Playback and audio](#playback-and-audio)
- [Lyrics, visuals, and layout](#lyrics-visuals-and-layout)
- [Queue and saved state](#queue-and-saved-state)

## Starting and serving

### The page does not load (“can't reach this site”)

**You see:** the browser cannot connect to `localhost:3000`.

**Likely causes:** the server is not running, it is on another port, or it is bound to a different
interface.

**Fix:**

1. Check the terminal for `Karaoke player running at …`.
2. Start it with `npm start` or `node serve.js`.
3. Use the port shown; pass `--port` or `PORT` if 3000 is taken.
4. If you opened the page from another device, the server must be started with `--host 0.0.0.0`,
   and the address must be this computer's LAN IP.

### Startup fails with `EADDRINUSE`

**Cause:** another process already uses the port.

**Fix:** stop the other process or start on another port:

```bash
npm start -- --port 8080
```

### Startup fails with `Invalid port`

**Cause:** `--port` or `PORT` was not an integer from 1 to 65535.

**Fix:** provide a valid port, for example `--port 3000`.

### The page is blank and the console mentions modules

**Cause:** `index.html` was opened from disk (`file://`). Browsers refuse to load ES modules that
way.

**Fix:** serve the app over HTTP (`npm start`) and open `http://localhost:3000`.

### The page loads but styles or scripts are missing

**Cause:** the request did not match the server's allowlist, or an old server process is still
running after files changed.

**Fix:** restart the server and reload. Only `index.html`, `css/`, `js/`, and `assets/` are served;
requests for other paths correctly return 404.

## Opening a folder

### “Open music folder” opens a file browser instead of the system folder picker

**You see:** a browser directory-selection dialog, not the native folder picker.

**Cause:** the native picker is used only when the browser exposes `showDirectoryPicker`, the page
is a secure context, and the browser is not an embedded Electron shell. Firefox, Safari, embedded
browsers, and non-secure addresses fall back to the directory input.

**Fix:** none required — the fallback still loads the folder. Hover the button to read the reason.
For the native picker, use Chrome or Edge from `http://localhost` or an `https://` address.

**Browser limitation:** this is expected behavior, not a fault.

### “Reopen” always asks me to choose the folder again

**Cause:** the last folder was loaded through the directory input, or the browser did not keep the
folder handle. Only Chromium-based browsers can reopen a folder without a dialog.

**Fix:** choose the folder again when prompted. To avoid the prompt, use Chrome or Edge on the same
machine and reload rather than reopening from another address.

### “Folder access was not granted”

**Cause:** the browser's permission request was dismissed or refused.

**Fix:** choose **Reopen** again and allow read access. Your current library is not lost when access
is refused.

### “Folder access is blocked for this site”

**Cause:** the site's folder permission was blocked in browser settings.

**Fix:** open the browser's site settings for this address, allow file/folder access, then reopen
the folder. In Chrome or Edge, use the icon beside the address bar → Site settings.

### “That folder is no longer available”

**Cause:** the remembered folder was moved, renamed, deleted, or is on a disconnected drive.

**Fix:** reconnect the drive or choose the folder's new location with **Open music folder**.

### Cancelling the folder picker wipes the library

**Expected:** it does not. Cancelling leaves the library, queue, and current song untouched. If a
selection does replace the library unexpectedly, check that you chose **Add files** rather than
**Open music folder**.

## Library contents

### No songs appear after choosing a folder

**You see:** the stage says the folder had no playable karaoke files.

**Likely causes:** the files are not named or paired correctly, or the chosen folder is empty.

**Fix:**

1. Confirm audio files use `.mp3`, `.m4a`, `.wav`, `.ogg`, or `.flac`.
2. Confirm each audio file has a same-name `.cdg`, `.lrc`, or usable `.elrc` in the same folder.
3. Confirm each file name has an `Artist - Title` form.
4. Open the skipped-files notice for the exact reasons and paths.

MP4 files do not need a companion but still need the `Artist - Title` delimiter.

### Audio and CD+G are not paired

**You see:** the audio appears under “No lyrics or CD+G”, or the `.cdg` is ignored.

**Causes and fixes:**

| Cause | Fix |
| --- | --- |
| Base names differ (`Song.mp3` / `Song (Karaoke).cdg`) | Rename so the base names match; a trailing `(Karaoke)`/` Karaoke` on the audio is tolerated, not on the companion |
| Files are in different folders | Move the companion beside the audio |
| Extension is misspelled or uppercase in an odd way | Extension matching is case-insensitive; check for double extensions such as `.mp3.cdg` |
| Audio has both `.cdg` and `.lrc` | CD+G wins by design; remove the `.cdg` if you want the LRC version |

### LRC lyrics do not appear

**You see:** the song plays but no lyrics are shown, or lyrics are reported missing.

**Causes:**

- There is no `.lrc` file with the same base name in the same folder.
- The file has no timestamped lines, so it is rejected at play time with “no usable lyric lines”.
- A `.cdg` companion exists, and CD+G takes precedence.
- The `.lrc` is standalone; lyric files never become songs by themselves.

**Fix:** repair or replace the `.lrc`, keep it beside the audio with a matching name, and remove any
competing `.cdg` if you intended to use lyrics.

### ELRC word timing is ignored

**Cause:** the `.elrc` was not paired (wrong name or folder), has no usable line headers, or the
line text did not align with the `.lrc` lines.

**Fix:** name the `.elrc` exactly like the audio and `.lrc`, and confirm it contains line headers or
standard word-timed lines. Without alignment the player falls back to line highlighting.

### A ZIP is not recognized

**You see:** the archive is reported as skipped, or its files do not appear.

**Causes and fixes:**

| Cause | Fix |
| --- | --- |
| Damaged or truncated archive | Re-download or re-create the ZIP |
| No supported audio inside | Include an MP3/M4A/WAV/OGG/FLAC file and its companion |
| Audio and companion names do not match | Rename them to share a base name; a single-audio archive tolerates one differently named companion |
| Files are in deeply separated folders | Keep each audio and its companion in the same archive folder |
| `__MACOSX`/`._*` entries confuse another tool | Those entries are ignored by the player; no action needed |

### MP4 does not appear in the library

**Cause:** the filename has no `Artist - Title` delimiter, so it is reported as an unreadable
filename.

**Fix:** rename to `Artist - Title.mp4`. MP4 does not need a lyrics companion.

### A karaoke variant is reported as an unreadable filename

**Cause:** the rendered backing track (`01 - Song - Karaoke.mp3`) has no artist in its name, the
same-name source beside it (`01 - Song.mp3`) has no artist tags (neither artist nor album artist),
and the folder is not named after the song either. Common for stems rendered with streaming tools,
which keep only encoder metadata.

**Fix**, any one of these:

- rename the song folder to `<track> - <artist> - <title>`, keeping its title equal to the file's
  (`01 - Eve 6 - Inside Out/`);
- set the artist (or album artist) and title tags on the source MP3 with any tag editor, so the
  karaoke variant inherits them;
- rename both files to `Artist - Title.mp3` and `Artist - Title - Karaoke.mp3`, and rename their
  `.lrc`/`.elrc` companions to match.

### The same song appears twice

**Causes:** two copies of the song exist in the selected folder or archive (for example a plain and
a “Karaoke” variant, or two folders containing it), or two archives contain it.

**Fix:** remove one copy. Opening the same folder through the picker or the directory input no longer
duplicates tracks, because both sources produce the same paths.

### Scanning is slow

**Cause:** the browser reads every candidate file in the folder; large libraries take longer.

**Workaround:** scan a folder with fewer files, wait for the status line to finish, and avoid
repeated rescans. Duration estimates and library rendering are already paged in the background.

## Playback and audio

### Nothing is audible

**Check, in order:**

1. The volume slider is above zero and the mute button is not active.
2. The operating system's output device and volume.
3. Press play once: browsers may keep audio silent until a user gesture unlocks playback.
4. For a multi-track MP4 in Safari, check the audio-track selector — a silent track may be selected.
5. ReplayGain is enabled with unusually quiet tags; disable it to compare.

### A song shows a playback error naming a file

**You see:** “The media could not be decoded”, “format is not supported”, or a file read error.

**Causes:** the file was deleted or moved after scanning, permissions changed, or the browser cannot
decode the codec.

**Fix:** rescan the folder. For MP4, use a browser-supported codec (typically H.264/AAC) or convert
the file. Other songs remain playable.

### There is no audio-track selector for a multi-track MP4

**Cause:** Chromium-based browsers and Firefox ship `HTMLMediaElement.audioTracks` disabled.

**Browser limitation:** those browsers play the default audio track. Use Safari to switch tracks.

### Fullscreen does not start

**Cause:** the browser or embedded context refused the request, or does not support it.

**Fix:** use a normal desktop browser window. A toast explains the failure; the app keeps working.
Fullscreen expands the stage panel only.

## Lyrics, visuals, and layout

### Lyrics are out of sync

**Causes and fixes:**

| Cause | Fix |
| --- | --- |
| Wrong `.lrc` paired with the audio | Replace it with a matching lyric file |
| The file uses an `[offset]` tag | A positive offset makes lyrics appear sooner; adjust the tag or use a corrected file |
| ELRC word timings drift within lines | Use a lyric file timed to the same audio version |
| The audio is a different mix/edit | Use lyrics made for that mix |

Clicking a lyric line seeks to it, which is a quick way to confirm timing.

### The background visualizer is missing

**Check:** the style is not **Off**, sensitivity is above 0, and a song is playing. Visuals are not
drawn for MP4 video. Reduced-motion settings do not disable the visualizer.

### The layout is cramped or overflows on a phone

The layout stacks below 860 px, wraps the transport below 620 px, and wraps queue rows below
480 px, hiding drag handles. Use the up/down queue buttons instead of dragging. If content still
overflows, note the viewport size and browser when reporting it.

## Queue and saved state

### Queue entries show “Unavailable song”

**Cause:** the saved queue was restored before a folder was loaded, or the songs are not in the
current folder.

**Fix:** reopen the original folder. If the entries are still missing after the scan, their files
were removed from that folder; the player removes them and reports it.

### The queue, favourites, or settings are gone

**Causes:**

- Site data was cleared for this address.
- The player is open on a different port or host, which is a different origin.
- The window is private/incognito.
- The browser profile changed.

**Fix:** none for the lost state; reopen the folder and rebuild the queue. The music files are
untouched. Saved state cannot be exported or imported.

### Reopening a folder asks for permission every time

**Cause:** the browser does not persist folder handles, or permission was reset.

**Fix:** grant read access when asked. Chrome and Edge on the same machine and address keep the
handle; clearing site data or changing the address removes it.

### The player reports saved queue entries were not found

**Cause:** the scanned folder does not contain some songs that were queued or played before.

**Expected:** those entries are removed, the rest keep their order, and a toast reports the
removal. Reopen the folder that contains them if the removal was unintended.

## Getting more help

When reporting a problem, include:

- the browser and version, operating system, and whether the page is on localhost or a LAN address,
- the exact message or toast text,
- whether the folder was opened with the picker, **Add files**, or drag-and-drop,
- console errors from the browser's developer tools, if any.

Behavior contracts live in [`openspec/specs/`](../openspec/specs/). Historical browser checks and
their known gaps are preserved in [the archive](archive/README.md); they describe past snapshots,
not current guarantees.
