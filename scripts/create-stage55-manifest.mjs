import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const projectRoot = process.cwd()
const outputPath = join(projectRoot, 'checkpoints', 'stage-5.5', 'manifest.json')
const roots = ['src', 'tests', 'scripts', 'dist', 'reports']
const files = [
  '.gitignore', '.oxlintrc.json', 'index.html', 'package.json', 'package-lock.json',
  'playwright.config.ts', 'README.md', 'FOUNDATION-STANDARD.md',
  'REACT-ARCHITECTURE-STANDARD.md', 'TASK-ARCHETYPE-CATALOG.md',
  'TASK-AUTHORING-SCHEMA.md', 'PILOT-ARCHITECTURE-REVIEW.md',
  'STAGE-2-REPORT.md', 'STAGE-3-REPORT.md', 'STAGE-4-REPORT.md',
  'STAGE-5-REPORT.md', 'STAGE-5.5-REPORT.md', 'tsconfig.app.json', 'tsconfig.json',
  'tsconfig.node.json', 'vite.config.ts', 'vitest.config.ts',
  'checkpoints/stage-5.5/README.md', 'checkpoints/stage-5.5/validation.log',
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
  const absolutePath = join(projectRoot, path)
  const data = await readFile(absolutePath)
  const details = await stat(absolutePath)
  manifestFiles.push({ path: relative(projectRoot, absolutePath).replaceAll('\\', '/'), bytes: details.size, sha256: createHash('sha256').update(data).digest('hex').toUpperCase() })
}
await writeFile(outputPath, `${JSON.stringify({ createdAt: new Date().toISOString(), stage: '5.5', contract: 'architecture-2', fileCount: manifestFiles.length, files: manifestFiles }, null, 2)}\n`, 'utf8')
console.log(`Created ${outputPath} with ${manifestFiles.length} files.`)
