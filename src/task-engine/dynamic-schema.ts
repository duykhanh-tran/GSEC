export type StandardFormType =
  | 'FORM_1_CHOICE'
  | 'FORM_2_FILL'
  | 'FORM_4_SENTENCE_REPAIR'
  | 'FORM_5_SEQUENCE'

export interface ChoiceItemConfig {
  id: number | string
  label: string
  cue?: string
  prompt?: string
  firstHint?: string
  secondHint?: string
  hints?: string[]
}

export interface Form1ChoiceConfig {
  intro: string
  note?: string
  options: string[]
  items: ChoiceItemConfig[]
  passage?: string
  audioUrl?: string
  audio_url?: string
}

export interface BlankFieldConfig {
  id: string
  label: string
  placeholder?: string
  inputMode?: 'text' | 'numeric'
}

export interface Form2FillConfig {
  intro: string
  note?: string
  fields: BlankFieldConfig[]
  audioUrl?: string
  audio_url?: string
}

export interface SentenceRepairItemConfig {
  id: string
  first: string
  type?: string
  cue?: string
}

export interface Form4SentenceRepairConfig {
  intro: string
  items: SentenceRepairItemConfig[]
}

export interface Form5SequenceConfig {
  intro: string
  total_slots: number
  fixed_first?: number
  choices: number[]
}

export interface DynamicTaskRecord {
  code: string
  unit?: number
  worksheet: number
  lesson?: number
  task_number: number
  title: string
  subtitle: string
  form_type: StandardFormType
  archetypes: string[]
  content: Form1ChoiceConfig | Form2FillConfig | Form4SentenceRepairConfig | Form5SequenceConfig | Record<string, any>
}

export interface GradingItemResult {
  correct: boolean
  hint?: string
}

export interface GradingResponse {
  success: boolean
  task_code: string
  form_type: StandardFormType
  score: number
  first_score?: number
  max_score: number
  correct_count: number
  total_count: number
  is_completed: boolean
  attempt_count: number
  results: Record<string, GradingItemResult | any>
  message?: string
}
