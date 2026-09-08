import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const servers = [
  { name: 'HTML baseline', port: 4173, root: '../Propotype' },
  { name: 'React static build', port: 4176, root: 'dist' },
]
const playwrightCli = './node_modules/@playwright/test/cli.js'

async function isReachable(port) {
  try {
    return (await fetch(`http://127.0.0.1:${port}`)).ok
  } catch {
    return false
  }
}

async function waitForServer(server, config, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`${config.name} exited with code ${server.exitCode}.`)
    if (await isReachable(config.port)) return
    await delay(150)
  }
  throw new Error(`${config.name} did not become ready.`)
}

async function stopServer(server) {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(3_000)])
  if (server.exitCode === null) server.kill('SIGKILL')
}

for (const config of servers) {
  if (await isReachable(config.port)) throw new Error(`Port ${config.port} is already in use.`)
}

const processes = servers.map((config) => {
  const child = spawn(process.execPath, ['./scripts/serve-static-build.mjs', '--root', config.root, '--port', String(config.port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => process.stdout.write(`[${config.name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${config.name}] ${chunk}`))
  return child
})

let exitCode = 1
try {
  await Promise.all(processes.map((server, index) => waitForServer(server, servers[index])))
  const tests = spawn(process.execPath, [playwrightCli, 'test', 'tests/e2e/stage8-parity.spec.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      HTML_BASE_URL: 'http://127.0.0.1:4173',
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4176',
      PARITY_E2E: 'true',
    },
  })
  exitCode = await new Promise((resolve) => tests.once('exit', resolve))
} finally {
  await Promise.all(processes.map(stopServer))
  for (const server of processes) {
    server.stdout.destroy()
    server.stderr.destroy()
  }
}

process.exit(exitCode ?? 1)
