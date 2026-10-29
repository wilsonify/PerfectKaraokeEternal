# Real MP3+G fixtures

Short MP3+G excerpts from **Tom and the Back Roads — Between Tides**, used by
`test/media-fixtures.test.js`. They are real karaoke mixes, not generated tones,
so the tests exercise actual MP3 frame parsing, CD+G decoding, and the same
folder/ZIP discovery path as a user's library.

## Contents

| File | Description |
| --- | --- |
| `Tom and the Back Roads - Breaking the Surface.mp3` | 21-second excerpt of the karaoke mix, starting at 0:42 |
| `Tom and the Back Roads - Breaking the Surface.cdg` | CD+G graphics generated from the matching LRC line timings |
| `Tom and the Back Roads - Breaking the Surface.lrc` | Excerpt LRC, included to verify that CD+G wins when both companions exist |
| `Tom and the Back Roads - Wires Crossed.zip` | 20.5-second excerpt and the same three files, with the audio starting at 0:33 |
| `fixtures.json` | Source details, excerpt timings, sizes and SHA-256 checksums used by the tests |
| `generate.js` | Development-only script that rebuilds the excerpts from the album |

The CD+G streams use the standard 300 packets-per-second format, a 300x216
screen, a 5x7 bitmap font, and line changes timed from the band's LRC files.
Each screen shows one centered lyric line, so the fixture stays legible without
a large text-rendering dependency.

## Provenance and licence

The audio is the band's own karaoke mix, supplied by the repository owner for
test use. No commercial karaoke tracks, third-party artwork, samples, or
other licensed media are included. The excerpts are deliberately short.

## Regenerating

The source album is not part of this repository. If it is available locally:

```bash
node test/fixtures/media/generate.js --album "/path/to/Tom-and-the-Back-Roads/album"
```

The generator cuts at MP3 frame boundaries, rewrites the VBR Xing header so
browsers report the correct excerpt duration, reads the matching `.lrc` files,
and rewrites `fixtures.json`. It is not run by `npm test`.
