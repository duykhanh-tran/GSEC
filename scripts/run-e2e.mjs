import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const previewMode = process.argv.includes('--preview')
const staticMode = process.argv.includes('--static')
const port = staticMode ? '4176' : previewMode ? '4175' : '4174'
const baseUrl = `http://127.0.0.1:${port}`
const viteCli = './node_modules/vite/bin/vite.js'
const playwrightCli = './node_modules/@playwright/test/cli.js'

async function isReachable() {
  try {
    const response = await fetch(baseUrl)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer(server, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Test server exited with code ${server.exitCode}.`)
    }
    if (await isReachable()) return
    await delay(150)
  }
  throw new Error(`Vite dev server did not become ready at ${baseUrl}.`)
}

async function stopServer(server) {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(3_000),
  ])
  if (server.exitCode === null) server.kill('SIGKILL')
}

if (await isReachable()) {
  throw new Error(`Port ${port} is already in use. Stop the existing server and retry.`)
}

const serverArgs = staticMode
  ? ['./scripts/serve-static-build.mjs', '--port', port]
  : [viteCli, ...(previewMode ? ['preview'] : []), '--host', '127.0.0.1', '--port', port, '--strictPort']
const server = spawn(process.execPath, serverArgs, { stdio: ['ignore', 'pipe', 'pipe'] })

server.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`))
server.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`))

let exitCode = 1
try {
  await waitForServer(server)
  const testArgs = staticMode
    ? [playwrightCli, 'test', 'tests/e2e/stage7-url-compatibility.spec.ts']
    : [playwrightCli, 'test']
  const tests = spawn(process.execPath, testArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      STATIC_E2E: staticMode ? 'true' : 'false',
    },
  })
  exitCode = await new Promise((resolve) => tests.once('exit', resolve))
} finally {
  await stopServer(server)
  server.stdout.destroy()
  server.stderr.destroy()
}

process.exit(exitCode ?? 1)
