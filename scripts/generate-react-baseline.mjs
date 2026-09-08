import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baselineId = 'react-foundation-2026-09-07-r3'
const outputPath = join(projectRoot, 'DEVELOPER-HANDOVER', 'baseline', `${baselineId}.json`)
const verifyMode = process.argv.includes('--verify')
const roots = ['src', 'tests', 'scripts', 'public']
const rootFiles = [
  '.gitignore',
  '.oxlintrc.json',
  'index.html',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vitest.config.ts',
]

async function collectFiles(path) {
  const entries = await readdir(path, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = join(path, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath))
    else if (entry.isFile()) files.push(entryPath)
  }
  return files
}

const paths = [...rootFiles.map((path) => join(projectRoot, path))]
for (const root of roots) {
  const path = join(projectRoot, root)
  try {
    paths.push(...await collectFiles(path))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const files = []
for (const path of paths.sort()) {
  const data = await readFile(path)
  const details = await stat(path)
  files.push({
    path: relative(projectRoot, path).replaceAll('\\', '/'),
    bytes: details.size,
    sha256: createHash('sha256').update(data).digest('hex').toUpperCase(),
  })
}

const aggregateInput = files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('')
const aggregateSha256 = createHash('sha256').update(aggregateInput).digest('hex').toUpperCase()
const taskCodes = [...new Set(files.map((file) => file.path.match(/^src\/tasks\/(\d{5})\//)?.[1]).filter(Boolean))].sort()

if (verifyMode) {
  const saved = JSON.parse(await readFile(outputPath, 'utf8'))
  const savedByPath = new Map(saved.files.map((file) => [file.path, file]))
  const currentByPath = new Map(files.map((file) => [file.path, file]))
  const changed = files.filter((file) => {
    const expected = savedByPath.get(file.path)
    return !expected || expected.bytes !== file.bytes || expected.sha256 !== file.sha256
  }).map((file) => file.path)
  const missing = saved.files.filter((file) => !currentByPath.has(file.path)).map((file) => file.path)
  if (changed.length || missing.length || saved.aggregateSha256 !== aggregateSha256) {
    console.error(`Baseline ${baselineId} does not match.`)
    if (changed.length) console.error(`Changed or added: ${changed.join(', ')}`)
    if (missing.length) console.error(`Missing: ${missing.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log(`Baseline ${baselineId}: ${files.length}/${saved.totalFiles} files passed.`)
    console.log(`Aggregate SHA-256: ${aggregateSha256}`)
  }
  process.exit()
}

const manifest = {
  baselineId,
  generatedAt: new Date().toISOString(),
  purpose: 'Developer handover React runtime baseline',
  scope: {
    included: [...rootFiles, ...roots.map((root) => `${root}/**/*`)],
    excluded: ['node_modules', 'dist', 'test-results', 'reports', 'checkpoints', 'deliverables', 'DEVELOPER-HANDOVER'],
  },
  inventory: {
    taskCount: taskCodes.length,
    taskCodes,
    componentTsxFiles: files.filter((file) => /^src\/components\/.+\.tsx$/.test(file.path)).length,
    hookFiles: files.filter((file) => /^src\/hooks\/.+\.tsx?$/.test(file.path)).length,
    taskEngineFiles: files.filter((file) => /^src\/task-engine\/.+\.tsx?$/.test(file.path)).length,
    unitSpecFiles: files.filter((file) => /^tests\/unit\/.+\.test\.tsx?$/.test(file.path)).length,
    e2eSpecFiles: files.filter((file) => /^tests\/e2e\/.+\.spec\.ts$/.test(file.path)).length,
  },
  totalFiles: files.length,
  totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  aggregateSha256,
  files,
}

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Created ${relative(projectRoot, outputPath)} with ${files.length} files.`)
console.log(`Aggregate SHA-256: ${manifest.aggregateSha256}`)
