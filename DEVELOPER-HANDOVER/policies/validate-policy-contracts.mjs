import fs from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const handoverRoot = path.resolve(here, '..')
const schemas = ['assessment-policy', 'assessment-submission', 'assessment-outcome', 'ai-policy', 'permission-policy'].map((name) =>
  JSON.parse(fs.readFileSync(path.join(here, `schemas/${name}.schema.json`), 'utf8')),
)
const catalog = JSON.parse(fs.readFileSync(path.join(here, 'examples/policy-catalog.json'), 'utf8'))
const outcomes = JSON.parse(fs.readFileSync(path.join(here, 'examples/assessment-outcomes.json'), 'utf8'))
const submissions = JSON.parse(fs.readFileSync(path.join(here, 'examples/assessment-submissions.json'), 'utf8'))
const fixtures = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/invalid-policy-fixtures.json'), 'utf8'))
const tasks = JSON.parse(fs.readFileSync(path.join(handoverRoot, 'task-schema/examples/archetype-examples.json'), 'utf8'))
const archetypeMap = JSON.parse(fs.readFileSync(path.join(handoverRoot, 'archetypes/task-archetype-map.json'), 'utf8'))

const archetypes = new Set(archetypeMap.archetypes.map((item) => item.id))
const forbiddenRoleActions = {
  learner: new Set(['create', 'update', 'submit-review', 'approve', 'publish', 'archive', 'evaluate', 'request-ai', 'delete', 'export']),
  teacher: new Set(['create', 'update', 'submit-review', 'approve', 'publish', 'archive', 'evaluate', 'request-ai', 'delete']),
  'content-author': new Set(['approve', 'publish']),
}

function walk(value, visitor, trail = []) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, [...trail, key])
    walk(child, visitor, [...trail, key])
  }
}

function validateAssessment(policy, aiIds) {
  const errors = []
  if (policy.contractVersion !== '1.0.0') errors.push('invalid assessment contractVersion')
  if (policy.security?.classification !== 'server-confidential' || policy.security?.exposeToLearnerClient !== false || policy.security?.cacheOnClient !== false) {
    errors.push('assessment policy must remain server-confidential')
  }
  for (const archetype of policy.scope?.archetypes ?? []) if (!archetypes.has(archetype)) errors.push(`unknown assessment archetype: ${archetype}`)
  if (policy.evaluation?.mode === 'ai-assisted' && !aiIds.has(policy.evaluation.aiPolicyRef)) errors.push(`unresolved AI policy reference: ${policy.evaluation.aiPolicyRef}`)
  if (policy.mastery?.enabled && policy.mastery?.independentOnly !== true) errors.push('mastery must remain independent-only')
  if ((policy.retry?.revealPolicy === 'after-final-attempt' || policy.retry?.hintSequence?.includes('guided-model')) && policy.mastery?.independentOnly !== true) {
    errors.push('guided support cannot award non-independent mastery')
  }
  return errors
}

function validateAI(policy) {
  const errors = []
  if (policy.contractVersion !== '1.0.0') errors.push('invalid AI contractVersion')
  const guardrails = policy.guardrails ?? {}
  for (const key of ['bookFirst', 'noAnswerDisclosure', 'noOpenChat', 'noPermissionDecision', 'noIndependentMasteryDecision']) {
    if (guardrails[key] !== true) errors.push(`AI guardrail disabled: ${key}`)
  }
  if (guardrails.promptInjectionHandling !== 'treat-learner-content-as-data') errors.push('unsafe prompt injection handling')
  if (policy.input?.rejectUnknownFields !== true) errors.push('AI input must reject unknown fields')
  if (policy.failure?.maxRetries > 1) errors.push('AI maxRetries exceeds one')
  if (policy.privacy?.retentionDays > 30 || policy.privacy?.redactDirectIdentifiers !== true) errors.push('invalid AI privacy policy')
  if (policy.security?.classification !== 'server-confidential' || policy.security?.exposeToLearnerClient !== false || policy.security?.credentialsInPolicy !== false) errors.push('AI policy must remain server-confidential')
  walk(policy, (key, _value, trail) => {
    if (['systemprompt', 'prompt', 'apikey', 'credential', 'credentials', 'secret'].includes(key.toLowerCase())) errors.push(`raw prompt or credential field at ${trail.join('.')}`)
  })
  return errors
}

function validatePermission(policy) {
  const errors = []
  if (policy.contractVersion !== '1.0.0') errors.push('invalid permission contractVersion')
  if (policy.defaultEffect !== 'deny') errors.push('permission default must be deny')
  if (policy.security?.evaluateOnServer !== true || policy.security?.auditDeniedActions !== true) errors.push('permission must be server-evaluated and audited')
  if (policy.policyType === 'role-access') {
    const duties = policy.configuration?.separationOfDuties ?? {}
    if (duties.authorCannotApproveOwnTask !== true || duties.policyChangeRequiresReviewer !== true || duties.publishedRevisionIsImmutable !== true) errors.push('separation of duties is incomplete')
    for (const rule of policy.configuration?.rules ?? []) {
      for (const action of rule.actions ?? []) if (forbiddenRoleActions[rule.role]?.has(action)) errors.push(`${rule.role} has forbidden action: ${action}`)
      if (rule.role === 'learner' && !['task-published', 'learner-result'].includes(rule.resource)) errors.push(`learner has forbidden resource: ${rule.resource}`)
    }
  }
  if (policy.policyType === 'runtime-capability' && policy.configuration?.capability === 'microphone') {
    if (policy.configuration.requiresConsent !== true) errors.push('microphone requires consent')
    if (policy.configuration.requiresUserGesture !== true) errors.push('microphone requires user gesture')
    if (policy.configuration.requiresSecureContext !== true) errors.push('microphone requires secure context')
  }
  return errors
}

function validateOutcome(outcome) {
  const errors = []
  if (outcome.contractVersion !== '1.0.0') errors.push('invalid outcome contractVersion')
  if (outcome.score > outcome.maxScore) errors.push('score exceeds maxScore')
  if (outcome.answerShown && outcome.supportMode !== 'guided') errors.push('answer shown must be guided')
  if (outcome.supportMode === 'guided' && outcome.independentMastery) errors.push('guided outcome cannot award independent mastery')
  if (outcome.answerShown && outcome.independentMastery) errors.push('answer-shown outcome cannot award independent mastery')
  walk(outcome, (key, _value, trail) => {
    if (['answerkey', 'acceptedanswers', 'rubric', 'prompt', 'correctoptionid'].includes(key.toLowerCase())) errors.push(`outcome leaks confidential field at ${trail.join('.')}`)
  })
  return errors
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function applyFixture(fixture) {
  const collection = fixture.collection === 'outcomes' ? outcomes : catalog[fixture.collection]
  const source = collection.find((item) => item.id === fixture.baseId || item.attemptId === fixture.baseId)
  if (!source) throw new Error(`Fixture base not found: ${fixture.baseId}`)
  const value = clone(source)
  const parts = fixture.path.split('.')
  const key = parts.pop()
  const parent = parts.reduce((item, part) => item[part], value)
  if (fixture.operation === 'delete') delete parent[key]
  else parent[key] = fixture.value
  return value
}

const failures = []
for (const schema of schemas) {
  walk(schema, (key, value) => {
    if (key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/')) {
      const definition = value.slice('#/$defs/'.length)
      if (!(definition in (schema.$defs ?? {}))) failures.push(`${schema.title}: unresolved schema ref ${value}`)
    }
  })
}

const assessmentIds = new Set(catalog.assessmentPolicies.map((item) => item.id))
const aiIds = new Set(catalog.aiPolicies.map((item) => item.id))
const permissionIds = new Set(catalog.permissionPolicies.map((item) => item.id))
const allPolicyIds = [...assessmentIds, ...aiIds, ...permissionIds]
if (new Set(allPolicyIds).size !== allPolicyIds.length) failures.push('duplicate policy id across catalog')

for (const task of tasks) {
  const refs = task.services ?? {}
  if (refs.assessmentPolicyRef && !assessmentIds.has(refs.assessmentPolicyRef)) failures.push(`${task.id}: unresolved assessmentPolicyRef ${refs.assessmentPolicyRef}`)
  if (refs.aiPolicyRef && !aiIds.has(refs.aiPolicyRef)) failures.push(`${task.id}: unresolved aiPolicyRef ${refs.aiPolicyRef}`)
  if (refs.permissionPolicyRef && !permissionIds.has(refs.permissionPolicyRef)) failures.push(`${task.id}: unresolved permissionPolicyRef ${refs.permissionPolicyRef}`)
}
for (const submission of submissions) {
  if (!assessmentIds.has(submission.policyRef)) failures.push(`${submission.submissionId}: unresolved policyRef ${submission.policyRef}`)
  walk(submission, (key, _value, trail) => {
    if (['answerkey', 'acceptedanswers', 'rubric', 'correctoptionid', 'systemprompt'].includes(key.toLowerCase())) failures.push(`${submission.submissionId}: submission leaks confidential field at ${trail.join('.')}`)
  })
}
for (const policy of catalog.assessmentPolicies) failures.push(...validateAssessment(policy, aiIds).map((error) => `${policy.id}: ${error}`))
for (const policy of catalog.aiPolicies) failures.push(...validateAI(policy).map((error) => `${policy.id}: ${error}`))
for (const policy of catalog.permissionPolicies) failures.push(...validatePermission(policy).map((error) => `${policy.id}: ${error}`))
for (const outcome of outcomes) failures.push(...validateOutcome(outcome).map((error) => `${outcome.attemptId}: ${error}`))

for (const fixture of fixtures) {
  const item = applyFixture(fixture)
  const errors = fixture.collection === 'assessmentPolicies' ? validateAssessment(item, aiIds)
    : fixture.collection === 'aiPolicies' ? validateAI(item)
      : fixture.collection === 'permissionPolicies' ? validatePermission(item)
        : validateOutcome(item)
  if (!errors.some((error) => error.includes(fixture.expectedRule))) failures.push(`${fixture.name}: expected '${fixture.expectedRule}', got [${errors.join('; ')}]`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Policy contracts valid: ${catalog.assessmentPolicies.length} assessment, ${catalog.aiPolicies.length} AI, ${catalog.permissionPolicies.length} permission, ${submissions.length} submissions, ${outcomes.length} outcomes, ${fixtures.length} rejected fixtures.`)
}
