import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

const portIndex = process.argv.indexOf('--port')
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 4176)
const rootIndex = process.argv.indexOf('--root')
const rootArgument = rootIndex >= 0 ? process.argv[rootIndex + 1] : 'dist'
const distRoot = normalize(join(process.cwd(), rootArgument))
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname)
  const relativePath = decoded.replace(/^\/+/, '')
  const candidate = normalize(join(distRoot, relativePath))
  return candidate === distRoot || candidate.startsWith(`${distRoot}${sep}`) ? candidate : null
}

async function regularFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function resolveRequest(pathname) {
  if (pathname === '/') return { path: join(distRoot, 'index.html'), status: 200 }
  const candidate = safePath(pathname)
  if (candidate && await regularFile(candidate)) return { path: candidate, status: 200 }
  if (candidate && await regularFile(join(candidate, 'index.html'))) {
    return { path: join(candidate, 'index.html'), status: 200 }
  }
  const errorPage = join(distRoot, '404.html')
  return await regularFile(errorPage) ? { path: errorPage, status: 404 } : null
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const resolved = await resolveRequest(pathname)
    if (!resolved) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    response.writeHead(resolved.status, {
      'Content-Type': mimeTypes[extname(resolved.path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(resolved.path).pipe(response)
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Bad request')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Strict static server listening on http://127.0.0.1:${port}`)
})
