import fs from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const handoverRoot = path.resolve(here, '..')
const schema = JSON.parse(fs.readFileSync(path.join(here, 'task-authoring.schema.json'), 'utf8'))
const examples = JSON.parse(fs.readFileSync(path.join(here, 'examples/archetype-examples.json'), 'utf8'))
const fixtures = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/invalid-authoring-fixtures.json'), 'utf8'))
const archetypeMap = JSON.parse(fs.readFileSync(path.join(handoverRoot, 'archetypes/task-archetype-map.json'), 'utf8'))

const archetypes = new Set(archetypeMap.archetypes.map((item) => item.id))
const capabilityVocabulary = new Set(archetypeMap.capabilityVocabulary)
const allowedBlockTypes = new Set([
  'tutor-message', 'book-reference', 'short-text-input', 'choice-group', 'answer-matrix',
  'retry-panel', 'listening-playback', 'playback-sequence', 'recording',
  'readiness-checklist', 'writing-verification', 'sequence-order', 'draft-input',
  'revision-input', 'draft-comparison', 'language-help', 'progress-steps',
])
const symbolicLabels = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'T'])
const serverOnlyKeys = new Set([
  'answerkey', 'acceptedanswers', 'rubric', 'scorerule', 'masterythreshold',
  'forcedanswer', 'aisystemprompt', 'aievaluationprompt', 'modelcredentials',
  'permissiondecision', 'correctanswer',
])
const requiredConfig = {
  'structured-answer-retry': ['responseBlockIds', 'retryBlockId', 'completionMode'],
  'guided-choice': ['choiceBlockIds', 'retryBlockId', 'guidedTracking', 'showAnswerPolicy'],
  'listen-classify-pronounce': ['playbackBlockId', 'classificationBlockId', 'recordingBlockId'],
  'recording-feedback': ['recordingBlockIds', 'repairBlockId', 'transcriptConfirmation'],
  'writing-capture-repair': ['inputBlockIds', 'previewEnabled', 'repairBlockId'],
  'mastery-review': ['evidenceBlockIds', 'reviewBlockIds', 'masteryResult'],
  'readiness-checklist': ['checklistBlockId', 'unlockWhen'],
  'speaking-coach': ['roundBlockIds', 'recordingBlockId', 'transcriptConfirmation', 'completionResult'],
  'listening-choice-assessment': ['playbackBlockId', 'choiceBlockIds', 'retryBlockId', 'requirePlaybackBeforeAnswer'],
  'sequence-ordering-repair': ['sequenceBlockId', 'repairBlockId', 'guidedOnModel'],
  'writing-coach': ['draftBlockId', 'verificationBlockId', 'revisionBlockId', 'comparisonBlockId', 'masteryResult'],
}
const referenceTypeRules = {
  'structured-answer-retry': { responseBlockIds: ['short-text-input', 'answer-matrix'], retryBlockId: ['retry-panel'] },
  'guided-choice': { choiceBlockIds: ['choice-group', 'answer-matrix'], retryBlockId: ['retry-panel'] },
  'listen-classify-pronounce': { playbackBlockId: ['listening-playback', 'playback-sequence'], classificationBlockId: ['choice-group'], recordingBlockId: ['recording'] },
  'recording-feedback': { recordingBlockIds: ['recording'], repairBlockId: ['retry-panel'] },
  'writing-capture-repair': { inputBlockIds: ['short-text-input', 'draft-input'], repairBlockId: ['retry-panel'] },
  'mastery-review': { evidenceBlockIds: ['book-reference', 'short-text-input', 'recording'], reviewBlockIds: ['choice-group', 'answer-matrix', 'short-text-input', 'recording'] },
  'readiness-checklist': { checklistBlockId: ['readiness-checklist'] },
  'speaking-coach': { roundBlockIds: ['tutor-message', 'listening-playback', 'playback-sequence'], recordingBlockId: ['recording'] },
  'listening-choice-assessment': { playbackBlockId: ['listening-playback', 'playback-sequence'], choiceBlockIds: ['choice-group', 'answer-matrix'], retryBlockId: ['retry-panel'] },
  'sequence-ordering-repair': { sequenceBlockId: ['sequence-order'], repairBlockId: ['retry-panel'] },
  'writing-coach': { draftBlockId: ['draft-input'], verificationBlockId: ['writing-verification'], revisionBlockId: ['revision-input'], comparisonBlockId: ['draft-comparison'] },
}

function walkKeys(value, visitor, trail = []) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, [...trail, key])
    walkKeys(child, visitor, [...trail, key])
  }
}

function validate(task) {
  const errors = []
  const requiredRoot = schema.required
  for (const key of requiredRoot) if (!(key in task)) errors.push(`missing root field: ${key}`)
  if (task.schemaVersion !== '1.0.0') errors.push('unsupported schemaVersion')
  if (!/^[0-9]{5}$/.test(task.code ?? '')) errors.push('code must contain five digits')
  if (!archetypes.has(task.archetype)) errors.push(`unknown archetype: ${task.archetype}`)

  walkKeys(task, (key, _value, trail) => {
    if (serverOnlyKeys.has(key.toLowerCase())) errors.push(`server-only field at ${trail.join('.')}`)
    if (key === 'html' || key === 'jsx' || key === 'className' || key === 'style') {
      errors.push(`runtime-only field at ${trail.join('.')}`)
    }
  })

  const blocks = Array.isArray(task.blocks) ? task.blocks : []
  const blockIds = new Set()
  const blocksById = new Map()
  for (const block of blocks) {
    if (blockIds.has(block.id)) errors.push(`duplicate block id: ${block.id}`)
    blockIds.add(block.id)
    blocksById.set(block.id, block)
    if (!allowedBlockTypes.has(block.type)) errors.push(`unsupported block type: ${block.type}`)
    if (block.type === 'choice-group' || block.type === 'answer-matrix') {
      for (const option of block.options ?? []) {
        const extra = Object.keys(option).filter((key) => !['id', 'label'].includes(key))
        if (extra.length) errors.push(`choice option property not allowed: ${extra.join(', ')}`)
        if (!symbolicLabels.has(option.label)) errors.push(`choice label must be symbolic: ${option.label}`)
      }
    }
  }

  for (const capability of task.capabilities ?? []) {
    if (!capabilityVocabulary.has(capability)) errors.push(`unknown capability: ${capability}`)
  }
  for (const field of requiredConfig[task.archetype] ?? []) {
    if (!(field in (task.configuration ?? {}))) errors.push(`missing configuration field: ${field}`)
  }
  for (const [key, value] of Object.entries(task.configuration ?? {})) {
    const refs = key.endsWith('BlockIds') ? value : key.endsWith('BlockId') ? [value] : []
    for (const ref of refs) {
      if (!blockIds.has(ref)) errors.push(`unresolved block reference: ${key} -> ${ref}`)
      const allowedTypes = referenceTypeRules[task.archetype]?.[key]
      if (allowedTypes && blocksById.has(ref) && !allowedTypes.includes(blocksById.get(ref).type)) {
        errors.push(`invalid block type for ${key}: ${blocksById.get(ref).type}`)
      }
    }
  }

  const hasRecording = blocks.some((block) => block.type === 'recording')
  if (hasRecording && !task.services?.permissionPolicyRef) errors.push('recording requires a permission policy')
  if (task.archetype === 'sequence-ordering-repair' && task.configuration?.guidedOnModel !== true) {
    errors.push('guidedOnModel must be true')
  }
  if (task.archetype === 'listening-choice-assessment' && task.configuration?.requirePlaybackBeforeAnswer !== true) {
    errors.push('requirePlaybackBeforeAnswer must be true')
  }
  if (task.configuration?.showAnswerPolicy === 'after-final-attempt' && task.configuration?.guidedTracking !== true) {
    errors.push('show answer requires guided tracking')
  }
  return errors
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function applyFixture(fixture) {
  const source = examples.find((example) => example.id === fixture.baseExampleId)
  if (!source) throw new Error(`Fixture base not found: ${fixture.baseExampleId}`)
  const task = clone(source)
  const parts = fixture.path.split('.')
  const key = parts.pop()
  const parent = parts.reduce((value, part) => value[part], task)
  if (fixture.operation === 'delete') delete parent[key]
  else parent[key] = fixture.value
  return task
}

const failures = []
const exampleArchetypes = new Set()

walkKeys(schema, (key, value) => {
  if (key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/')) {
    const definition = value.slice('#/$defs/'.length)
    if (!(definition in schema.$defs)) failures.push(`schema has unresolved internal ref: ${value}`)
  }
})
const schemaArchetypes = new Set(schema.properties?.archetype?.enum ?? [])
for (const archetype of archetypes) {
  if (!schemaArchetypes.has(archetype)) failures.push(`schema enum missing archetype: ${archetype}`)
}
for (const archetype of schemaArchetypes) {
  if (!archetypes.has(archetype)) failures.push(`schema enum has unknown archetype: ${archetype}`)
}

for (const example of examples) {
  exampleArchetypes.add(example.archetype)
  const errors = validate(example)
  if (errors.length) failures.push(`${example.id}: ${errors.join('; ')}`)
}
for (const archetype of archetypes) {
  if (!exampleArchetypes.has(archetype)) failures.push(`missing valid example for archetype: ${archetype}`)
}
if (examples.length !== archetypes.size) failures.push(`expected ${archetypes.size} examples, found ${examples.length}`)

for (const fixture of fixtures) {
  const errors = validate(applyFixture(fixture))
  if (!errors.some((error) => error.includes(fixture.expectedRule))) {
    failures.push(`${fixture.name}: expected rule '${fixture.expectedRule}', got [${errors.join('; ')}]`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Task authoring contract valid: ${examples.length}/${archetypes.size} archetype examples and ${fixtures.length}/${fixtures.length} rejected fixtures.`)
}
