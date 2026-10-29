/*
 * Multi-track audio support (upstream issue #79).
 *
 * Some karaoke MP4 files carry two audio tracks — e.g. "vocal" and
 * "instrumental". Browsers expose these through the `HTMLMediaElement.audioTracks`
 * API, which is currently implemented by Safari but disabled in Chromium and
 * Firefox. Treat an empty list as "this browser cannot switch tracks".
 * All functions duck-type their input so they can be unit-tested outside a
 * browser, and an empty track id falls back to its index.
 */

function trackId (track, index) {
  return track?.id === undefined || track?.id === null || String(track.id) === ''
    ? String(index)
    : String(track.id)
}

/** Summarize the audio tracks of a media element; empty when unsupported. */
export function listAudioTracks (media) {
  const list = media?.audioTracks
  if (!list || typeof list.length !== 'number') return []

  const tracks = []
  for (let i = 0; i < list.length; i++) {
    const track = list[i]
    if (!track) continue
    tracks.push({
      index: i,
      id: trackId(track, i),
      label: track.label ?? '',
      language: track.language ?? '',
      enabled: Boolean(track.enabled),
    })
  }
  return tracks
}

/** Human-readable name for a track, falling back to its position. */
export function describeAudioTrack (track, index = track.index) {
  if (track.label?.trim()) return track.label.trim()
  if (track.language?.trim()) return `Track ${index + 1} (${track.language.trim()})`
  return `Track ${index + 1}`
}

/** Enable one audio track by id, disabling the others. False when not found. */
export function enableAudioTrack (media, id) {
  const list = media?.audioTracks
  if (!list) return false

  let targetIndex = -1
  for (let i = 0; i < list.length; i++) {
    const track = list[i]
    if (track && trackId(track, i) === String(id)) {
      targetIndex = i
      break
    }
  }

  if (targetIndex === -1) return false

  for (let i = 0; i < list.length; i++) {
    if (list[i]) list[i].enabled = i === targetIndex
  }
  return true
}
