import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createHandler, parsePort, resolvePath } from '../serve.js'

// serve.js roots itself at the repo directory; mirror that here.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

test('parsePort accepts defaults, flags and environment', () => {
  assert.equal(parsePort([], {}), 3000)
  assert.equal(parsePort(['--port', '8080'], {}), 8080)
  assert.equal(parsePort([], { PORT: '9999' }), 9999)
  // An explicit flag wins over the environment.
  assert.equal(parsePort(['--port', '8080'], { PORT: '9999' }), 8080)
})

test('parsePort rejects invalid ports', () => {
  assert.throws(() => parsePort(['--port', '0']), /Invalid port/)
  assert.throws(() => parsePort(['--port', 'abc']), /Invalid port/)
  assert.throws(() => parsePort(['--port', '70000']), /Invalid port/)
  assert.throws(() => parsePort([], { PORT: 'nope' }), /Invalid port/)
})

test('resolvePath maps URLs to files inside the repo root', () => {
  assert.equal(resolvePath('/').path, join(ROOT, 'index.html'))
  assert.equal(resolvePath('/js/app.js').path, join(ROOT, 'js', 'app.js'))
  assert.equal(resolvePath('/js/app.js?v=123').path, join(ROOT, 'js', 'app.js'))
  assert.equal(resolvePath('/').status, 200)
})

test('resolvePath blocks traversal, both raw and encoded', () => {
  assert.equal(resolvePath('/../secret.txt').status, 403)
  assert.equal(resolvePath('/%2e%2e/secret.txt').status, 403)
  assert.equal(resolvePath('/js/../../secret.txt').status, 403)
  assert.equal(resolvePath('/..\\secret.txt').status, 403)
  assert.equal(resolvePath('/%zz').status, 400)
})

let server
let baseUrl

function rawRequest (path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request(baseUrl, { path, method }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

before(async () => {
  server = createServer(createHandler())
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
})

test('GET / serves the app shell', async () => {
  const response = await rawRequest('/')
  assert.equal(response.status, 200)
  assert.match(response.headers['content-type'], /text\/html/)
  assert.match(response.body, /<title>Perfect Karaoke<\/title>/)
})

test('GET serves modules with the right content type', async () => {
  const response = await rawRequest('/js/app.js')
  assert.equal(response.status, 200)
  assert.match(response.headers['content-type'], /text\/javascript/)
})

test('GET missing files return 404', async () => {
  const response = await rawRequest('/does-not-exist.js')
  assert.equal(response.status, 404)
})

test('non-GET methods are rejected', async () => {
  const response = await rawRequest('/', 'POST')
  assert.equal(response.status, 405)
  assert.equal(response.headers.allow, 'GET, HEAD')
})

test('encoded traversal and malformed URLs are rejected', async () => {
  assert.equal((await rawRequest('/%2e%2e/%2e%2e/secret.txt')).status, 403)
  assert.equal((await rawRequest('/%zz')).status, 400)
})
