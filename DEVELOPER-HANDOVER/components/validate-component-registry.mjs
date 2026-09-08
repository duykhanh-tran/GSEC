import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const registryPath = path.join(import.meta.dirname, 'component-registry.json')
const componentRoot = path.join(projectRoot, 'src/components')
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

const allowedExposure = new Set([
  'system-only',
  'content-only',
  'bounded-config',
  'archetype-form',
  'developer-only',
])

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

function normalizeSource(file) {
  return path.relative(projectRoot, file).replaceAll('\\', '/')
}

const errors = []
const entries = registry.components ?? []
const actualSources = walk(componentRoot)
  .filter((file) => file.endsWith('.tsx'))
  .map(normalizeSource)
  .sort()
const registeredSources = entries.map((entry) => entry.source).sort()

for (const field of ['id', 'component', 'source']) {
  const values = entries.map((entry) => entry[field])
  if (new Set(values).size !== values.length) errors.push(`Duplicate ${field}`)
}

for (const entry of entries) {
  for (const field of [
    'id',
    'component',
    'source',
    'group',
    'kind',
    'adminExposure',
    'requiredProps',
    'optionalProps',
    'events',
    'states',
    'rules',
  ]) {
    if (!(field in entry)) errors.push(`${entry.component ?? 'Unknown'} missing ${field}`)
  }
  if (!allowedExposure.has(entry.adminExposure)) {
    errors.push(`${entry.component}: invalid adminExposure ${entry.adminExposure}`)
  }
}

for (const source of actualSources) {
  if (!registeredSources.includes(source)) errors.push(`Unregistered component: ${source}`)
}
for (const source of registeredSources) {
  if (!actualSources.includes(source)) errors.push(`Registry source missing on disk: ${source}`)
}

if (entries.length !== registry.scope.componentCount) {
  errors.push(`scope.componentCount is ${registry.scope.componentCount}, found ${entries.length}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Component registry valid: ${entries.length}/${actualSources.length} components.`)
}
