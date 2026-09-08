import type { ComponentType } from 'react'
import type { TaskArchetype } from '../task-engine/schema'

export type WorksheetNumber = 1 | 2 | 3 | 4 | 5 | 6
export type TaskMigrationStatus = 'planned' | 'migrated'

export interface TaskComponentProps {
  task: TaskDefinition
}

export interface TaskDefinition {
  code: string
  worksheet: WorksheetNumber
  taskNumber: number
  title: string
  subtitle: string
  status: TaskMigrationStatus
  archetypes: readonly TaskArchetype[]
  component: ComponentType<TaskComponentProps>
  legacyUrl: string
}
