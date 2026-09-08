import taskCatalog from './task-catalog.json'
import type { TaskDefinition, TaskMigrationStatus, WorksheetNumber } from './task-types'
import type { TaskArchetype } from '../task-engine/schema'
import { Task60161 } from '../tasks/60161/Task60161'
import { Task60162 } from '../tasks/60162/Task60162'
import { Task60163 } from '../tasks/60163/Task60163'
import { Task60164 } from '../tasks/60164/Task60164'
import { Task60165 } from '../tasks/60165/Task60165'
import { Task60166 } from '../tasks/60166/Task60166'
import { Task60154 } from '../tasks/60154/Task60154'
import { Task60131 } from '../tasks/60131/Task60131'
import { Task60132 } from '../tasks/60132/Task60132'
import { Task60133 } from '../tasks/60133/Task60133'
import { Task60134 } from '../tasks/60134/Task60134'
import { Task60135 } from '../tasks/60135/Task60135'
import { Task60122 } from '../tasks/60122/Task60122'
import { Task60126 } from '../tasks/60126/Task60126'
import { Task60124 } from '../tasks/60124/Task60124'
import { Task60125 } from '../tasks/60125/Task60125'
import { Task60121 } from '../tasks/60121/Task60121'
import { Task60123 } from '../tasks/60123/Task60123'
import { Task60113 } from '../tasks/60113/Task60113'
import { Task60114 } from '../tasks/60114/Task60114'
import { Task60111 } from '../tasks/60111/Task60111'
import { Task60115 } from '../tasks/60115/Task60115'
import { Task60112 } from '../tasks/60112/Task60112'
import { Task60116 } from '../tasks/60116/Task60116'
import { Task60155 } from '../tasks/60155/Task60155'
import { Task60151 } from '../tasks/60151/Task60151'
import { Task60152 } from '../tasks/60152/Task60152'
import { Task60153 } from '../tasks/60153/Task60153'
import { Task60141 } from '../tasks/60141/Task60141'
import { Task60142 } from '../tasks/60142/Task60142'
import { Task60143 } from '../tasks/60143/Task60143'
import { Task60144 } from '../tasks/60144/Task60144'
interface TaskCatalogRow {
  code: string
  worksheet: number
  taskNumber: number
  title: string
  subtitle: string
  status: TaskMigrationStatus
  archetypes: string[]
}

const taskRows = taskCatalog as TaskCatalogRow[]

export type TaskCode = string

const taskComponents: Record<string, TaskDefinition['component']> = {
  '60131': Task60131,
  '60132': Task60132,
  '60133': Task60133,
  '60134': Task60134,
  '60135': Task60135,
  '60122': Task60122,
  '60126': Task60126,
  '60124': Task60124,
  '60125': Task60125,
  '60121': Task60121,
  '60123': Task60123,
  '60113': Task60113,
  '60114': Task60114,
  '60111': Task60111,
  '60115': Task60115,
  '60112': Task60112,
  '60116': Task60116,
  '60141': Task60141,
  '60142': Task60142,
  '60143': Task60143,
  '60144': Task60144,
  '60151': Task60151,
  '60152': Task60152,
  '60153': Task60153,
  '60154': Task60154,
  '60155': Task60155,
  '60161': Task60161,
  '60162': Task60162,
  '60163': Task60163,
  '60164': Task60164,
  '60165': Task60165,
  '60166': Task60166,
}

export const TASKS: readonly TaskDefinition[] = Object.freeze(
  taskRows.map(({ code, worksheet, taskNumber, title, subtitle, status, archetypes }) =>
    Object.freeze({
      code,
      worksheet: worksheet as WorksheetNumber,
      taskNumber,
      title,
      subtitle,
      status,
      archetypes: Object.freeze([...archetypes]) as readonly TaskArchetype[],
      component: taskComponents[code],
      legacyUrl: `/tasks/${code}/index.html`,
    }),
  ),
)

export const TASK_CODES: readonly TaskCode[] = Object.freeze(
  taskRows.map(({ code }) => code),
)

export const MIGRATED_TASK_CODES: readonly TaskCode[] = Object.freeze(
  taskRows.filter(({ status }) => status === 'migrated').map(({ code }) => code),
)

export const DEFAULT_TASK_CODE: TaskCode = TASK_CODES[0]

const taskMap = new Map(TASKS.map((task) => [task.code, task]))

export function normalizeTaskCode(value: unknown): string {
  return String(value ?? '').trim()
}

export function getTask(value: unknown): TaskDefinition | null {
  return taskMap.get(normalizeTaskCode(value)) ?? null
}

export function hasTask(value: unknown): boolean {
  return getTask(value) !== null
}

export function getTaskPath(value: unknown): string | null {
  const task = getTask(value)
  return task ? `/tasks/${task.code}` : null
}
