import taskCatalog from '../app/task-catalog.json'
import type { TaskArchetype, TaskAuthoringSchema } from './schema'

export const TASK_AUTHORING_SCHEMAS: Readonly<Record<string, TaskAuthoringSchema>> =
  Object.freeze(
    Object.fromEntries(
      taskCatalog.map(({ code, archetypes }) => [
        code,
        Object.freeze({ code, archetypes: Object.freeze([...archetypes]) as readonly TaskArchetype[], version: 1 as const }),
      ]),
    ),
  )

export function getTaskAuthoringSchema(code: string): TaskAuthoringSchema {
  const schema = TASK_AUTHORING_SCHEMAS[code]
  if (!schema) throw new Error(`Missing task authoring schema for ${code}`)
  return schema
}
