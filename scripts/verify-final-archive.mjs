import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = process.cwd()
const archiveArgument = 'deliverables/Propotype-React-Final-2026-09-06.zip'
const manifestPath = join(projectRoot, 'deliverables', 'final-manifest.json')
const temporaryRoot = await mkdtemp(join(tmpdir(), 'gsec-react-final-'))

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

try {
  const extraction = spawnSync('tar.exe', ['-xf', archiveArgument, '-C', temporaryRoot], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  if (extraction.status !== 0) throw new Error(extraction.stderr || 'Archive extraction failed.')

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  for (const entry of manifest.files) {
    const extractedPath = join(temporaryRoot, entry.archivePath)
    const resolvedRelative = relative(temporaryRoot, extractedPath)
    if (resolvedRelative.startsWith(`..${sep}`) || resolvedRelative === '..') throw new Error(`Unsafe manifest path: ${entry.archivePath}`)
    const data = await readFile(extractedPath)
    const hash = createHash('sha256').update(data).digest('hex').toUpperCase()
    if (hash !== entry.sha256) throw new Error(`Hash mismatch: ${entry.archivePath}`)
  }

  const archiveFiles = (await walk(temporaryRoot)).map((path) => relative(temporaryRoot, path).replaceAll('\\', '/'))
  const expectedFiles = new Set([
    ...manifest.files.map((entry) => entry.archivePath),
    'Propotype-React/deliverables/final-manifest.json',
  ])
  const unexpected = archiveFiles.filter((path) => !expectedFiles.has(path))
  const missing = [...expectedFiles].filter((path) => !archiveFiles.includes(path))
  if (unexpected.length || missing.length) {
    throw new Error(`Archive inventory mismatch. Missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}.`)
  }
  console.log(`Verified ${manifest.files.length}/${manifest.files.length} manifest hashes and ${archiveFiles.length} archive files.`)
} finally {
  const temporaryRelative = relative(tmpdir(), temporaryRoot)
  if (!temporaryRelative.startsWith('..') && temporaryRelative.startsWith('gsec-react-final-')) {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
