import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const projectRoot = process.cwd()
const workspaceRoot = join(projectRoot, '..')
const outputPath = join(projectRoot, 'deliverables', 'final-manifest.json')
const roots = ['src', 'tests', 'scripts', 'public', 'dist', 'reports']
const files = [
  '.gitignore', '.oxlintrc.json', 'index.html', 'package.json', 'package-lock.json',
  'playwright.config.ts', 'README.md', 'FOUNDATION-STANDARD.md',
  'REACT-ARCHITECTURE-STANDARD.md', 'TASK-ARCHETYPE-CATALOG.md',
  'TASK-AUTHORING-SCHEMA.md', 'PILOT-ARCHITECTURE-REVIEW.md',
  'FINAL-HANDOVER.md', 'OPERATIONS-RUNBOOK.md', 'ROLLBACK-GUIDE.md',
  'KNOWN-LIMITATIONS.md', 'TASK-ACCEPTANCE-MATRIX.md',
  'STAGE-2-REPORT.md', 'STAGE-3-REPORT.md', 'STAGE-4-REPORT.md',
  'STAGE-5-REPORT.md', 'STAGE-5.5-REPORT.md', 'STAGE-6-REPORT.md',
  'STAGE-7-REPORT.md', 'STAGE-8-REPORT.md', 'STAGE-9-REPORT.md',
  'tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts',
  'vitest.config.ts', 'deliverables/README.md', 'deliverables/validation.log',
]

async function walk(directory) {
  const entries = await readdir(join(projectRoot, directory), { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) results.push(...await walk(path))
    else if (entry.isFile()) results.push(path)
  }
  return results
}

const collected = [...files]
for (const root of roots) collected.push(...await walk(root))
const unique = [...new Set(collected.map((path) => path.replaceAll('\\', '/')))].sort()
const manifestFiles = []

for (const path of unique) {
  const data = await readFile(join(projectRoot, path))
  const details = await stat(join(projectRoot, path))
  manifestFiles.push({
    archivePath: `Propotype-React/${path}`,
    bytes: details.size,
    sha256: createHash('sha256').update(data).digest('hex').toUpperCase(),
  })
}

const specification = await readFile(join(workspaceRoot, 'REACT-MIGRATION-SPEC.md'))
const specificationDetails = await stat(join(workspaceRoot, 'REACT-MIGRATION-SPEC.md'))
manifestFiles.push({
  archivePath: 'REACT-MIGRATION-SPEC.md',
  bytes: specificationDetails.size,
  sha256: createHash('sha256').update(specification).digest('hex').toUpperCase(),
})

await writeFile(outputPath, `${JSON.stringify({
  createdAt: new Date().toISOString(),
  release: 'final-2026-09-06',
  contract: 'architecture-2',
  taskCount: 26,
  fileCount: manifestFiles.length,
  files: manifestFiles,
}, null, 2)}\n`, 'utf8')
console.log(`Created ${outputPath} with ${manifestFiles.length} files.`)
