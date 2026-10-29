#!/usr/bin/env node
/*
 * Static file server for the karaoke player.
 *
 * The app is a plain HTML/JS/CSS bundle with no build step, so all this needs to
 * do is serve those files from the repository. Node's standard library is
 * enough; there are no dependencies to install.
 *
 * Usage: node serve.js [--port 3000] [--host 127.0.0.1]
 *
 * Only the application files are served (the shell, css, js and assets). The
 * server listens on loopback by default; `--host 0.0.0.0` is an explicit opt-in
 * for reaching the player from another device on the network.
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)))
const PUBLIC_FILES = new Set(['index.html'])
const PUBLIC_DIRECTORIES = ['css', 'js', 'assets']
const DEFAULT_HOST = '127.0.0.1'

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

export function parsePort (argv, env = process.env) {
  const flag = argv.indexOf('--port')
  const value = flag !== -1 ? argv[flag + 1] : env.PORT
  const port = Number(value ?? 3000)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`)
  }

  return port
}

/**
 * Network interface to listen on. Loopback is the default; passing `--host`
 * (or HOST) is the explicit opt-in for LAN access.
 */
export function parseHost (argv, env = process.env) {
  const flag = argv.indexOf('--host')
  const value = flag !== -1 ? argv[flag + 1] : env.HOST

  if (flag !== -1 && (value === undefined || value.startsWith('-'))) {
    throw new Error(`Invalid host: ${value ?? ''}`)
  }
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    throw new Error(`Invalid host: ${value}`)
  }

  return value?.trim() || DEFAULT_HOST
}

function isPublicFile (target) {
  const path = relative(ROOT, target).split(sep).join('/')
  if (PUBLIC_FILES.has(path)) return true
  return PUBLIC_DIRECTORIES.some(directory => path.startsWith(`${directory}/`))
}

/**
 * Resolve a request path to a file inside ROOT. Returns `{ status, path }`;
 * status is 200 only for the application's own files. Anything else inside the
 * repository (tests, docs, .git, node_modules) is reported as 404 so the
 * server does not expose unrelated files.
 */
export function resolvePath (urlPath) {
  let decoded
  try {
    // Treat backslashes as separators on every platform so Windows-style
    // traversal is rejected consistently, including percent-encoded ones.
    decoded = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/')
  } catch {
    // Malformed percent-encoding (e.g. "%zz")
    return { status: 400 }
  }

  const target = normalize(join(ROOT, decoded === '/' ? 'index.html' : decoded))

  if (target !== ROOT && !target.startsWith(ROOT + sep)) return { status: 403 }
  if (target === ROOT || !isPublicFile(target)) return { status: 404 }
  return { status: 200, path: target }
}

async function handleRequest (request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed')
    return
  }

  const resolved = resolvePath(request.url ?? '/')

  if (resolved.status !== 200) {
    response.writeHead(resolved.status).end(resolved.status === 400 ? 'Bad request' : 'Forbidden')
    return
  }

  let info
  try {
    info = await stat(resolved.path)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found')
    return
  }

  if (!info.isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found')
    return
  }

  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(resolved.path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    // Local files change while editing; always revalidate.
    'cache-control': 'no-cache',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(resolved.path).pipe(response)
}

/** Request handler, exported so the server can be exercised by tests. */
export function createHandler () {
  return (request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error)
      if (!response.headersSent) response.writeHead(500)
      response.end('Internal error')
    })
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const argv = process.argv.slice(2)
  const port = parsePort(argv)
  const host = parseHost(argv)
  const loopback = host === 'localhost' || host === '::1' || host.startsWith('127.')
  const displayHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host

  createServer(createHandler()).listen(port, host, () => {
    console.log(`Karaoke player running at http://${displayHost}:${port}`)
    if (!loopback) {
      console.log(`Listening on ${host}; other devices on your network can reach this player.`)
    }
    console.log('Press Ctrl+C to stop.')
  })
}
