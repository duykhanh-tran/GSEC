import type { ComponentType } from 'react'
import type { TaskArchetype } from '../task-engine/schema'

export type WorksheetNumber = number
export type TaskMigrationStatus = 'planned' | 'migrated'

export interface TaskComponentProps {
  task: TaskDefinition
}

export interface TaskDefinition {
  code: string
  unit?: number
  worksheet: WorksheetNumber
  lesson?: number
  taskNumber: number
  title: string
  subtitle: string
  status: TaskMigrationStatus
  archetypes: readonly TaskArchetype[]
  component: ComponentType<TaskComponentProps>
  legacyUrl: string
}
