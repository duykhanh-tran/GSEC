import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const handoverRoot = import.meta.dirname
const projectRoot = path.resolve(handoverRoot, '..')
const manifestPath = path.join(handoverRoot, 'manifest/handover-package-1.2.0.json')
const baselinePath = path.join(handoverRoot, 'baseline/react-foundation-2026-09-07-r3.json')
const verify = process.argv.includes('--verify')

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

function normalize(file) {
  return path.relative(projectRoot, file).replaceAll('\\', '/')
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase()
}

function collectFiles() {
  return walk(handoverRoot)
    .filter((file) => !normalize(file).startsWith('DEVELOPER-HANDOVER/manifest/'))
    .sort((a, b) => normalize(a).localeCompare(normalize(b)))
    .map((file) => {
      const content = fs.readFileSync(file)
      return { path: normalize(file), bytes: content.byteLength, sha256: hash(content) }
    })
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const files = collectFiles()
const aggregateSha256 = hash(Buffer.from(files.map((file) => `${file.path}:${file.sha256}`).join('\n')))
const expected = {
  packageVersion: 'developer-handover-1.2.0',
  generatedAt: new Date().toISOString(),
  sourceBaseline: {
    baselineId: baseline.baselineId,
    totalFiles: baseline.totalFiles,
    aggregateSha256: baseline.aggregateSha256,
  },
  inventory: {
    handoverFiles: files.length,
    taskCount: 32,
    archetypeCount: 11,
    componentCount: 42,
    assessmentPolicyExamples: 10,
    aiPolicyExamples: 4,
    permissionPolicyExamples: 2,
  },
  aggregateSha256,
  files,
}

if (!verify) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(expected, null, 2)}\n`)
  console.log(`Handover manifest generated: ${files.length} files, ${aggregateSha256}`)
} else {
  if (!fs.existsSync(manifestPath)) {
    console.error('Handover manifest is missing.')
    process.exitCode = 1
  } else {
    const actual = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const comparableActual = { ...actual, generatedAt: expected.generatedAt }
    if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
      console.error('Handover manifest mismatch. Review changes before generating a new package manifest.')
      process.exitCode = 1
    } else {
      console.log(`Handover manifest valid: ${files.length}/${actual.inventory.handoverFiles} files, ${aggregateSha256}`)
    }
  }
}
