import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { TaskDefinition } from '../app/task-types'
import { InteractiveTaskFrame } from '../components/shell/InteractiveTaskFrame'
import { StatusFooter } from '../components/shell/StatusFooter'
import { ActionButton } from '../components/task/ActionButton'
import { StatusTag } from '../components/task/StatusTag'
import { Celebration } from '../components/effects/Celebration'
import { useCelebrationSound } from '../hooks/useCelebrationSound'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useTaskTimers } from '../hooks/useTaskTimers'
import { TutorBubble } from '../components/chat/TutorBubble'
import { AnswerChoiceMatrix } from '../components/answers/AnswerChoiceMatrix'
import { ChoiceGroup } from '../components/answers/ChoiceGroup'
import { TaskAudioPlayer } from '../components/listening/TaskAudioPlayer'
import { SentenceRepairRenderer } from './renderers/SentenceRepairRenderer'
import { SequenceOrderingRenderer } from './renderers/SequenceOrderingRenderer'
import { SentenceWritingRenderer } from './renderers/SentenceWritingRenderer'
import { SpeakingPronunciationRenderer } from './renderers/SpeakingPronunciationRenderer'
import { ListenRepeatRenderer } from './renderers/ListenRepeatRenderer'
import { ProfileListenAnswerRenderer } from './renderers/ProfileListenAnswerRenderer'
import { InterviewFillProfileRenderer } from './renderers/InterviewFillProfileRenderer'
import {
  checkRequiredKeywords,
  evaluateSentenceWithAI,
  evaluateBatchSentencesWithAI,
  evaluateParagraphWithAI,
} from '../lib/aiGradingService'
import { saveTaskAttempt } from '../lib/taskAttemptService'
import { saveApprovedWriting } from '../lib/studentWritingStorageService'
import '../components/assessment/guided-choice-task.css'
import type {
  DynamicTaskRecord,
  Form1ChoiceConfig,
  Form2FillConfig,
  BlankFieldConfig,
  Form3WritingConfig,
  Form4SentenceRepairConfig,
  Form5SequenceConfig,
  Form4SpeakingConfig,
  Form5ListenRepeatConfig,
  Form61ProfileConfig,
  Form62InterviewConfig,
  GradingResponse,
} from './dynamic-schema'

interface DynamicTaskRunnerProps {
  task: TaskDefinition
  initialData?: DynamicTaskRecord | null
}

interface NoticeItem {
  id: number
  content: ReactNode
}

/**
 * Ghép từ/cụm từ cho trước (Sentence Starter/Ending) với phần học sinh viết tiếp thành 1 câu hoàn chỉnh để AI chấm điểm
 */
export function buildFullSentence(
  studentInput: string,
  starter?: string,
  ending?: string,
): string {
  const rawInput = (studentInput || '').trim()
  const prefix = (starter || '').trim()
  const suffix = (ending || '').trim()

  if (!prefix && !suffix) return rawInput

  let full = rawInput
  if (prefix) {
    if (rawInput.toLowerCase().startsWith(prefix.toLowerCase())) {
      full = rawInput
    } else {
      full = `${prefix} ${rawInput}`
    }
  }
  if (suffix) {
    if (!full.toLowerCase().endsWith(suffix.toLowerCase())) {
      full = `${full} ${suffix}`
    }
  }
  return full.trim()
}

/**
 * Chuẩn hóa văn bản trả lời cho Form 2 và các dạng điền từ:
 * - Chuyển chữ thường, cắt khoảng trắng đầu/cuối
 * - Chuẩn hóa các loại dấu nháy cong, ngoặc kép cong, gạch nối cong
 * - Xóa các khoảng trắng thừa giữa các từ
 * - Xóa khoảng trắng trước dấu câu
 */
export function normalizeFillAnswer(text: string): string {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,?!:;])/g, '$1')
}

/**
 * So khớp thông minh giữa câu trả lời của học sinh và đáp án được chấp nhận:
 * - Khớp trực tiếp sau khi normalize
 * - Bỏ qua dấu chấm câu ở cuối (. ? ! , ; :)
 * - Bỏ qua dấu nháy đơn (ví dụ don't <-> dont)
 * - Tự động quy đổi định dạng giờ (ví dụ 7.15 <-> 7:15 <-> 7h15)
 * - Hỗ trợ dạng viết tắt của trợ động từ (doesn't <-> does not <-> doesnt; don't <-> do not <-> dont)
 * - Hỗ trợ chuỗi thứ tự chữ cái (b-c-d-a <-> b, c, d, a <-> b c d a <-> bcda)
 */
export function areFillAnswersMatching(userRaw: string, acceptedRaw: string): boolean {
  const uNorm = normalizeFillAnswer(userRaw)
  const aNorm = normalizeFillAnswer(acceptedRaw)

  if (!uNorm || !aNorm) return false
  if (uNorm === aNorm) return true

  // 1. So khớp sau khi bỏ dấu câu ở cuối câu (. ? ! , ; :)
  const uNoTrailing = uNorm.replace(/[.,?!:;]+$/, '').trim()
  const aNoTrailing = aNorm.replace(/[.,?!:;]+$/, '').trim()
  if (uNoTrailing === aNoTrailing) return true

  // 2. So khớp sau khi bỏ cả dấu nháy đơn
  const uNoApos = uNoTrailing.replace(/['"]/g, '')
  const aNoApos = aNoTrailing.replace(/['"]/g, '')
  if (uNoApos === aNoApos) return true

  // 3. Quy đổi định dạng giờ học (7.15 vs 7:15 vs 7h15)
  const uTime = uNoTrailing.replace(/(\d+)[.:h](\d+)/g, '$1:$2')
  const aTime = aNoTrailing.replace(/(\d+)[.:h](\d+)/g, '$1:$2')
  if (uTime === aTime) return true

  // 4. Quy đổi phủ định viết tắt (does not <-> doesn't, do not <-> don't)
  const expandContractions = (s: string) =>
    s
      .replace(/\bdoesn'?t\b/g, 'does not')
      .replace(/\bdon'?t\b/g, 'do not')
      .replace(/\bisn'?t\b/g, 'is not')
      .replace(/\baren'?t\b/g, 'are not')
      .replace(/\bcan'?t\b/g, 'cannot')
      .replace(/\bwon'?t\b/g, 'will not')
  if (expandContractions(uNoTrailing) === expandContractions(aNoTrailing)) return true

  // 5. So khớp chuỗi thứ tự chữ cái (vd bài 60144: "b-c-d-a", "b, c, d, a", "b c d a", "bcda")
  const uLettersOnly = uNorm.replace(/[^a-z0-9]/g, '')
  const aLettersOnly = aNorm.replace(/[^a-z0-9]/g, '')
  if (uLettersOnly.length >= 3 && uLettersOnly === aLettersOnly) return true

  return false
}

export function gradeAnswersLocally(
  taskData: DynamicTaskRecord,
  answers: Record<string, string>,
  attemptCount: number,
): GradingResponse {
  const formType = taskData.form_type
  const content = taskData.content as any
  let itemsList: any[] = []

  if (formType === 'FORM_1_CHOICE') {
    itemsList = content?.items || []
  } else if (formType === 'FORM_2_FILL') {
    itemsList = content?.fields || content?.items || []
  }

  const results: Record<string, { correct: boolean; hint?: string }> = {}
  let correctCount = 0

  itemsList.forEach((it: any, idx: number) => {
    const rawId = String(it.id !== undefined && it.id !== null ? it.id : idx + 1)
    const cleanLabel = (it.label || String(idx + 1))
      .replace(/^câu\s*/i, '')
      .replace(/^question\s*/i, '')
      .replace(/:\s*$/, '')
      .trim()

    // Lấy câu trả lời của học sinh linh hoạt theo nhiều khóa ID khác nhau
    const rawUserVal =
      answers[rawId] ??
      answers[String(idx + 1)] ??
      answers[String(it.id)] ??
      answers[it.label] ??
      answers[cleanLabel] ??
      ''
    const userVal = (rawUserVal || '').trim()

    // Tập hợp tất cả các đáp án chấp nhận (chữ cái a, b, c, d hoặc từ, cụm từ)
    const acceptedList: string[] = []

    const addAcceptedCandidate = (val: any) => {
      if (val === undefined || val === null) return
      if (Array.isArray(val)) {
        val.forEach(addAcceptedCandidate)
      } else if (typeof val === 'string') {
        const parts = val.split(/[,/|;\n]|\bhoặc\b|\bor\b/i).map((s) => s.trim()).filter(Boolean)
        if (parts.length > 1) {
          acceptedList.push(val.trim())
          acceptedList.push(...parts)
        } else if (val.trim()) {
          acceptedList.push(val.trim())
        }
      } else if (typeof val === 'number') {
        acceptedList.push(String(val))
      }
    }

    addAcceptedCandidate(it.accepted)
    addAcceptedCandidate(it.correct)
    addAcceptedCandidate(it.correctAnswers)
    addAcceptedCandidate(it.key)
    addAcceptedCandidate(it.target_answer)
    addAcceptedCandidate(it.answer)
    addAcceptedCandidate(it.answers)
    addAcceptedCandidate(it.accepted_values)

    if (content?.keys_data) {
      addAcceptedCandidate(content.keys_data[rawId])
      addAcceptedCandidate(content.keys_data[String(idx + 1)])
      addAcceptedCandidate(content.keys_data[it.label])
      addAcceptedCandidate(content.keys_data[cleanLabel])
    }

    // Tra cứu thêm từ từ điển bài học gốc nếu chưa có cấu hình trong DB hoặc thiếu trường accepted
    const staticDefaults: Record<string, Record<string, string[]>> = {
      '60111': {
        'q1': ['school', 'a school'], '1': ['school', 'a school'],
        'q2': ['3', 'three'], '2': ['3', 'three'],
        'q3': ['excited'], '3': ['excited'],
        'q4a': ['ruler', 'compass', 'pencil sharpener', 'rubber', 'pencil case', 'calculator', 'school bag', 'notebook', 'book', 'textbook', 'pen', 'pencil'],
        'q4b': ['ruler', 'compass', 'pencil sharpener', 'rubber', 'pencil case', 'calculator', 'school bag', 'notebook', 'book', 'textbook', 'pen', 'pencil'],
        '4a': ['ruler', 'compass', 'pencil sharpener', 'rubber', 'pencil case', 'calculator', 'school bag', 'notebook', 'book', 'textbook', 'pen', 'pencil'],
        '4b': ['ruler', 'compass', 'pencil sharpener', 'rubber', 'pencil case', 'calculator', 'school bag', 'notebook', 'book', 'textbook', 'pen', 'pencil'],
      },
      '60121': {
        '1': ['study', 'a'],
        '2': ['have', 'b'],
        '3': ['play', 'c'],
        '4': ['study', 'd', 'a'],
        '5': ['do', 'b', 'd'],
        '6': ['play', 'c'],
        '7': ['have', 'd', 'b'],
        '8': ['do', 'a', 'd'],
      },
      '60131': {
        '1': ['live', 'a'],
        '2': ['goes', 'b'],
        '3': ['have', 'c'],
        '4': ['starts', 'd', 'a'],
        '5': ["don't study", "do not study", "dont study", "b"],
        '6': ["doesn't play", "does not play", "doesnt play", "c"],
        '7': ['do', 'a'], '7a': ['do', 'a'],
        '8': ['wear', 'b'], '7b': ['wear', 'b'],
        '9': ['does', 'c', 'a'], '8a': ['does', 'c', 'a'],
        '10': ['like', 'd', 'b'], '8b': ['like', 'd', 'b'],
      },
      '60133': {
        '1': ['usually do', 'i usually do my homework after dinner', 'i usually do my homework after dinner.', 'a'],
        '2': ['often uses', 'lan often uses the computer room at break time', 'lan often uses the computer room at break time.', 'b'],
        '3': ['usually have', 'do not usually have', "don't usually have", 'we do not usually have lessons on saturday', 'we do not usually have lessons on saturday.', 'c'],
        '4': ['sometimes have', 'does minh sometimes have lunch at school', 'does minh sometimes have lunch at school?', 'a'],
      },
      '60143': {
        '1': ['classmates', 'classmate', 'in the same class', 'same class', 'a'],
        '2': ['favourite subject', 'favorite subject', 'english', 'b'],
        '3': ['break time', 'at break time', 'c'],
        '4': ['study together', 'study', 'd'],
        '5': ['library', 'in the library', 'school library', 'e'],
        '6': ['share', 'share ideas', 'f'],
        '7': ['uniform', 'school uniform', 'g'],
        '8': ['homework', 'do homework', 'h'],
      },
      '60144': {
        '1': ['b, d, a, c', 'b,d,a,c', 'bdac', 'b d a c', 'b-d-a-c', 'b-c-d-a', 'a', 'b', '1'],
        '2': ['c, a, d, b', 'c,a,d,b', 'cadb', 'c a d b', 'c-a-d-b', 'b-c-d-a-e', 'c', 'd', '2'],
      },
      '60163': {
        '1': ['Our school has a large playground.', 'Our school has a large playground', '1'],
        '2': ['We do not have classes on Sunday.', "We don't have classes on Sunday.", 'We do not have classes on Sunday', '2'],
        '3': ['Does your school have a computer room?', 'Does your school have a computer room', '3'],
        '4': ['I usually do my homework after school.', 'I usually do my homework after school', '4'],
        '5': ['What do students do at break time?', 'What do students do at break time', '5'],
      },
      '60171': {
        '1': ['uniform', '1'],
        '2': ['science', '2'],
        '3': ['compass', '3'],
        '4': ['library', '4'],
        '5': ['volleyball', '5'],
        '6': ['homework', '6'],
      },
      '60174': {
        '1': ['Our lessons start at 7.15.', 'Our lessons start at 7.15', 'Our lessons start at 7:15.', 'Our lessons start at 7:15', '1'],
        '2': ["Linh doesn't go to school by bus.", 'Linh does not go to school by bus.', "Linh doesnt go to school by bus.", "Linh doesn't go to school by bus", '2'],
        '3': ['Does Tom join the art club on Friday?', 'Does Tom join the art club on Friday', '3'],
        '4': ['Students usually have lunch at school.', 'Students usually have lunch at school', '4'],
        '5': ['The first lesson finishes at 8.15.', 'The first lesson finishes at 8.15', 'The first lesson finishes at 8:15.', 'The first lesson finishes at 8:15', '5'],
      },
    }
    const taskDefaults = staticDefaults[taskData.code]
    if (taskDefaults) {
      const candidates =
        taskDefaults[rawId] ||
        taskDefaults[String(idx + 1)] ||
        taskDefaults[String(it.id)] ||
        taskDefaults[it.label] ||
        taskDefaults[cleanLabel]
      if (candidates) {
        addAcceptedCandidate(candidates)
      }
    }

    const isCorrect = acceptedList.length > 0 && acceptedList.some((acc) => areFillAnswersMatching(userVal, acc))

    if (isCorrect) {
      correctCount++
      results[rawId] = { correct: true }
    } else {
      const hints = it.hints || []
      const hint = attemptCount <= 1
        ? hints[0] || it.firstHint || it.h1 || 'Xem lại câu hỏi và kiểm tra dữ kiện trong bài.'
        : hints[1] || hints[0] || it.secondHint || it.h2 || 'Xem kỹ lại gợi ý và làm lại.'
      results[rawId] = { correct: false, hint }
    }
  })

  const totalCount = itemsList.length || 1
  const score = Math.round((correctCount / totalCount) * 100)

  return {
    success: true,
    task_code: taskData.code,
    form_type: taskData.form_type,
    score,
    max_score: 100,
    correct_count: correctCount,
    total_count: totalCount,
    is_completed: correctCount === totalCount,
    attempt_count: attemptCount,
    results,
  }
}

export function DynamicTaskRunner({ task, initialData }: DynamicTaskRunnerProps) {
  const navigate = useNavigate()
  const schedule = useTaskTimers()

  const [taskData, setTaskData] = useState<DynamicTaskRecord | null>(initialData || null)
  const [loading, setLoading] = useState(!initialData)

  // Answers State
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sequenceOrder, setSequenceOrder] = useState<(number | null)[]>([])

  // Flow State: 'entry' -> 'guided' -> 'complete'
  const [phase, setPhase] = useState<'entry' | 'guided' | 'complete'>('entry')
  const [initialWrongIds, setInitialWrongIds] = useState<string[]>([])
  const [queue, setQueue] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [feedback, setFeedback] = useState('')
  const [wrongValue, setWrongValue] = useState('')
  const [retryChosenValue, setRetryChosenValue] = useState('')
  const [currentHint, setCurrentHint] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingRetry, setIsCheckingRetry] = useState(false)
  const [listenCount, setListenCount] = useState(0)
  const [hasStartedWorksheet, setHasStartedWorksheet] = useState(false)

  // Results & Notices
  const [gradingResult, setGradingResult] = useState<GradingResponse | null>(null)
  const [writingResults, setWritingResults] = useState<Record<
    string,
    {
      correct: boolean
      hint?: string
      feedback_vi?: string
      feedback_en?: string
      missingWords?: string[]
      score?: number
    }
  > | null>(null)
  const [isCheckingWriting, setIsCheckingWriting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const bottomAnchorRef = useRef<HTMLDivElement>(null)

  useCelebrationSound(showCelebration)
  const { chatRef, scrollToLatest } = useAutoScroll(
    `${phase}-${activeId}-${attempt}-${currentHint}-${isCompleted}-${notices.length}-${hasStartedWorksheet}-${listenCount}-${isCheckingWriting}`
  )

  const addNotice = (content: ReactNode) => {
    setNotices((prev) => [...prev, { id: Date.now() + Math.random(), content }])
    scrollToLatest()
  }

  // 1. Tải cấu hình Task từ Supabase hoặc dùng fallback
  useEffect(() => {
    let ignore = false

    async function loadTask() {
      if (initialData && initialData.code === task.code && initialData.content) {
        setTaskData(initialData)
        initAnswers(initialData.form_type, initialData.content)
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('code', task.code)
        .maybeSingle()

      if (ignore) return

      if (!error && data && data.content) {
        setTaskData(data as DynamicTaskRecord)
        initAnswers(data.form_type, data.content)
      } else {
        // Fallback tạm thời nếu chưa nạp database
        setTaskData({
          code: task.code,
          unit: task.unit || 1,
          worksheet: task.worksheet,
          lesson: task.lesson || task.worksheet,
          task_number: task.taskNumber,
          title: task.title,
          subtitle: task.subtitle,
          form_type: 'FORM_1_CHOICE',
          archetypes: [...task.archetypes],
          content: {
            intro: 'Enter your A, B or C answers.',
            options: ['A', 'B', 'C'],
            items: [
              { id: 1, label: 'Question 1', cue: 'Look back at Question 1.' },
              { id: 2, label: 'Question 2', cue: 'Look back at Question 2.' },
              { id: 3, label: 'Question 3', cue: 'Look back at Question 3.' },
            ],
          },
        })
      }

      setLoading(false)
    }

    loadTask()
    return () => {
      ignore = true
    }
  }, [task.code])

  const initAnswers = (formType: string, content: any) => {
    if (formType === 'FORM_5_SEQUENCE') {
      const total = content.total_slots || 5
      const fixed = content.fixed_first
      const initOrder = Array.from({ length: total }).map((_, i) => (i === 0 && fixed !== undefined ? fixed : null))
      setSequenceOrder(initOrder)
    } else {
      setAnswers({})
    }
  }

  // Cập nhật câu trả lời từ bảng
  const handleAnswerChange = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  // Ghi nhớ các hint đã hiển thị cho từng câu hỏi để tránh lặp lại liên tiếp
  const shownHintsRef = useRef<Record<string, string[]>>({})

  // Chọn ngẫu nhiên gợi ý từ danh sách gợi ý của câu hỏi (hỗ trợ nhiều hint động)
  const getRandomHint = (id: string, item?: any, latestResults?: Record<string, any>) => {
    const candidateHints: string[] = []

    // 1. Lấy từ mảng hints nếu có
    if (item?.hints && Array.isArray(item.hints) && item.hints.length > 0) {
      candidateHints.push(...item.hints.map((h: string) => h.trim()).filter(Boolean))
    }
    // 2. Lấy từ firstHint / secondHint nếu chưa có trong mảng
    if (item?.firstHint && !candidateHints.includes(item.firstHint.trim())) {
      candidateHints.push(item.firstHint.trim())
    }
    if (item?.secondHint && !candidateHints.includes(item.secondHint.trim())) {
      candidateHints.push(item.secondHint.trim())
    }
    if (item?.h1 && !candidateHints.includes(item.h1.trim())) {
      candidateHints.push(item.h1.trim())
    }
    if (item?.h2 && !candidateHints.includes(item.h2.trim())) {
      candidateHints.push(item.h2.trim())
    }
    if (item?.hint && !candidateHints.includes(item.hint.trim())) {
      candidateHints.push(item.hint.trim())
    }
    if (item?.second && !candidateHints.includes(item.second.trim())) {
      candidateHints.push(item.second.trim())
    }
    // 3. Lấy từ kết quả server nếu có
    const sHint = latestResults?.[id]?.hint
    if (sHint && !candidateHints.includes(sHint.trim())) {
      candidateHints.push(sHint.trim())
    }

    if (candidateHints.length === 0) {
      return 'Look back at the question and check the worksheet details.'
    }
    if (candidateHints.length === 1) {
      return candidateHints[0]
    }

    // Lọc ra các gợi ý chưa hiển thị cho câu này
    const alreadyShown = shownHintsRef.current[id] || []
    const unshown = candidateHints.filter((h) => !alreadyShown.includes(h))

    let chosen: string
    if (unshown.length > 0) {
      chosen = unshown[Math.floor(Math.random() * unshown.length)]
    } else {
      // Đã hiển thị hết các gợi ý -> reset danh sách và chọn ngẫu nhiên
      chosen = candidateHints[Math.floor(Math.random() * candidateHints.length)]
      shownHintsRef.current[id] = []
    }

    shownHintsRef.current[id] = [...(shownHintsRef.current[id] || []), chosen]
    return chosen
  }

  // 2. Bắt đầu vòng Retry có hướng dẫn cho một câu hỏi sai
  const beginRetry = (id: string, attemptNumber: number, latestResults?: Record<string, any>) => {
    if (!taskData) return

    setActiveId(id)
    setAttempt(attemptNumber)
    setFeedback('')
    setWrongValue('')
    setRetryChosenValue('')

    let itemRef: any = null
    let label = `Question ${id}`
    let cue = ''

    if (taskData.form_type === 'FORM_1_CHOICE') {
      const form1Config = taskData.content as Form1ChoiceConfig
      itemRef = form1Config.items?.find((i) => String(i.id) === id)
      label = itemRef?.label || `Question ${id}`
      cue = itemRef?.cue || `Look back at Question ${id}.`
    } else if (taskData.form_type === 'FORM_2_FILL') {
      const form2Config = taskData.content as any
      const rawList = form2Config?.fields || form2Config?.items || []
      itemRef = rawList.find((f: any, idx: number) => String(f.id !== undefined && f.id !== null ? f.id : idx + 1) === id)
      const cleanNum = (itemRef?.label || id).replace(/^câu\s*/i, '').replace(/^question\s*/i, '').replace(/:\s*$/, '').trim() || id
      label = `Question ${cleanNum}`
      cue = itemRef?.cue || `Look back at Question ${cleanNum} from the worksheet.`
    } else if (taskData.form_type === 'FORM_3_WRITING') {
      const form3Config = taskData.content as Form3WritingConfig
      itemRef = form3Config.items?.find((i, idx) => String(i.id || idx + 1) === id)
      label = itemRef?.label || `Question ${id}`
      cue = itemRef?.cue || `Look back at Question ${id} from your worksheet.`
      setRetryChosenValue(answers[id] || '')
    }

    const hint = getRandomHint(id, itemRef, latestResults)

    setCurrentHint(hint)
    addNotice(
      <>
        <strong>{label}</strong>
        <br />
        {cue}
      </>
    )
    schedule(() => scrollToLatest(), 80)
  }

  // 3. Kết thúc bài tập và lưu điểm
  const finish = (finalScore = 100) => {
    setActiveId(null)
    setPhase('complete')
    setIsCompleted(true)
    setShowCelebration(true)

    const total = getTotalItems()
    const firstScoreVal = initialWrongIds.length === 0 ? 100 : Math.max(0, Math.round(((total - initialWrongIds.length) / total) * 100))

    saveTaskAttempt({
      taskCode: task.code,
      score: finalScore,
      firstScore: firstScoreVal,
      status: 'completed',
      supportMode: initialWrongIds.length === 0 ? 'INDEPENDENT' : 'GUIDED',
      answersPayload: answers,
    })

    addNotice(
      <>
        <strong>Task complete ✓</strong>
        <br />
        Great work. Back to your book.
      </>
    )
  }

  const getTotalItems = () => {
    if (!taskData) return 1
    if (taskData.form_type === 'FORM_1_CHOICE') {
      return (taskData.content as Form1ChoiceConfig).items?.length || 1
    }
    if (taskData.form_type === 'FORM_2_FILL') {
      const c = taskData.content as any
      return (c?.fields || c?.items)?.length || 1
    }
    return 1
  }

  // 4. Kiểm tra bài làm ban đầu
  const handleInitialCheck = async () => {
    if (!taskData) return

    let itemsList: { id: string; label: string; numBadge: string }[] = []

    if (taskData.form_type === 'FORM_1_CHOICE') {
      const form1Config = taskData.content as Form1ChoiceConfig
      itemsList = (form1Config.items || []).map((i) => ({
        id: String(i.id),
        label: i.label || `Question ${i.id}`,
        numBadge: String(i.id),
      }))
    } else if (taskData.form_type === 'FORM_2_FILL') {
      const form2Config = taskData.content as any
      const rawList = form2Config?.fields || form2Config?.items || []
      itemsList = rawList.map((f: any, idx: number) => {
        const rawId = String(f.id !== undefined && f.id !== null ? f.id : idx + 1)
        const cleanNum = (f.label || String(idx + 1)).replace(/^câu\s*/i, '').replace(/^question\s*/i, '').replace(/:\s*$/, '').trim() || String(idx + 1)
        return {
          id: rawId,
          label: `Question ${cleanNum}`,
          numBadge: cleanNum,
        }
      })
    }

    if (itemsList.some((item) => !answers[item.id]?.trim())) {
      addNotice(
        taskData.form_type === 'FORM_2_FILL'
          ? 'Enter all answers first.'
          : `Choose all ${itemsList.length} answers first.`
      )
      return
    }

    setIsSubmitting(true)

    try {
      let res: GradingResponse | null = null

      try {
        const { data, error } = await supabase.rpc('grade_student_attempt', {
          p_task_code: taskData.code,
          p_answers: answers,
          p_attempt_count: 1,
        })

        if (!error && data && data.success) {
          res = data as GradingResponse
        }
      } catch (rpcErr) {
        console.warn('RPC grading error, falling back to local grading:', rpcErr)
      }

      // Kiểm tra nếu server RPC trả về rỗng hoặc không có kết quả cho các câu hỏi
      const hasValidGrading = Boolean(
        res &&
        res.results &&
        Object.keys(res.results).length > 0 &&
        itemsList.some((item) => res?.results?.[item.id] !== undefined)
      )

      if (!hasValidGrading || !res) {
        res = gradeAnswersLocally(taskData, answers, 1)
      }

      setGradingResult(res)

      const wrong = itemsList
        .filter((item) => !res?.results?.[item.id]?.correct)
        .map((item) => item.id)

      if (wrong.length === 0) {
        // Làm đúng hết ngay lần đầu tiên!
        finish(100)
      } else {
        // Có câu sai: chuyển sang chế độ Guided Retry từng câu
        setInitialWrongIds(wrong)
        setQueue(wrong)
        setPhase('guided')

        const firstScore = Math.round(((itemsList.length - wrong.length) / itemsList.length) * 100)
        saveTaskAttempt({
          taskCode: task.code,
          score: firstScore,
          firstScore: firstScore,
          status: 'in_progress',
          supportMode: 'GUIDED',
          answersPayload: answers,
        })

        const wrongBadges = wrong.map((k) => {
          const match = itemsList.find((i) => i.id === k)
          return match?.numBadge || k
        })

        addNotice(
          <>
            Questions <strong>{wrongBadges.join(', ')}</strong> need another look. Keep your worksheet open.
          </>
        )

        schedule(() => {
          beginRetry(wrong[0], 1, res?.results)
        }, 350)
      }
    } catch (err: any) {
      addNotice(err?.message || 'Server connection error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 5. Học sinh nộp đáp án Retry từng câu (hỗ trợ Form 1 nút bấm và Form 2 ô nhập)
  const handleRetrySubmit = async (valOverride?: string) => {
    const valueToTest = (valOverride !== undefined ? valOverride : retryChosenValue).trim()
    if (activeId === null || feedback || isCheckingRetry || !taskData) return

    if (!valueToTest) {
      addNotice('Please enter your answer first.')
      return
    }

    setRetryChosenValue(valueToTest)
    setIsCheckingRetry(true)

    try {
      const updatedAnswers = { ...answers, [activeId]: valueToTest }
      let res: GradingResponse | null = null

      try {
        const { data, error } = await supabase.rpc('grade_student_attempt', {
          p_task_code: taskData.code,
          p_answers: updatedAnswers,
          p_attempt_count: attempt + 1,
        })

        if (!error && data && data.success) {
          res = data as GradingResponse
        }
      } catch (rpcErr) {
        console.warn('RPC retry grading error, falling back to local grading:', rpcErr)
      }

      if (!res || !res.results || res.results[activeId] === undefined) {
        res = gradeAnswersLocally(taskData, updatedAnswers, attempt + 1)
      }

      const isCorrect = res.results?.[activeId]?.correct === true

      if (isCorrect) {
        // ĐÚNG: hiển thị Correct ✓, cập nhật câu trả lời, chuyển sang câu sai kế tiếp
        setFeedback('Correct ✓')
        setAnswers(updatedAnswers)

        schedule(() => {
          const nextQueue = queue.filter((qId) => qId !== activeId)
          setQueue(nextQueue)

          if (nextQueue.length > 0) {
            // Còn câu sai tiếp theo trong hàng đợi -> chuyển sang câu đó
            beginRetry(nextQueue[0], 1, res?.results)
          } else {
            // Đã làm đúng hết toàn bộ các câu sai!
            const total = getTotalItems()
            const guidedScore = Math.max(Math.round(((total - initialWrongIds.length) / total) * 100), 80)
            finish(guidedScore)
          }
        }, 700)
      } else {
        // SAI: hiển thị Not yet, giữ học sinh ở lại câu này, cấp gợi ý sâu hơn
        setFeedback('Not yet.')
        setWrongValue(valueToTest)

        schedule(() => {
          const nextAttempt = attempt + 1
          setAttempt(nextAttempt)
          setFeedback('')
          setWrongValue('')
          setRetryChosenValue('')

          let itemRef: any = null
          let label = `Question ${activeId}`
          let cue = ''

          if (taskData.form_type === 'FORM_1_CHOICE') {
            const form1Config = taskData.content as Form1ChoiceConfig
            itemRef = form1Config.items?.find((i) => String(i.id) === activeId)
            label = itemRef?.label || `Question ${activeId}`
            cue = itemRef?.cue || `Look back at Question ${activeId}.`
          } else if (taskData.form_type === 'FORM_2_FILL') {
            const form2Config = taskData.content as any
            const rawList = form2Config?.fields || form2Config?.items || []
            itemRef = rawList.find((f: any, idx: number) => String(f.id !== undefined && f.id !== null ? f.id : idx + 1) === activeId)
            const cleanNum = (itemRef?.label || activeId).replace(/^câu\s*/i, '').replace(/^question\s*/i, '').replace(/:\s*$/, '').trim() || activeId
            label = `Question ${cleanNum}`
            cue = itemRef?.cue || `Look back at Question ${cleanNum} from the worksheet.`
          }

          const deepHint = getRandomHint(activeId, itemRef, res?.results)

          setCurrentHint(deepHint)
          addNotice(
            <>
              <strong>{label}</strong>
              <br />
              Not yet. {cue}
            </>
          )
        }, 700)
      }
    } catch (err: any) {
      addNotice(err?.message || 'Server connection error.')
    } finally {
      setIsCheckingRetry(false)
    }
  }

  // Xử lý chọn đáp án Retry cho FORM_1_CHOICE
  const handleRetryChoose = (opt: string) => {
    handleRetrySubmit(opt)
  }

  // 6. Xử lý nộp bài cho các form khác (FORM_4, FORM_5)
  const handleGenericSubmit = async () => {
    if (!taskData) return
    let payload: any = answers
    if (taskData.form_type === 'FORM_5_SEQUENCE') {
      if (sequenceOrder.some((val) => val === null)) {
        addNotice('Please complete all positions in the paragraph before submitting.')
        return
      }
      payload = sequenceOrder
    }

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('grade_student_attempt', {
        p_task_code: taskData.code,
        p_answers: payload,
        p_attempt_count: attempt,
      })

      if (error) {
        addNotice(`Grading error: ${error.message}`)
      } else if (data && data.success) {
        const res = data as GradingResponse
        setGradingResult(res)
        if (res.is_completed) {
          setIsCompleted(true)
          setShowCelebration(res.score >= 80)
          addNotice(`🎉 Task complete with ${res.score}/100 score.`)
        } else {
          setAttempt((prev) => prev + 1)
          addNotice(`Not quite (${res.correct_count}/${res.total_count} correct). Check the hints and try again!`)
        }
      }
    } catch (err: any) {
      addNotice(err?.message || 'Server connection error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 7. Xử lý nộp bài và chấm cho FORM_3_WRITING (Dạng 3.1, 3.2, 3.3)
  const handleWritingSubmit = async () => {
    if (!taskData || taskData.form_type !== 'FORM_3_WRITING') return
    const form3Config = taskData.content as Form3WritingConfig
    const subMode = form3Config?.sub_mode || 'FREE_SENTENCE'

    // ========================================================
    // DẠNG 3.3: VIẾT ĐOẠN VĂN (PARAGRAPH)
    // ========================================================
    if (subMode === 'PARAGRAPH') {
      const paragraphConfig = form3Config.paragraph || {
        prompt: 'Write a short paragraph.',
        min_words: 30,
        max_words: 100,
      }
      const paragraphText = (answers['paragraph'] || answers['1'] || '').trim()

      if (!paragraphText) {
        addNotice('Vui lòng nhập đoạn văn của bạn trước khi kiểm tra.')
        return
      }

      const words = paragraphText.split(/\s+/).filter(Boolean)
      if (words.length < 5) {
        addNotice('Đoạn văn quá ngắn. Vui lòng viết câu hoàn chỉnh.')
        return
      }

      setIsCheckingWriting(true)
      addNotice(
        <>
          🤖 <strong>AI Tutor:</strong> Đang phân tích đoạn văn, kiểm tra ngữ pháp và đối chiếu tiêu chí bài học...
        </>
      )

      try {
        const aiRes = await evaluateParagraphWithAI(paragraphText, paragraphConfig)

        const resultPayload = {
          correct: aiRes.is_correct,
          score: aiRes.score,
          feedback_vi: aiRes.feedback_vi,
          feedback_en: aiRes.feedback_en,
          word_count: aiRes.word_count,
          criteria_met: (aiRes.criteria_evaluations || []).map((c) => ({
            criterion: c.name,
            passed: c.passed,
            comment: c.feedback,
          })),
          suggestions: aiRes.suggestions,
        }

        const newResults: Record<string, any> = {
          paragraph: resultPayload,
          '1': resultPayload,
        }

        setWritingResults(newResults)

        if (aiRes.is_correct) {
          setIsCompleted(true)
          setShowCelebration(true)
          const approvedSentences = paragraphText
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
          saveApprovedWriting(task.code, approvedSentences, paragraphText)
          saveTaskAttempt({
            taskCode: task.code,
            score: aiRes.score,
            firstScore: aiRes.score,
            status: 'completed',
            supportMode: 'INDEPENDENT',
            answersPayload: answers,
          })
          addNotice(
            <>
              🎉 <strong>Task complete ✓</strong> Đoạn văn của bạn đã đạt tiêu chuẩn ({aiRes.score}/100 điểm)!
            </>
          )
        } else {
          saveTaskAttempt({
            taskCode: task.code,
            score: aiRes.score,
            firstScore: aiRes.score,
            status: 'in_progress',
            supportMode: 'GUIDED',
            answersPayload: answers,
          })
          addNotice(
            <>
              💡 <strong>AI Tutor Feedback:</strong> Đoạn văn cần cải thiện ({aiRes.score}/100 điểm). Hãy xem góp ý và chỉnh sửa lại nhé!
            </>
          )
        }
      } catch (err: any) {
        addNotice(`Lỗi chấm đoạn văn: ${err?.message || 'Không thể đánh giá đoạn văn.'}`)
      } finally {
        setIsCheckingWriting(false)
      }
      return
    }

    // ========================================================
    // DẠNG 3.1 VÀ 3.2: TỪNG CÂU HỎI VIẾT (SENTENCES)
    // ========================================================
    const items = form3Config?.items || []

    if (items.length === 0) return

    // Kiểm tra xem tất cả các câu đã được nhập chưa
    const emptyItems = items.filter((item, idx) => {
      const id = String(item.id || idx + 1)
      return !answers[id] || !answers[id].trim()
    })

    if (emptyItems.length > 0) {
      addNotice('Vui lòng viết câu trả lời cho tất cả các câu hỏi trước khi kiểm tra.')
      return
    }

    setIsCheckingWriting(true)

    try {
      const newResults: Record<
        string,
        {
          correct: boolean
          hint?: string
          feedback_vi?: string
          feedback_en?: string
          missingWords?: string[]
          score?: number
        }
      > = {}

      // BƯỚC 1: KIỂM TRA TỪ KHÓA BẮT BUỘC (Keyword Matching cho Dạng 3.2 hoặc bài có required_words)
      let anyKeywordFailed = false
      const missingItemsList: string[] = []

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        const id = String(item.id || idx + 1)
        const rawSentence = (answers[id] || '').trim()
        const sentence = buildFullSentence(rawSentence, item.sentence_starter, item.sentence_ending)
        const reqWords = item.required_words || []

        if (reqWords.length > 0) {
          const kwCheck = checkRequiredKeywords(sentence, reqWords)
          if (!kwCheck.passed) {
            anyKeywordFailed = true
            missingItemsList.push(item.label || `Question ${idx + 1}`)
            newResults[id] = {
              correct: false,
              missingWords: kwCheck.missingWords,
              hint: `Missing target word: ${kwCheck.missingWords.join(', ')}`,
              feedback_vi: subMode === 'BOOK_KEYWORD'
                ? 'Bạn chưa dùng đủ từ gợi ý từ sách bài tập. Hãy mở sách đối chiếu và bổ sung vào câu nhé!'
                : `Câu chưa có từ bắt buộc: "${kwCheck.missingWords.join(', ')}". Hãy bổ sung từ này vào câu nhé!`,
              feedback_en: `Missing required word(s): "${kwCheck.missingWords.join(', ')}".`,
              score: 40,
            }
          }
        }
      }

      // NẾU CÓ CÂU THIẾU TỪ BẮT BUỘC -> DỪNG NGAY BƯỚC 1, KHÔNG GỌI AI
      if (anyKeywordFailed) {
        setWritingResults((prev) => ({ ...(prev || {}), ...newResults }))
        addNotice(
          subMode === 'BOOK_KEYWORD' ? (
            <>
              📖 <strong>Kiểm tra từ gợi ý:</strong> {missingItemsList.join(', ')} chưa dùng đủ từ gợi ý trong sách bài tập. Hãy mở sách kiểm tra lại trước khi AI chấm ngữ pháp nhé!
            </>
          ) : (
            <>
              ⚠️ <strong>Keyword check:</strong> {missingItemsList.join(', ')} missing required word(s). Please include all target words before AI evaluates your grammar.
            </>
          )
        )
        setIsCheckingWriting(false)
        return
      }

      // BƯỚC 2: GỌI AI ĐÁNH GIÁ NGỮ PHÁP (Gemini AI / Heuristic fallback)
      addNotice(
        <>
          🤖 <strong>AI Tutor:</strong> {subMode === 'BOOK_KEYWORD' ? 'Đã đủ từ gợi ý! ' : ''}Đang kiểm tra ngữ pháp và cấu trúc câu...
        </>
      )

      const generalCriteria = (taskData.content as Form3WritingConfig)?.scoring_criteria

      const itemsToEvaluate = items.map((item, idx) => {
        const id = String(item.id || idx + 1)
        const rawSentence = (answers[id] || '').trim()
        const sentence = buildFullSentence(rawSentence, item.sentence_starter, item.sentence_ending)
        return {
          id,
          prompt: item.prompt || item.label,
          label: item.label,
          sentence,
          required_words: item.required_words,
          hints: item.hints,
          scoring_criteria: item.scoring_criteria,
        }
      })

      const batchResults = await evaluateBatchSentencesWithAI(
        itemsToEvaluate,
        subMode,
        undefined,
        generalCriteria,
      )

      let allGrammarCorrect = true
      let totalScore = 0

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        const id = String(item.id || idx + 1)
        const aiRes = batchResults[id] || {
          is_correct: false,
          score: 0,
          feedback_vi: 'Chưa thể đánh giá câu này.',
          feedback_en: 'Could not evaluate this sentence.',
          error_type: 'grammar' as const,
        }

        totalScore += aiRes.score

        if (!aiRes.is_correct) {
          allGrammarCorrect = false
        }

        newResults[id] = {
          correct: aiRes.is_correct,
          hint: aiRes.feedback_en,
          feedback_vi: aiRes.feedback_vi,
          feedback_en: aiRes.feedback_en,
          score: aiRes.score,
        }
      }

      const averageScore = Math.round(totalScore / items.length)
      setWritingResults(newResults)

      if (allGrammarCorrect) {
        setIsCompleted(true)
        setShowCelebration(true)
        setPhase('complete')
        const approvedSentences = items
          .map((item, idx) => {
            const id = String(item.id || idx + 1)
            return buildFullSentence(answers[id] || '', item.sentence_starter, item.sentence_ending)
          })
          .filter(Boolean)
        saveApprovedWriting(task.code, approvedSentences)
        saveTaskAttempt({
          taskCode: task.code,
          score: 100,
          firstScore: 100,
          status: 'completed',
          supportMode: 'INDEPENDENT',
          answersPayload: answers,
        })
        addNotice(
          <>
            🎉 <strong>Task complete ✓</strong> Tất cả các câu đã chính xác về ngữ pháp và cấu trúc!
          </>
        )
      } else {
        const wrongIds = items
          .filter((item, idx) => {
            const id = String(item.id || idx + 1)
            return !newResults[id]?.correct
          })
          .map((item, idx) => String(item.id || idx + 1))

        setInitialWrongIds(wrongIds)
        setQueue(wrongIds)
        setPhase('guided')

        const firstWrongId = wrongIds[0]
        setActiveId(firstWrongId)
        setAttempt(1)
        setFeedback('')
        setRetryChosenValue(answers[firstWrongId] || '')

        const firstWrongItem = items.find((i, idx) => String(i.id || idx + 1) === firstWrongId)
        const firstHint = firstWrongItem?.hints?.[0] || newResults[firstWrongId]?.hint || ''
        setCurrentHint(firstHint)

        saveTaskAttempt({
          taskCode: task.code,
          score: averageScore,
          firstScore: averageScore,
          status: 'in_progress',
          supportMode: 'GUIDED',
          answersPayload: answers,
        })

        const wrongLabels = wrongIds.map((id) => {
          const item = items.find((i, idx) => String(i.id || idx + 1) === id)
          return item?.label || `Question ${id}`
        })

        addNotice(
          <>
            💡 <strong>AI Tutor:</strong> Câu <strong>{wrongLabels.join(', ')}</strong> cần chỉnh sửa lại. Hệ thống đã mang câu xuống khung bên dưới để bạn sửa cùng AI nhé!
          </>
        )

        schedule(() => scrollToLatest(), 80)
      }
    } catch (err: any) {
      addNotice(`Evaluation error: ${err?.message || 'Unable to check writing.'}`)
    } finally {
      setIsCheckingWriting(false)
    }
  }

  // 7B. Xử lý nộp câu sửa lại cho FORM_3_WRITING (sửa từng câu ở khung bên dưới)
  const handleWritingRetrySubmit = async () => {
    if (activeId === null || feedback === 'Correct ✓' || isCheckingRetry || !taskData) return
    const form3Config = taskData.content as Form3WritingConfig
    const items = form3Config?.items || []
    const activeItem = items.find((i, idx) => String(i.id || idx + 1) === activeId)
    if (!activeItem) return

    const rawValue = retryChosenValue.trim()
    if (!rawValue) {
      addNotice('Vui lòng nhập câu đã sửa của bạn.')
      return
    }

    const fullRetrySentence = buildFullSentence(rawValue, activeItem.sentence_starter, activeItem.sentence_ending)

    setIsCheckingRetry(true)

    try {
      // 1. Kiểm tra từ khóa nếu là BOOK_KEYWORD
      if (form3Config.sub_mode === 'BOOK_KEYWORD' && activeItem.required_words?.length) {
        const kwCheck = checkRequiredKeywords(fullRetrySentence, activeItem.required_words)
        if (!kwCheck.passed) {
          setFeedback(`Chưa đủ từ gợi ý trong sách: ${kwCheck.missingWords.join(', ')}`)
          setIsCheckingRetry(false)
          return
        }
      }

      // 2. Chấm AI cho câu sửa lại
      const aiRes = await evaluateSentenceWithAI(
        fullRetrySentence,
        activeItem,
        undefined,
        form3Config?.scoring_criteria,
      )

      if (aiRes.is_correct) {
        setFeedback('Correct ✓')
        const updatedAnswers = { ...answers, [activeId]: rawValue }
        setAnswers(updatedAnswers)

        setWritingResults((prev) => ({
          ...(prev || {}),
          [activeId]: {
            correct: true,
            score: 100,
            feedback_vi: 'Chính xác! Câu của bạn đã hoàn toàn chuẩn ngữ pháp.',
            feedback_en: 'Correct!',
          },
        }))

        schedule(() => {
          const nextQueue = queue.filter((qId) => qId !== activeId)
          setQueue(nextQueue)

          if (nextQueue.length > 0) {
            // Còn câu sai tiếp theo trong hàng đợi
            const nextId = nextQueue[0]
            setActiveId(nextId)
            setAttempt(1)
            setFeedback('')
            setRetryChosenValue(updatedAnswers[nextId] || '')
            const nextItem = items.find((i, idx) => String(i.id || idx + 1) === nextId)
            const nextHint = nextItem?.hints?.[0] || writingResults?.[nextId]?.hint || ''
            setCurrentHint(nextHint)
            addNotice(
              <>
                🎉 <strong>{activeItem.label || `Question ${activeId}`}:</strong> Đã sửa đúng ✓. Tiếp theo, hãy cùng xem lại <strong>{nextItem?.label || `Question ${nextId}`}</strong> nhé!
              </>
            )
            schedule(() => scrollToLatest(), 80)
          } else {
            // Đã sửa đúng hết tất cả các câu sai!
            setIsCompleted(true)
            setShowCelebration(true)
            setPhase('complete')
            setActiveId(null)
            const approvedSentences = items
              .map((item, idx) => {
                const id = String(item.id || idx + 1)
                const val = (updatedAnswers[id] || '').trim()
                return buildFullSentence(val, item.sentence_starter, item.sentence_ending)
              })
              .filter(Boolean)
            saveApprovedWriting(task.code, approvedSentences)
            saveTaskAttempt({
              taskCode: task.code,
              score: 100,
              firstScore: 100,
              status: 'completed',
              supportMode: 'GUIDED',
              answersPayload: updatedAnswers,
            })
            addNotice(
              <>
                🎉 <strong>Task complete ✓</strong> Bạn đã sửa đúng tất cả các câu! Tuyệt vời!
              </>
            )
            schedule(() => scrollToLatest(), 80)
          }
        }, 800)
      } else {
        // Vẫn còn lỗi ngữ pháp
        setFeedback(aiRes.feedback_vi || 'Câu vẫn chưa hoàn toàn chính xác.')
        const nextAttempt = attempt + 1
        setAttempt(nextAttempt)

        const hints = activeItem.hints || []
        if (hints.length >= nextAttempt) {
          setCurrentHint(hints[nextAttempt - 1])
        }

        setWritingResults((prev) => ({
          ...(prev || {}),
          [activeId]: {
            correct: false,
            score: aiRes.score,
            feedback_vi: aiRes.feedback_vi,
            feedback_en: aiRes.feedback_en,
            hint: aiRes.feedback_en,
          },
        }))

        addNotice(
          <>
            💡 <strong>{activeItem.label || `Question ${activeId}`}:</strong> {aiRes.feedback_vi || 'Câu vẫn chưa chuẩn ngữ pháp. Hãy xem gợi ý và sửa lại nhé!'}
          </>
        )
        schedule(() => scrollToLatest(), 100)
      }
    } catch (err: any) {
      addNotice(`Lỗi kiểm tra câu: ${err?.message || 'Không thể kiểm tra câu viết.'}`)
    } finally {
      setIsCheckingRetry(false)
    }
  }

  // 8. Chức năng LÀM LẠI BÀI (Restart from scratch)
  const handleRestart = () => {
    shownHintsRef.current = {}
    if (taskData?.form_type === 'FORM_5_SEQUENCE') {
      initAnswers('FORM_5_SEQUENCE', taskData.content)
    } else {
      setAnswers({})
    }
    setPhase('entry')
    setInitialWrongIds([])
    setQueue([])
    setActiveId(null)
    setAttempt(1)
    setFeedback('')
    setWrongValue('')
    setRetryChosenValue('')
    setCurrentHint('')
    setIsSubmitting(false)
    setIsCheckingRetry(false)
    setWritingResults(null)
    setIsCheckingWriting(false)
    setListenCount(0)
    setHasStartedWorksheet(false)
    setIsCompleted(false)
    setShowCelebration(false)
    setGradingResult(null)
    setNotices([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.dispatchEvent(new CustomEvent('restart-task', { detail: { taskCode: task.code } }))
  }

  if (loading || !taskData) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-muted)' }}>
        Loading task configuration...
      </div>
    )
  }

  const isGuidedForm = taskData.form_type === 'FORM_1_CHOICE' || taskData.form_type === 'FORM_2_FILL'
  const form1Config = taskData.form_type === 'FORM_1_CHOICE' ? (taskData.content as Form1ChoiceConfig) : null
  const form2Config = taskData.form_type === 'FORM_2_FILL' ? (taskData.content as Form2FillConfig) : null

  const form1Items = form1Config?.items || []
  const form1Options = form1Config?.options || ['A', 'B', 'C']
  const rawForm2Fields = (form2Config as any)?.fields || (form2Config as any)?.items || []
  const form2Fields: BlankFieldConfig[] = Array.isArray(rawForm2Fields) ? rawForm2Fields : []

  // Chuẩn hóa danh sách câu hỏi cho cả Form 1, Form 2 và Form 3
  const allQuestionItems: {
    id: string
    label: string
    numBadge: string
    cue?: string
    audio_url?: string
    sentence_starter?: string
    sentence_ending?: string
  }[] =
    taskData.form_type === 'FORM_1_CHOICE'
      ? form1Items.map((i) => ({
          id: String(i.id),
          label: i.label || `Question ${i.id}`,
          numBadge: String(i.id),
          cue: i.cue,
          audio_url: i.audio_url || i.audioUrl,
        }))
      : taskData.form_type === 'FORM_2_FILL'
      ? form2Fields.map((f, idx) => {
          const rawId = String(f.id !== undefined && f.id !== null ? f.id : idx + 1)
          const cleanNum =
            (f.label || String(idx + 1))
              .replace(/^câu\s*/i, '')
              .replace(/^question\s*/i, '')
              .replace(/:\s*$/, '')
              .trim() || String(idx + 1)
          return {
            id: rawId,
            label: `Question ${cleanNum}`,
            numBadge: cleanNum,
            cue: f.cue || `Look back at Question ${cleanNum} from the worksheet.`,
          }
        })
      : taskData.form_type === 'FORM_3_WRITING'
      ? ((taskData.content as Form3WritingConfig)?.items || []).map((item, idx) => ({
          id: String(item.id || idx + 1),
          label: item.label || `Question ${idx + 1}`,
          numBadge: String(idx + 1),
          cue: item.cue || `Look back at Question ${idx + 1} from your worksheet.`,
          sentence_starter: item.sentence_starter,
          sentence_ending: item.sentence_ending,
        }))
      : []

  const totalItemsCount = allQuestionItems.length || 1
  const currentRetryItem = activeId !== null ? allQuestionItems.find((i) => i.id === activeId) : null

  const audioUrl: string | null =
    (taskData?.content as any)?.audioUrl ||
    (taskData?.content as any)?.audio_url ||
    (taskData as any)?.audio_url ||
    null

  const hasAudio = Boolean(audioUrl && audioUrl.trim())
  const isAudioUnlocked = !hasAudio || listenCount >= 1
  const isWorksheetVisible = !hasAudio || (isAudioUnlocked && hasStartedWorksheet)

  const handleListenComplete = (newCount: number) => {
    setListenCount(newCount)
    if (newCount >= 1) {
      addNotice('🎉 Listening complete! Click "Start Worksheet" below to begin answering.')
    }
  }

  const introText =
    (taskData.content as any)?.intro ||
    (taskData.form_type === 'FORM_2_FILL'
      ? 'Check Task 1. Enter your answers from the worksheet.'
      : taskData.form_type === 'FORM_4_SPEAKING'
      ? 'Read aloud the sentences you wrote in the previous writing task. AI will evaluate your pronunciation clarity.'
      : taskData.form_type === 'FORM_5_LISTEN_REPEAT'
      ? 'Listen to each audio clip carefully. Repeat aloud into your microphone to get scored.'
      : taskData.form_type === 'FORM_6_1_PROFILE_QA'
      ? "Look at your new classmate's profile. Listen to the AI Coach and answer."
      : taskData.form_type === 'FORM_6_2_INTERVIEW_PROFILE'
      ? 'Ask AI Tutor, fill in the profile, and hit Submit!'
      : 'Enter your answers below.')

  const isCustomInteractiveForm =
    taskData.form_type === 'FORM_4_SPEAKING' ||
    taskData.form_type === 'FORM_5_LISTEN_REPEAT' ||
    taskData.form_type === 'FORM_6_1_PROFILE_QA' ||
    taskData.form_type === 'FORM_6_2_INTERVIEW_PROFILE'

  return (
    <InteractiveTaskFrame
      task={task}
      className={`task-${task.code} dynamic-task-runner guided-choice-task`}
      chatRef={chatRef}
      footer={
        <StatusFooter
          title={isCompleted ? `${task.title} • Complete ✓` : task.title}
          status={
            !isAudioUnlocked
              ? `Listening required (${listenCount}/1 play)`
              : hasAudio && !hasStartedWorksheet
              ? 'Audio finished ✓ • Ready to start'
              : isCompleted
              ? 'All answers are correct ✓'
              : phase === 'guided' && activeId !== null
              ? `Reviewing: ${currentRetryItem?.label || `Question ${activeId}`} (${queue.length} left)`
              : taskData.form_type === 'FORM_4_SPEAKING'
              ? (isCompleted ? 'Speaking complete ✓' : 'Practice speaking aloud')
              : taskData.form_type === 'FORM_5_LISTEN_REPEAT'
              ? (isCompleted ? 'Listen & Repeat complete ✓' : 'Listen & repeat each sentence (> 80% to pass)')
              : taskData.form_type === 'FORM_6_1_PROFILE_QA'
              ? (isCompleted ? 'Profile Q&A complete ✓' : 'Listen & answer questions about classmate')
              : taskData.form_type === 'FORM_6_2_INTERVIEW_PROFILE'
              ? (isCompleted ? 'Profile filled ✓' : 'Ask AI Tutor to fill in the profile')
              : taskData.form_type === 'FORM_3_WRITING'
              ? `${(taskData.content as Form3WritingConfig)?.items?.length || 1} writing questions`
              : `${totalItemsCount} questions`
          }
          actionLabel={
            !isAudioUnlocked
              ? 'Listen first'
              : hasAudio && !hasStartedWorksheet
              ? 'Start Worksheet'
              : isCompleted
              ? '🔄 Try again'
              : phase === 'guided'
              ? 'Reviewing...'
              : isCustomInteractiveForm
              ? (isCompleted ? '🎉 Complete ✓' : 'Complete in task above')
              : isSubmitting || isCheckingWriting
              ? 'Checking...'
              : 'Check'
          }
          actionId="footerActionBtn"
          disabled={!isAudioUnlocked || phase === 'guided' || isSubmitting || isCheckingWriting || (isCustomInteractiveForm && !isCompleted)}
          onAction={
            isCompleted
              ? handleRestart
              : hasAudio && !hasStartedWorksheet
              ? () => {
                  setHasStartedWorksheet(true)
                  addNotice('📝 Worksheet opened! Answer the questions, then click Check.')
                }
              : isGuidedForm
              ? handleInitialCheck
              : taskData.form_type === 'FORM_3_WRITING'
              ? handleWritingSubmit
              : isCustomInteractiveForm
              ? () => navigate('/?mode=code')
              : handleGenericSubmit
          }
        />
      }
    >
      <div className="task-flow" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '200px' }}>
        {/* 1. Lời thoại Gia sư AI mở đầu (chỉ hiển thị introText, đã bỏ tiêu đề bài học vì đã có ở header) */}
        <TutorBubble>
          {introText}
        </TutorBubble>

        {/* BỘ PHÁT ÂM THANH BÀI NGHE (CHỈ HIỆN KHI BÀI TẬP CÓ FILE AUDIO) */}
        {hasAudio && audioUrl && (
          <TaskAudioPlayer
            src={audioUrl}
            title={`${task.title} • Listening`}
            requiredListens={1}
            listenCount={listenCount}
            onListenComplete={handleListenComplete}
            hasStartedWorksheet={hasStartedWorksheet}
            onStartWorksheet={() => {
              setHasStartedWorksheet(true)
              addNotice('📝 Worksheet opened! Enter your answers below, then click Check.')
            }}
          />
        )}

        {/* 2A. FORM 1: BẢNG MA TRẬN NHẬP ĐÁP ÁN BAN ĐẦU (khi phase === 'entry' và isWorksheetVisible) */}
        {taskData.form_type === 'FORM_1_CHOICE' && phase === 'entry' && isWorksheetVisible && (
          <section className="task-panel card" style={{ position: 'relative' }}>
            <div className="ch">
              <h2>Your answers</h2>
              <span>{form1Items.length} items</span>
            </div>
            <div className="cb">
              <AnswerChoiceMatrix
                layout="table"
                rows={form1Items.map((item) => ({
                  id: String(item.id),
                  prompt: item.id,
                  options: form1Options.map((value) => ({ value, label: value })),
                }))}
                values={answers}
                disabled={isSubmitting}
                onChange={handleAnswerChange}
              />
              <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <ActionButton
                  id="initialCheckBtn"
                  disabled={isSubmitting}
                  onClick={handleInitialCheck}
                >
                  {isSubmitting ? 'Checking...' : 'Check'}
                </ActionButton>
              </div>
              <div className="note" style={{ marginTop: '12px' }}>
                Use the worksheet questions while entering your choices.
              </div>
            </div>
          </section>
        )}

        {/* 2B. FORM 2: BẢNG NHẬP ĐÁP ÁN THEO GIAO DIỆN 60111 (khi phase === 'entry' và isWorksheetVisible) */}
        {taskData.form_type === 'FORM_2_FILL' && phase === 'entry' && isWorksheetVisible && (
          <section className="task-panel card" style={{ padding: '16px', position: 'relative' }}>
            <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '15px' }}>Your answers</h2>
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{allQuestionItems.length} items</span>
            </div>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                handleInitialCheck()
              }}
            >
              {allQuestionItems.map((item) => {
                const fieldCfg = form2Fields.find((f, idx) => String(f.id !== undefined && f.id !== null ? f.id : idx + 1) === item.id) || form2Fields[parseInt(item.id, 10) - 1]
                return (
                  <div
                    key={item.id}
                    className="field"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '36px minmax(0, 1fr)',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      className="field-num"
                      style={{
                        display: 'grid',
                        width: '32px',
                        height: '32px',
                        placeItems: 'center',
                        borderRadius: '9px',
                        color: '#4b5563',
                        background: '#f4f6f8',
                        fontSize: '13px',
                        fontWeight: 800,
                      }}
                    >
                      {item.numBadge}
                    </span>
                    <input
                      id={item.id}
                      autoComplete="off"
                      value={answers[item.id] || ''}
                      placeholder={fieldCfg?.placeholder || 'Your answer (a, b, c, d or word/phrase)'}
                      onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d9dde4',
                        borderRadius: '12px',
                        outline: 'none',
                        fontSize: '15px',
                        background: 'var(--color-surface, #ffffff)',
                        cursor: 'text',
                      }}
                    />
                  </div>
                )
              })}
              <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <ActionButton id="initialCheckBtn" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Checking...' : 'Check'}
                </ActionButton>
              </div>
              <div className="note" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-muted)' }}>
                Use the worksheet questions while entering your answers (letters a, b, c, d or words/phrases).
              </div>
            </form>
          </section>
        )}

        {/* FORM 3: VIẾT CÂU HOẶC ĐOẠN VĂN (TASK 60115 / DẠNG 3.1, 3.2, 3.3) */}
        {taskData.form_type === 'FORM_3_WRITING' && isWorksheetVisible && (
          <SentenceWritingRenderer
            config={taskData.content as Form3WritingConfig}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            results={writingResults}
            disabled={isCompleted || isCheckingWriting}
            isChecking={isCheckingWriting}
            onSubmit={handleWritingSubmit}
            onRestart={handleRestart}
            isCompleted={isCompleted}
            onNavigateHome={() => navigate('/?mode=code')}
            phase={phase}
            activeRetryId={activeId}
          />
        )}

        {/* 3. BẢNG KẾT QUẢ TỔNG QUAN LẦN 1 (khi có câu sai và đang ở phase 'guided') */}
        {isGuidedForm && phase === 'guided' && (
          <section className="task-panel card">
            <div className="ch">
              <h2>Check results</h2>
              <span>{allQuestionItems.length - initialWrongIds.length}/{allQuestionItems.length} correct</span>
            </div>
            <div className="cb">
              {allQuestionItems.map((item) => {
                const isWrong = initialWrongIds.includes(item.id)
                return (
                  <div className="result" key={item.id}>
                    <span>{item.label}</span>
                    <StatusTag tone={isWrong ? 'error' : 'success'}>
                      {isWrong ? 'Try again' : 'Correct ✓'}
                    </StatusTag>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 4. DÒNG CHAT CỦA GIA SƯ AI */}
        {notices.map((notice) => (
          <TutorBubble key={notice.id}>
            {notice.content}
          </TutorBubble>
        ))}

        {/* 5A. FORM 1 RETRY CARD */}
        {taskData.form_type === 'FORM_1_CHOICE' && phase === 'guided' && activeId !== null && (
          <section className="retry guided-choice-retry is-active-guided" data-stage="retry" data-attempt={attempt}>
            <div className="retry-head">
              <strong>{currentRetryItem?.label || `Question ${activeId}`}</strong>
              <StatusTag tone="warning">Attempt {attempt}</StatusTag>
            </div>
            {currentRetryItem?.audio_url && (
              <div
                className="item-retry-audio-box"
                style={{
                  margin: '10px 0 12px',
                  padding: '10px 14px',
                  background: 'var(--color-surface, #f8fafc)',
                  borderRadius: '10px',
                  border: '1px solid var(--color-line, #e2e8f0)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 650,
                    color: '#334155',
                  }}
                >
                  <span>🎧 Nghe lại đoạn âm thanh của câu này:</span>
                </div>
                <audio
                  controls
                  src={currentRetryItem.audio_url}
                  style={{ width: '100%', height: '36px' }}
                />
              </div>
            )}
            <div
              className={`hint ${attempt > 1 ? 'deep' : ''}`}
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: attempt > 1 ? '#fff7ed' : '#fdf2f8',
                color: attempt > 1 ? '#9a3412' : '#831843',
                border: attempt > 1 ? '1.5px solid #fed7aa' : '1.5px solid #fbcfe8',
                fontSize: '13.5px',
                lineHeight: '1.5',
                boxShadow: '0 2px 8px rgba(244, 63, 94, 0.05)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: attempt > 1 ? '#c2410c' : '#be185d',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span style={{ fontSize: '14px' }}>💡</span>
                <span>GỢI Ý ĐÁP ÁN{attempt > 1 ? ' (LẦN 2)' : ''}:</span>
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: attempt > 1 ? '#7c2d12' : '#4c0519' }}>
                {currentHint}
              </div>
            </div>
            <ChoiceGroup
              ariaLabel={`${currentRetryItem?.label || `Question ${activeId}`} retry`}
              options={form1Options.map((value) => ({ value, label: value }))}
              value={feedback === 'Correct ✓' ? answers[String(activeId)] : retryChosenValue || undefined}
              wrongValue={wrongValue}
              disabled={Boolean(feedback) || isCheckingRetry}
              onChange={handleRetryChoose}
            />
            <div className={`micro ${feedback === 'Correct ✓' ? 'ok' : feedback ? 'bad' : ''}`}>
              {feedback}
            </div>
          </section>
        )}

        {/* 5B. FORM 2 RETRY CARD (DỰA THEO 60111: INPUT + CHECK BUTTON + CÂU HỎI TIẾP THEO KHI LÀM ĐÚNG) */}
        {taskData.form_type === 'FORM_2_FILL' && phase === 'guided' && activeId !== null && (
          <section
            className="retry guided-choice-retry is-active-guided"
            data-stage="retry"
            data-attempt={attempt}
            style={{
              padding: '16px',
              background: 'var(--color-surface-soft, #fdf8f9)',
              border: '1px solid var(--color-primary-border, #f0c3d9)',
              borderRadius: '14px',
            }}
          >
            <div
              className="retry-head"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <strong style={{ fontSize: '14px' }}>{currentRetryItem?.label || `Question ${activeId}`}</strong>
              <StatusTag tone="warning">Attempt {attempt}</StatusTag>
            </div>
            <div
              className={`hint ${attempt > 1 ? 'deep' : ''}`}
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: attempt > 1 ? '#fff7ed' : '#fdf2f8',
                color: attempt > 1 ? '#9a3412' : '#831843',
                border: attempt > 1 ? '1.5px solid #fed7aa' : '1.5px solid #fbcfe8',
                fontSize: '13.5px',
                lineHeight: '1.5',
                boxShadow: '0 2px 8px rgba(244, 63, 94, 0.05)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: attempt > 1 ? '#c2410c' : '#be185d',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span style={{ fontSize: '14px' }}>💡</span>
                <span>GỢI Ý ĐÁP ÁN{attempt > 1 ? ' (LẦN 2)' : ''}:</span>
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: attempt > 1 ? '#7c2d12' : '#4c0519' }}>
                {currentHint}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id={`retry-${activeId}`}
                autoFocus
                autoComplete="off"
                value={retryChosenValue}
                placeholder="Type your answer (a, b, c, d or word/phrase)"
                disabled={Boolean(feedback) || isCheckingRetry}
                onChange={(e) => setRetryChosenValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRetrySubmit()
                  }
                }}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  border: '1px solid #d9dde4',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  background: 'var(--color-surface, #ffffff)',
                }}
              />
              <ActionButton
                disabled={Boolean(feedback) || isCheckingRetry || !retryChosenValue.trim()}
                onClick={() => handleRetrySubmit()}
              >
                {isCheckingRetry ? 'Checking...' : 'Check'}
              </ActionButton>
            </div>
            <div
              className={`micro ${feedback === 'Correct ✓' ? 'ok' : feedback ? 'bad' : ''}`}
              style={{
                marginTop: '10px',
                minHeight: '20px',
                fontWeight: 600,
                color: feedback === 'Correct ✓' ? 'var(--color-success, #16a34a)' : 'var(--color-error, #dc2626)',
              }}
            >
              {feedback}
            </div>
          </section>
        )}

        {/* 5C. FORM 3 RETRY CARD (MANG TỪNG CÂU SAI XUỐNG DƯỚI ĐỂ SỬA CÙNG AI) */}
        {taskData.form_type === 'FORM_3_WRITING' &&
          (taskData.content as Form3WritingConfig)?.sub_mode !== 'PARAGRAPH' &&
          phase === 'guided' &&
          activeId !== null && (
            <section
              className="retry guided-choice-retry guided-sentence-repair-card is-active-guided"
              data-stage="retry"
              data-attempt={attempt}
              style={{
                padding: '18px 20px',
                background: '#ffffff',
                border: '1.5px solid #fbcfe8',
                borderRadius: '16px',
                boxShadow: '0 4px 14px rgba(219, 39, 119, 0.08)',
              }}
            >
              <div
                className="retry-head"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#f43f5e',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {currentRetryItem?.numBadge || activeId}
                  </span>
                  <strong style={{ fontSize: '15px', color: '#1f2937' }}>
                    {currentRetryItem?.label || `Question ${activeId}`}
                  </strong>
                </div>
                <StatusTag tone="warning">Lần sửa {attempt}</StatusTag>
              </div>

              {/* Câu học sinh đã viết ban đầu */}
              <div
                className="original-sentence-box"
                style={{
                  marginBottom: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '2px' }}>
                  ✍️ Câu bạn đã viết ban đầu:
                </span>
                <span style={{ color: '#374151', fontStyle: 'italic', fontWeight: 500 }}>
                  "{buildFullSentence(answers[activeId] || '', currentRetryItem?.sentence_starter, currentRetryItem?.sentence_ending) || '—'}"
                </span>
              </div>

              {/* Tag sách nếu là BOOK_KEYWORD */}
              {(taskData.content as Form3WritingConfig)?.sub_mode === 'BOOK_KEYWORD' && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '10px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: '#f3e8ff',
                    color: '#6b21a8',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <span>📖</span>
                  <span>Hãy đối chiếu từ gợi ý trong sách bài tập</span>
                </div>
              )}

              {/* Nhận xét / Gợi ý của AI */}
              <div
                className={`hint ${attempt > 1 ? 'deep' : ''}`}
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#fdf2f8',
                  border: '1px solid #fce7f3',
                  color: '#831843',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🤖 AI Tutor góp ý:</span>
                </div>
                <div>
                  {writingResults?.[activeId]?.feedback_vi ||
                    currentHint ||
                    'Hãy kiểm tra lại ngữ pháp và viết lại câu hoàn chỉnh nhé!'}
                </div>
                {writingResults?.[activeId]?.hint &&
                  writingResults?.[activeId]?.hint !== writingResults?.[activeId]?.feedback_vi && (
                    <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#9d174d', opacity: 0.9 }}>
                      💡 Gợi ý cấu trúc: <em>{writingResults[activeId].hint}</em>
                    </div>
                  )}
              </div>

              {/* Ô nhập câu đã sửa và nút Kiểm tra */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div
                  className="sentence-input-wrapper"
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    display: 'flex',
                    alignItems: 'center',
                    border: '1.5px solid #d9dde4',
                    borderRadius: '12px',
                    background: '#ffffff',
                    overflow: 'hidden',
                  }}
                >
                  {currentRetryItem?.sentence_starter && (
                    <span
                      className="sentence-starter-prefix"
                      title="Phần đầu câu cho trước"
                    >
                      {currentRetryItem.sentence_starter}
                    </span>
                  )}
                  <input
                    id={`retry-writing-${activeId}`}
                    autoFocus
                    autoComplete="off"
                    value={retryChosenValue}
                    placeholder={
                      currentRetryItem?.sentence_starter
                        ? 'viết tiếp phần còn lại của câu...'
                        : 'Nhập lại câu hoàn chỉnh sau khi sửa...'
                    }
                    disabled={feedback === 'Correct ✓' || isCheckingRetry}
                    onChange={(e) => setRetryChosenValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleWritingRetrySubmit()
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '11px 14px',
                      border: 'none',
                      outline: 'none',
                      fontSize: '15px',
                      background: 'transparent',
                    }}
                  />
                  {currentRetryItem?.sentence_ending && (
                    <span
                      className="sentence-starter-suffix"
                      title="Phần kết câu cho trước"
                    >
                      {currentRetryItem.sentence_ending}
                    </span>
                  )}
                </div>
                <ActionButton
                  id="submitWritingRetryBtn"
                  disabled={feedback === 'Correct ✓' || isCheckingRetry || !retryChosenValue.trim()}
                  onClick={() => handleWritingRetrySubmit()}
                >
                  {isCheckingRetry ? 'AI đang chấm...' : 'Kiểm tra câu này'}
                </ActionButton>
              </div>

              {/* Micro feedback */}
              <div
                className={`micro ${feedback === 'Correct ✓' ? 'ok' : feedback ? 'bad' : ''}`}
                style={{
                  marginTop: '10px',
                  minHeight: '20px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  color: feedback === 'Correct ✓' ? 'var(--color-success, #16a34a)' : 'var(--color-error, #dc2626)',
                }}
              >
                {feedback}
              </div>
            </section>
          )}

        {/* 6. GIAI ĐOẠN 3: BẢNG TỔNG KẾT KHI TẤT CẢ ĐÃ LÀM ĐÚNG */}
        {(isGuidedForm || (taskData.form_type === 'FORM_3_WRITING' && (taskData.content as Form3WritingConfig)?.sub_mode !== 'PARAGRAPH')) &&
          phase === 'complete' && (
          <section className="task-panel summary card completion-actions-card">
            <div className="ch">
              <h2>Task complete ✓</h2>
              <span>All {allQuestionItems.length} answers are correct</span>
            </div>
            <div className="cb">
              {allQuestionItems.map((item) => (
                <div className="result" key={item.id}>
                  <span>{item.label}</span>
                  <StatusTag tone="success">Correct ✓</StatusTag>
                </div>
              ))}
              <div className="note" style={{ marginTop: '14px' }}>
                🎉 Great work! Back to your book.
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px', flexWrap: 'wrap' }}>
                <ActionButton
                  id="restartBtn"
                  variant="secondary"
                  onClick={handleRestart}
                >
                  🔄 Làm lại (Try again)
                </ActionButton>
                <ActionButton
                  id="homeBtn"
                  onClick={() => navigate('/?mode=code')}
                >
                  ⌨️ Quay lại trang nhập mã
                </ActionButton>
              </div>
            </div>
          </section>
        )}

        {/* FORM 4: SPEAKING & PRONUNCIATION */}
        {taskData.form_type === 'FORM_4_SPEAKING' && (
          <section className="task-panel" style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-line, #e5e7eb)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <SpeakingPronunciationRenderer
              config={taskData.content as Form4SpeakingConfig}
              taskCode={task.code}
              onComplete={(score, result) => {
                setIsCompleted(true)
                setShowCelebration(true)
                saveTaskAttempt({
                  taskCode: task.code,
                  score,
                  firstScore: score,
                  status: 'completed',
                  supportMode: 'INDEPENDENT',
                  answersPayload: {
                    recognized_text: result.recognizedText,
                    accuracy_score: result.accuracyScore,
                    confidence_score: result.confidenceScore,
                    evaluated_words: result.evaluatedWords,
                  },
                })
              }}
              onRestart={() => {
                setIsCompleted(false)
                setShowCelebration(false)
              }}
              onNavigateHome={() => navigate('/?mode=code')}
              disabled={isCompleted}
            />
          </section>
        )}

        {/* FORM 5: LISTEN & REPEAT */}
        {taskData.form_type === 'FORM_5_LISTEN_REPEAT' && (
          <section className="task-panel" style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-line, #e5e7eb)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <ListenRepeatRenderer
              config={taskData.content as Form5ListenRepeatConfig}
              taskCode={task.code}
              onComplete={(avgScore, results) => {
                setIsCompleted(true)
                setShowCelebration(true)
                saveTaskAttempt({
                  taskCode: task.code,
                  score: avgScore,
                  firstScore: avgScore,
                  status: 'completed',
                  supportMode: 'INDEPENDENT',
                  answersPayload: {
                    results,
                  },
                })
              }}
              onRestart={() => {
                setIsCompleted(false)
                setShowCelebration(false)
              }}
              onNavigateHome={() => navigate('/?mode=code')}
              disabled={isCompleted}
            />
          </section>
        )}

        {/* FORM 6.1: PROFILE LISTEN & ANSWER */}
        {taskData.form_type === 'FORM_6_1_PROFILE_QA' && (
          <section className="task-panel" style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-line, #e5e7eb)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <ProfileListenAnswerRenderer
              config={taskData.content as Form61ProfileConfig}
              taskCode={task.code}
              onComplete={(score, details) => {
                setIsCompleted(true)
                setShowCelebration(true)
                saveTaskAttempt({
                  taskCode: task.code,
                  score,
                  firstScore: score,
                  status: 'completed',
                  supportMode: 'INDEPENDENT',
                  answersPayload: details,
                })
              }}
              onRestart={() => {
                setIsCompleted(false)
                setShowCelebration(false)
              }}
              onNavigateHome={() => navigate('/?mode=code')}
              disabled={isCompleted}
            />
          </section>
        )}

        {/* FORM 6.2: INTERVIEW AI TUTOR & FILL PROFILE */}
        {taskData.form_type === 'FORM_6_2_INTERVIEW_PROFILE' && (
          <section className="task-panel" style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-line, #e5e7eb)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <InterviewFillProfileRenderer
              config={taskData.content as Form62InterviewConfig}
              taskCode={task.code}
              onComplete={(score, details) => {
                setIsCompleted(true)
                setShowCelebration(true)
                saveTaskAttempt({
                  taskCode: task.code,
                  score,
                  firstScore: score,
                  status: 'completed',
                  supportMode: 'INDEPENDENT',
                  answersPayload: details,
                })
              }}
              onRestart={() => {
                setIsCompleted(false)
                setShowCelebration(false)
              }}
              onNavigateHome={() => navigate('/?mode=code')}
              disabled={isCompleted}
            />
          </section>
        )}

        {/* CÁC DẠNG BÀI KHÁC (FORM 4 REPAIR, FORM 5 SEQUENCE) */}
        {!isGuidedForm && taskData.form_type !== 'FORM_3_WRITING' && taskData.form_type !== 'FORM_4_SPEAKING' && taskData.form_type !== 'FORM_5_LISTEN_REPEAT' && taskData.form_type !== 'FORM_6_1_PROFILE_QA' && taskData.form_type !== 'FORM_6_2_INTERVIEW_PROFILE' && isWorksheetVisible && (
          <section className={`task-panel card ${isCompleted ? 'completion-actions-card' : ''}`} style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-line, #e5e7eb)' }}>
            {taskData.form_type === 'FORM_4_SENTENCE_REPAIR' && (
              <SentenceRepairRenderer
                config={taskData.content as Form4SentenceRepairConfig}
                answers={answers}
                onAnswerChange={handleAnswerChange}
                results={gradingResult?.results || null}
                disabled={isCompleted || isSubmitting}
              />
            )}
            {taskData.form_type === 'FORM_5_SEQUENCE' && (
              <SequenceOrderingRenderer
                config={taskData.content as Form5SequenceConfig}
                order={sequenceOrder}
                onOrderChange={setSequenceOrder}
                results={gradingResult?.results || null}
                disabled={isCompleted || isSubmitting}
              />
            )}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              {!isCompleted ? (
                <ActionButton id="genericSubmitBtn" disabled={isSubmitting} onClick={handleGenericSubmit}>
                  {isSubmitting ? 'Checking...' : 'Check'}
                </ActionButton>
              ) : (
                <>
                  <ActionButton id="genericRestartBtn" variant="secondary" onClick={handleRestart}>
                    🔄 Làm lại (Try again)
                  </ActionButton>
                  <ActionButton id="genericHomeBtn" onClick={() => navigate('/?mode=code')}>
                    ⌨️ Quay lại trang nhập mã
                  </ActionButton>
                </>
              )}
            </div>
          </section>
        )}

        {/* Hiệu ứng pháo hoa khi hoàn thành */}
        {showCelebration && (
          <Celebration active={showCelebration} onComplete={() => setShowCelebration(false)} />
        )}

        {/* PHẦN TỬ NEO ĐÁY (SCROLL ANCHOR ĐẢM BẢO LUÔN TỰ ĐỘNG CUỘN XUỐNG DƯỚI CÙNG KHI CÓ TIN MỚI) */}
        <div ref={bottomAnchorRef} id="chat-bottom-anchor" style={{ height: '1px', width: '100%', pointerEvents: 'none' }} />
      </div>
    </InteractiveTaskFrame>
  )
}
