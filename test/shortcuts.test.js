import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveShortcut } from '../js/shortcuts.js'

function target (tagName, props = {}) {
  return { tagName, type: '', ...props }
}

function event (key, targetValue = target('BODY'), modifiers = {}) {
  return { key, target: targetValue, ...modifiers }
}

test('playback shortcuts work when the document has focus', () => {
  assert.equal(resolveShortcut(event(' ')), 'playpause')
  assert.equal(resolveShortcut(event('ArrowRight')), 'seek-forward')
  assert.equal(resolveShortcut(event('ArrowLeft')), 'seek-back')
  assert.equal(resolveShortcut(event('n')), 'next')
  assert.equal(resolveShortcut(event('P')), 'previous')
  assert.equal(resolveShortcut(event('m')), 'mute')
  assert.equal(resolveShortcut(event('F')), 'fullscreen')
  assert.equal(resolveShortcut(event('/')), 'focus-search')
})

test('shortcuts keep working after a button receives focus', () => {
  const button = target('BUTTON', {
    closest: selector => (selector.includes('button') ? button : null),
  })

  assert.equal(resolveShortcut(event('n', button)), 'next')
  assert.equal(resolveShortcut(event('ArrowRight', button)), 'seek-forward')
  assert.equal(resolveShortcut(event('m', button)), 'mute')
  assert.equal(resolveShortcut(event('/', button)), 'focus-search')
})

test('Space and Enter still activate a focused button natively', () => {
  const button = target('BUTTON', {
    closest: selector => (selector.includes('button') ? button : null),
  })

  assert.equal(resolveShortcut(event(' ', button)), null)
  assert.equal(resolveShortcut(event('Spacebar', button)), null)
  assert.equal(resolveShortcut(event('Enter', button)), null)
})

test('text entry keeps its own keys and Escape clears the search', () => {
  const search = target('INPUT', { type: 'search' })

  assert.equal(resolveShortcut(event('n', search)), null)
  assert.equal(resolveShortcut(event(' ', search)), null)
  assert.equal(resolveShortcut(event('ArrowLeft', search)), null)
  assert.equal(resolveShortcut(event('Escape', search)), 'clear-search')
})

test('selects and adjustable controls keep their native keys', () => {
  const select = target('SELECT')
  const volume = target('INPUT', { type: 'range' })
  const checkbox = target('INPUT', { type: 'checkbox' })

  assert.equal(resolveShortcut(event('m', select)), null)
  assert.equal(resolveShortcut(event('ArrowLeft', select)), null)
  assert.equal(resolveShortcut(event('ArrowLeft', volume)), null)
  assert.equal(resolveShortcut(event(' ', checkbox)), null)
  assert.equal(resolveShortcut(event('n', volume)), 'next')
})

test('modifier combinations are never treated as playback shortcuts', () => {
  assert.equal(resolveShortcut(event('n', undefined, { ctrlKey: true })), null)
  assert.equal(resolveShortcut(event('n', undefined, { metaKey: true })), null)
  assert.equal(resolveShortcut(event('n', undefined, { altKey: true })), null)
})

test('Escape outside a text field is left to the browser', () => {
  assert.equal(resolveShortcut(event('Escape')), null)
})
