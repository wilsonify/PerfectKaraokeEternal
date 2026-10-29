#!/usr/bin/env node
/*
 * Static file server for the karaoke player.
 *
 * The app is a plain HTML/JS/CSS bundle with no build step, so all this needs to
 * do is serve the repository root. Node's standard library is enough; there are
 * no dependencies to install.
 *
 * Usage: node serve.js [--port 3000]
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)))

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
 * Resolve a request path to a file inside ROOT.
 * Returns `{ status, path }`; status is 200 when a file was resolved.
 */
export function resolvePath (urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    // Malformed percent-encoding (e.g. "%zz")
    return { status: 400 }
  }

  const target = normalize(join(ROOT, decoded === '/' ? 'index.html' : decoded))

  if (target !== ROOT && !target.startsWith(ROOT + sep)) return { status: 403 }
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
  const port = parsePort(process.argv.slice(2))

  createServer(createHandler()).listen(port, () => {
    console.log(`Karaoke player running at http://localhost:${port}`)
    console.log('Press Ctrl+C to stop.')
  })
}
