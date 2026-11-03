/*
 * Global keyboard shortcuts.
 *
 * Focusing a control must not disable playback shortcuts. The previous handler
 * ignored every key while a button or slider had focus, so after clicking Play
 * (or any queue button) Space, N, P, M, F and the seek keys silently stopped
 * working. This module keeps the browser's native control behaviour for keys
 * that belong to the focused control, and routes everything else.
 */

const TEXT_INPUT_TYPES = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
])

const BUTTON_INPUT_TYPES = new Set(['button', 'reset', 'submit'])
const ADJUSTABLE_INPUT_TYPES = new Set(['checkbox', 'radio', 'range'])

const SHORTCUTS = Object.freeze({
  ' ': 'playpause',
  'Spacebar': 'playpause',
  'ArrowRight': 'seek-forward',
  'ArrowLeft': 'seek-back',
  'n': 'next',
  'N': 'next',
  'p': 'previous',
  'P': 'previous',
  'm': 'mute',
  'M': 'mute',
  'f': 'fullscreen',
  'F': 'fullscreen',
  '/': 'focus-search',
})

function isTextEntry (target, tagName, type) {
  if (tagName === 'textarea') return true
  if (tagName === 'input' && TEXT_INPUT_TYPES.has(type)) return true
  if (target?.isContentEditable === true) return true
  return target?.getAttribute?.('contenteditable') === 'true'
}

function isButtonControl (target, tagName, type) {
  if (tagName === 'button' || BUTTON_INPUT_TYPES.has(type)) return true
  return Boolean(target?.closest?.('button, a[href], summary'))
}

/**
 * Resolve a keydown event to an application action, or null when the event
 * belongs to the focused control and must be left alone.
 */
export function resolveShortcut (event) {
  if (!event || event.metaKey || event.ctrlKey || event.altKey) return null

  const key = event.key
  if (typeof key !== 'string') return null

  const target = event.target ?? null
  const tagName = String(target?.tagName ?? '').toLowerCase()
  const type = String(target?.type ?? '').toLowerCase()

  if (isTextEntry(target, tagName, type)) {
    return key === 'Escape' ? 'clear-search' : null
  }

  // Selects use letters and arrows to move between options. Leave them alone.
  if (tagName === 'select') return null

  if (tagName === 'input' && ADJUSTABLE_INPUT_TYPES.has(type)) {
    // Range and checkbox controls own their arrow/Space behaviour, but letter
    // shortcuts such as N/P/M/F are safe and useful while a slider is focused.
    if (
      key.startsWith('Arrow')
      || key === ' '
      || key === 'Spacebar'
      || key === 'Home'
      || key === 'End'
      || key === 'PageUp'
      || key === 'PageDown'
    ) {
      return null
    }
  }

  // Space and Enter activate a focused button, link or disclosure natively.
  // Other shortcuts should still work after clicking one.
  if (isButtonControl(target, tagName, type)
    && (key === ' ' || key === 'Spacebar' || key === 'Enter')) {
    return null
  }

  return SHORTCUTS[key] ?? null
}
