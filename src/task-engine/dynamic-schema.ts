export type StandardFormType =
  | 'FORM_1_CHOICE'
  | 'FORM_2_FILL'
  | 'FORM_3_WRITING'
  | 'FORM_4_SENTENCE_REPAIR'
  | 'FORM_4_SPEAKING'
  | 'FORM_5_SEQUENCE'
  | 'FORM_5_LISTEN_REPEAT'
  | 'FORM_6_1_PROFILE_QA'
  | 'FORM_6_2_INTERVIEW_PROFILE'

export interface ChoiceItemConfig {
  id: number | string
  label: string
  cue?: string
  prompt?: string
  audio_url?: string
  audioUrl?: string
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
  id: string | number
  label: string
  placeholder?: string
  inputMode?: 'text' | 'numeric'
  correct?: string
  accepted?: string[]
  hints?: string[]
  firstHint?: string
  secondHint?: string
  cue?: string
}

export interface Form2FillConfig {
  intro: string
  note?: string
  fields?: BlankFieldConfig[]
  items?: BlankFieldConfig[]
  audioUrl?: string
  audio_url?: string
}

export type Form3SubMode = 'FREE_SENTENCE' | 'BOOK_KEYWORD' | 'PARAGRAPH'

export interface WritingItemConfig {
  id: string | number
  label: string
  prompt?: string
  sentence_starter?: string // Từ/cụm từ cho trước ở đầu câu (ví dụ: "My school is", "In my school bag, I have")
  sentence_ending?: string // Cụm từ cho trước ở cuối câu nếu có (ví dụ: "at school.")
  required_words?: string[]
  reference_sentence?: string
  hints?: string[]
  cue?: string
  min_words?: number
  scoring_criteria?: string // Tiêu chí chấm điểm riêng cho câu này (nếu có)
}

export interface Form3ParagraphConfig {
  prompt: string
  min_words?: number
  max_words?: number
  helper_words?: string[]
  criteria?: string[]
  hints?: string[]
}

export interface Form3WritingConfig {
  intro: string
  note?: string
  sub_mode?: Form3SubMode
  scoring_criteria?: string // Tiêu chí chấm điểm của giáo viên/admin để AI chấm sát hơn cho Form 3 (3.1 & 3.2)
  items?: WritingItemConfig[]
  paragraph?: Form3ParagraphConfig
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

export interface Form4SpeakingConfig {
  intro: string
  note?: string
  linked_task_code?: string // Mã bài Form 3 liên kết (ví dụ '60115')
  fallback_sentences?: string[] // Các câu mẫu dự phòng nếu chưa có bài Form 3
  mode?: 'SENTENCES' | 'PARAGRAPH'
  pass_score?: number // Ngưỡng điểm hoàn thành (mặc định 80/100)
  allow_model_listen?: boolean // Cho phép nghe giọng đọc mẫu (TTS)
  scoring_criteria?: string // Tiêu chí chấm điểm của giáo viên/admin để AI chấm sát hơn
}

export interface Form5SequenceConfig {
  intro: string
  total_slots: number
  fixed_first?: number
  choices: number[]
}

export interface ListenRepeatItemConfig {
  id: string | number
  label: string
  target_text: string
  audio_url?: string
  hints?: string[]
  cue?: string
}

export interface Form5ListenRepeatConfig {
  intro: string
  note?: string
  pass_score?: number
  items: ListenRepeatItemConfig[]
}

export interface Form61ProfileFieldItem {
  id: string
  label: string
  profile_value: string
  audio_url?: string
  accepted_answers: string[]
  hints?: string[]
}

export interface Form61ProfileConfig {
  intro: string
  note?: string
  profile_title?: string
  is_fixed_first_field?: boolean
  items: Form61ProfileFieldItem[]
}

export interface Form62InterviewFieldItem {
  id: string
  label: string
  target_answer: string
  accepted_values?: string[]
  answer_audio_url?: string
  answer_text_display?: string
  question_bank: string[]
  hints?: string[]
}

export interface Form62InterviewConfig {
  intro: string
  note?: string
  pass_score?: number
  items: Form62InterviewFieldItem[]
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
  content:
    | Form1ChoiceConfig
    | Form2FillConfig
    | Form3WritingConfig
    | Form4SentenceRepairConfig
    | Form4SpeakingConfig
    | Form5SequenceConfig
    | Form5ListenRepeatConfig
    | Form61ProfileConfig
    | Form62InterviewConfig
    | Record<string, any>
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
