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
import { saveTaskAttempt } from '../lib/taskAttemptService'
import '../components/assessment/guided-choice-task.css'
import type {
  DynamicTaskRecord,
  Form1ChoiceConfig,
  Form2FillConfig,
  Form4SentenceRepairConfig,
  Form5SequenceConfig,
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
  const [isCompleted, setIsCompleted] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const bottomAnchorRef = useRef<HTMLDivElement>(null)

  useCelebrationSound(showCelebration)
  const { chatRef, scrollToLatest } = useAutoScroll(
    `${phase}-${activeId}-${attempt}-${feedback}-${currentHint}-${isCompleted}-${notices.length}-${hasStartedWorksheet}-${listenCount}`
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

    if (taskData.form_type === 'FORM_1_CHOICE') {
      const form1Config = taskData.content as Form1ChoiceConfig
      itemRef = form1Config.items?.find((i) => String(i.id) === id)
      label = itemRef?.label || `Question ${id}`
    } else if (taskData.form_type === 'FORM_2_FILL') {
      const form2Config = taskData.content as Form2FillConfig
      itemRef = form2Config.fields?.find((f) => String(f.id) === id)
      const cleanNum = (itemRef?.label || id).replace(/^câu\s*/i, '').replace(/^question\s*/i, '').replace(/:\s*$/, '').trim()
      label = `Question ${cleanNum}`
    }

    const hint = getRandomHint(id, itemRef, latestResults)

    setCurrentHint(hint)
    addNotice(
      <>
        <strong>{label}</strong>
        <br />
        {hint}
      </>
    )
    schedule(() => scrollToLatest(), 60)
    schedule(() => scrollToLatest(), 200)
    schedule(() => scrollToLatest(), 400)
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
      return (taskData.content as Form2FillConfig).fields?.length || 1
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
      const form2Config = taskData.content as Form2FillConfig
      itemsList = (form2Config.fields || []).map((f, idx) => {
        const cleanNum = (f.label || String(idx + 1)).replace(/^câu\s*/i, '').replace(/^question\s*/i, '').replace(/:\s*$/, '').trim() || String(idx + 1)
        return {
          id: String(f.id),
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
      const { data, error } = await supabase.rpc('grade_student_attempt', {
        p_task_code: taskData.code,
        p_answers: answers,
        p_attempt_count: 1,
      })

      if (error) {
        addNotice(`Grading error: ${error.message}`)
        return
      }

      if (data && data.success) {
        const res = data as GradingResponse
        setGradingResult(res)

        const wrong = itemsList
          .filter((item) => !res.results?.[item.id]?.correct)
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
            beginRetry(wrong[0], 1, res.results)
          }, 350)
        }
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
      const { data, error } = await supabase.rpc('grade_student_attempt', {
        p_task_code: taskData.code,
        p_answers: updatedAnswers,
        p_attempt_count: attempt + 1,
      })

      if (error) {
        addNotice(`Grading error: ${error.message}`)
        setIsCheckingRetry(false)
        return
      }

      const res = data as GradingResponse
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
            beginRetry(nextQueue[0], 1, res.results)
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

          if (taskData.form_type === 'FORM_1_CHOICE') {
            const form1Config = taskData.content as Form1ChoiceConfig
            itemRef = form1Config.items?.find((i) => String(i.id) === activeId)
            label = itemRef?.label || `Question ${activeId}`
          } else if (taskData.form_type === 'FORM_2_FILL') {
            const form2Config = taskData.content as Form2FillConfig
            itemRef = form2Config.fields?.find((f) => String(f.id) === activeId)
            const cleanNum = (itemRef?.label || activeId).replace(/^câu\s*/i, '').replace(/^question\s*/i, '').replace(/:\s*$/, '').trim()
            label = `Question ${cleanNum}`
          }

          const deepHint = getRandomHint(activeId, itemRef, res.results)

          setCurrentHint(deepHint)
          addNotice(
            <>
              <strong>{label}</strong>
              <br />
              Not yet. {deepHint}
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

  // 7. Chức năng LÀM LẠI BÀI (Restart from scratch)
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
  const form2Fields = form2Config?.fields || []

  // Chuẩn hóa danh sách câu hỏi cho cả Form 1 và Form 2
  const allQuestionItems: { id: string; label: string; numBadge: string; cue?: string }[] =
    taskData.form_type === 'FORM_1_CHOICE'
      ? form1Items.map((i) => ({
          id: String(i.id),
          label: i.label || `Question ${i.id}`,
          numBadge: String(i.id),
          cue: i.cue,
        }))
      : taskData.form_type === 'FORM_2_FILL'
      ? form2Fields.map((f, idx) => {
          const cleanNum =
            (f.label || String(idx + 1))
              .replace(/^câu\s*/i, '')
              .replace(/^question\s*/i, '')
              .replace(/:\s*$/, '')
              .trim() || String(idx + 1)
          return {
            id: String(f.id),
            label: `Question ${cleanNum}`,
            numBadge: cleanNum,
            cue: `Look back at Question ${cleanNum} from the worksheet.`,
          }
        })
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
      : 'Enter your answers below.')

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
              : isSubmitting
              ? 'Checking...'
              : 'Check'
          }
          actionId="footerActionBtn"
          disabled={!isAudioUnlocked || phase === 'guided' || isSubmitting}
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
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{form2Fields.length} items</span>
            </div>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                handleInitialCheck()
              }}
            >
              {allQuestionItems.map((item) => {
                const fieldCfg = form2Fields.find((f) => String(f.id) === item.id)
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
                      placeholder={fieldCfg?.placeholder || 'Your answer'}
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
                Use the worksheet questions while entering your answers.
              </div>
            </form>
          </section>
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
          <section className="retry guided-choice-retry" data-stage="retry" data-attempt={attempt}>
            <div className="retry-head">
              <strong>{currentRetryItem?.label || `Question ${activeId}`}</strong>
              <StatusTag tone="warning">Attempt {attempt}</StatusTag>
            </div>
            <div className="bookcue">
              {currentRetryItem?.cue || `Look back at Question ${activeId}.`}
            </div>
            <div className={`hint ${attempt > 1 ? 'deep' : ''}`}>
              💡 {currentHint}
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
            className="retry guided-choice-retry"
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
              className="bookcue"
              style={{
                fontSize: '13px',
                color: 'var(--color-muted, #6b7280)',
                marginBottom: '10px',
              }}
            >
              {currentRetryItem?.cue || `Look back at Question ${currentRetryItem?.numBadge || activeId} from the worksheet.`}
            </div>
            <div
              className={`hint ${attempt > 1 ? 'deep' : ''}`}
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#fcedf3',
                color: '#6a4055',
                fontSize: '13px',
                lineHeight: '1.45',
              }}
            >
              💡 {currentHint}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id={`retry-${activeId}`}
                autoFocus
                autoComplete="off"
                value={retryChosenValue}
                placeholder="Type your answer"
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

        {/* 6. GIAI ĐOẠN 3: BẢNG TỔNG KẾT KHI TẤT CẢ ĐÃ LÀM ĐÚNG */}
        {isGuidedForm && phase === 'complete' && (
          <section className="task-panel summary card">
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

        {/* CÁC DẠNG BÀI KHÁC (FORM 4, FORM 5) */}
        {!isGuidedForm && isWorksheetVisible && (
          <section className="task-panel card" style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-line, #e5e7eb)' }}>
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
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
