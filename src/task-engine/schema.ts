import type { ReactNode } from 'react'

export type TaskArchetype =
  | 'answer-entry'
  | 'choice-assessment'
  | 'retry-coaching'
  | 'listening'
  | 'speech-recording'
  | 'transcript-repair'
  | 'writing-repair'
  | 'readiness-checklist'
  | 'mastery-review'
  | 'role-play'
  | 'reading-comprehension'
  | 'listening-assessment'
  | 'sequence-ordering'
  | 'writing-readiness'
  | 'writing-coach'

export interface TaskAuthoringSchema {
  code: string
  archetypes: readonly TaskArchetype[]
  version: 1
}

export type TaskFlowBlock =
  | {
      id: string
      type: 'tutor-message'
      content: ReactNode
      speechText?: string
    }
  | {
      id: string
      type: 'panel'
      title: string
      subtitle: ReactNode
      stage?: string
      variant?: 'card' | 'summary'
      content: ReactNode
    }
  | {
      id: string
      type: 'custom'
      content: ReactNode
    }
  | {
      id: string
      type: 'celebration'
      active: boolean
      durationMs?: number
      onComplete?: () => void
    }

export interface ChoiceOptionConfig {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface AnswerMatrixRowConfig {
  id: string | number
  prompt: ReactNode
  options: readonly ChoiceOptionConfig[]
}

export interface RetryFieldConfig {
  id: string | number
  placeholder: string
  value: string
}

export interface ScoreItemConfig {
  id: string
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning' | 'error'
}

export interface ProgressStepConfig {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete'
}

export type SequenceValue = string | number

export interface SequenceSlotConfig {
  id: string | number
  label: ReactNode
  value: SequenceValue | null
  fixed?: boolean
}

export interface ChecklistItemConfig {
  id: string
  title: ReactNode
  help?: ReactNode
}

export interface VerificationItemConfig {
  id: string
  label: ReactNode
}

export interface DraftVersionConfig {
  id: string
  label: ReactNode
  text: ReactNode
}
