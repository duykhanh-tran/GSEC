import { EMPTY_ANSWERS, type Answers, type GrammarTag } from './data'

export type TutorNotice =
  | { id: number; kind: 'complete-first' }
  | { id: number; kind: 'wrong-list'; ids: number[] }
  | { id: number; kind: 'question'; question: number }
  | { id: number; kind: 'transfer-intro' }
  | { id: number; kind: 'done' }
  | { id: number; kind: 'back' }

export type TutorNoticeInput = TutorNotice extends infer Notice
  ? Notice extends { id: number }
    ? Omit<Notice, 'id'>
    : never
  : never

export interface State60131 {
  answers: Answers
  entryVisible: boolean
  resultWrong: number[] | null
  wrongQueue: number[]
  weakTags: GrammarTag[]
  transferQueue: GrammarTag[]
  retryAttempt: 1 | 2
  retryValues: string[]
  retryFeedback: string
  transferFeedback: string
  transferWrong: string
  complete: boolean
  notices: TutorNotice[]
}

export const initialState60131: State60131 = {
  answers: structuredClone(EMPTY_ANSWERS), entryVisible: true, resultWrong: null,
  wrongQueue: [], weakTags: [], transferQueue: [], retryAttempt: 1, retryValues: [],
  retryFeedback: '', transferFeedback: '', transferWrong: '', complete: false, notices: [],
}

type Action =
  | { type: 'answer'; id: number; part: number; value: string }
  | { type: 'demo'; answers: Answers }
  | { type: 'notice'; notice: TutorNoticeInput }
  | { type: 'checked'; wrong: number[]; tags: GrammarTag[] }
  | { type: 'start-retry'; values: string[] }
  | { type: 'retry-value'; part: number; value: string }
  | { type: 'retry-feedback'; value: string }
  | { type: 'retry-second'; values: string[] }
  | { type: 'resolve-retry'; id: number; values: string[] }
  | { type: 'start-transfer' }
  | { type: 'transfer-feedback'; value: string; wrong?: string }
  | { type: 'resolve-transfer' }
  | { type: 'finish' }

function addNotice(state: State60131, notice: TutorNoticeInput): TutorNotice[] {
  return [...state.notices, { ...notice, id: state.notices.length + 1 } as TutorNotice]
}

export function reducer60131(state: State60131, action: Action): State60131 {
  switch (action.type) {
    case 'answer': return { ...state, answers: { ...state.answers, [action.id]: state.answers[action.id].map((value, part) => part === action.part ? action.value : value) } }
    case 'demo': return { ...state, answers: structuredClone(action.answers) }
    case 'notice': return { ...state, notices: addNotice(state, action.notice) }
    case 'checked': return { ...state, entryVisible: false, resultWrong: action.wrong, wrongQueue: action.wrong, weakTags: action.tags }
    case 'start-retry': return { ...state, retryAttempt: 1, retryValues: action.values, retryFeedback: '' }
    case 'retry-value': return { ...state, retryValues: state.retryValues.map((value, part) => part === action.part ? action.value : value) }
    case 'retry-feedback': return { ...state, retryFeedback: action.value }
    case 'retry-second': return { ...state, retryAttempt: 2, retryValues: action.values, retryFeedback: '' }
    case 'resolve-retry': return { ...state, answers: { ...state.answers, [action.id]: action.values }, wrongQueue: state.wrongQueue.slice(1), retryFeedback: '', retryValues: [] }
    case 'start-transfer': return { ...state, transferQueue: state.weakTags.slice(0, 2), transferFeedback: '', transferWrong: '' }
    case 'transfer-feedback': return { ...state, transferFeedback: action.value, transferWrong: action.wrong ?? '' }
    case 'resolve-transfer': return { ...state, transferQueue: state.transferQueue.slice(1), transferFeedback: '', transferWrong: '' }
    case 'finish': return { ...state, complete: true, transferQueue: [], notices: addNotice(state, { kind: 'done' }) }
  }
}
