import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(projectRoot, '..')
const prototypeRoot = join(workspaceRoot, 'Propotype')
const ws6Root = join(workspaceRoot, 'WS 6_HTML')
const migrationBaselineRoot = join(workspaceRoot, 'React-Migration-Baseline', 'manifests')
const sourceBaseline = JSON.parse(await readFile(join(prototypeRoot, 'source-baseline.json'), 'utf8'))
const prototypeBaseline = JSON.parse(await readFile(join(workspaceRoot, 'React-Migration-Baseline', 'manifests', 'prototype-file-manifest.json'), 'utf8'))
const ws6Baseline = JSON.parse(await readFile(join(migrationBaselineRoot, 'ws6-source-file-manifest.json'), 'utf8'))

async function matches(path, expectedBytes, expectedHash) {
  const data = await readFile(path)
  const details = await stat(path)
  const hash = createHash('sha256').update(data).digest('hex').toUpperCase()
  return details.size === expectedBytes && hash === expectedHash
}

let sourcePassed = 0
for (const entry of sourceBaseline.files) {
  const path = resolve(prototypeRoot, entry.path)
  if (await matches(path, entry.bytes, entry.sha256)) sourcePassed += 1
}

let prototypePassed = 0
for (const entry of prototypeBaseline.files) {
  const path = join(prototypeRoot, entry.path)
  if (await matches(path, entry.bytes, entry.sha256)) prototypePassed += 1
}

let ws6Passed = 0
for (const entry of ws6Baseline.files) {
  const path = join(ws6Root, entry.source)
  if (await matches(path, entry.bytes, entry.sha256)) ws6Passed += 1
}

console.log(`WS source hashes: ${sourcePassed}/${sourceBaseline.files.length} passed.`)
console.log(`Propotype baseline hashes: ${prototypePassed}/${prototypeBaseline.files.length} passed.`)
console.log(`WS6 source hashes: ${ws6Passed}/${ws6Baseline.files.length} passed.`)
if (sourcePassed !== sourceBaseline.files.length || prototypePassed !== prototypeBaseline.files.length || ws6Passed !== ws6Baseline.files.length) process.exitCode = 1
