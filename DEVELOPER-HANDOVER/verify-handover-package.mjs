import { spawnSync } from 'node:child_process'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const checks = [
  ['Component contracts', 'node', ['DEVELOPER-HANDOVER/components/validate-component-registry.mjs']],
  ['Task authoring', 'node', ['DEVELOPER-HANDOVER/task-schema/validate-task-authoring.mjs']],
  ['Assessment/AI/Permission', 'node', ['DEVELOPER-HANDOVER/policies/validate-policy-contracts.mjs']],
  ['React baseline', 'npm', ['run', 'baseline:verify']],
  ['Handover manifest', 'node', ['DEVELOPER-HANDOVER/generate-handover-manifest.mjs', '--verify']],
]

for (const [label, command, args] of checks) {
  console.log(`\n[${label}]`)
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`\nDeveloper Handover Package FAILED at: ${label}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\nDeveloper Handover Package PASSED all checks.')
