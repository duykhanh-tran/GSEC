import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { taskCacheService } from '../../lib/taskCacheService'
import { AppHeader } from '../../components/shell/AppHeader'
import type { Form3SubMode } from '../../task-engine/dynamic-schema'
import { hasTask } from '../registry'
import '../../styles/portal.css'
import '../../styles/auth.css'

export function AdminTaskStudioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { code: paramCode } = useParams<{ code?: string }>()
  const editCodeFromUrl = paramCode || searchParams.get('edit') || null

  // Base state
  const [editingTaskCode, setEditingTaskCode] = useState<string | null>(editCodeFromUrl)
  const [isLoadingEditTask, setIsLoadingEditTask] = useState<boolean>(false)
  const [authoringFormType, setAuthoringFormType] = useState<string>('FORM_1_CHOICE')
  const [taskCode, setTaskCode] = useState<string>('')
  const [taskUnit, setTaskUnit] = useState<number | string>(1)
  const [taskLesson, setTaskLesson] = useState<number | string>(1)
  const [taskNumber, setTaskNumber] = useState<number | string>(1)
  const [taskTitle, setTaskTitle] = useState<string>('AI Tutor • WS 1 - Task 1')
  const [taskSubtitle, setTaskSubtitle] = useState<string>('Unit 1')
  const [taskIntro, setTaskIntro] = useState<string>('Check Task 1. Enter your answers.')
  const [savingTask, setSavingTask] = useState<boolean>(false)
  const [authoringStatus, setAuthoringStatus] = useState<{ success: boolean; text: string } | null>(null)

  // Audio Upload states
  const [taskAudioUrl, setTaskAudioUrl] = useState('')
  const [taskAudioName, setTaskAudioName] = useState('')
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // Helper sinh tiêu đề tự động theo Lesson và Số thứ tự bài (AI Tutor • WS {lesson} - Task {task_number})
  const getAutoTaskTitle = (l: number | string, n: number | string) => {
    const lDisplay = l === '' ? '...' : l
    const nDisplay = n === '' ? '...' : n
    return `AI Tutor • WS ${lDisplay} - Task ${nDisplay}`
  }

  const handleUnitChange = (val: string) => {
    setTaskUnit(val)
    if (val.trim()) {
      setTaskSubtitle(`Unit ${val.trim()}`)
    }
  }

  const handleLessonChange = (newLesson: string) => {
    setTaskLesson(newLesson)
    setTaskTitle(getAutoTaskTitle(newLesson, taskNumber))
  }

  const handleTaskNumberChange = (newNum: string) => {
    setTaskNumber(newNum)
    setTaskTitle(getAutoTaskTitle(taskLesson, newNum))
  }

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setTaskAudioName(file.name)
    setIsUploadingAudio(true)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64Url = ev.target?.result as string
      setTaskAudioUrl(base64Url)

      try {
        const fileExt = file.name.split('.').pop() || 'mp3'
        const filePath = `tasks/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
        const { data, error } = await supabase.storage.from('task-audio').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
        if (!error && data) {
          const { data: pubUrl } = supabase.storage.from('task-audio').getPublicUrl(data.path)
          if (pubUrl?.publicUrl) {
            setTaskAudioUrl(pubUrl.publicUrl)
          }
        }
      } catch (err) {
        console.warn('Storage upload error, using base64 fallback:', err)
      } finally {
        setIsUploadingAudio(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAudio = () => {
    setTaskAudioUrl('')
    setTaskAudioName('')
    if (audioInputRef.current) {
      audioInputRef.current.value = ''
    }
  }

  // ================= FORM 1 BUILDER STATE =================
  const [choiceItems, setChoiceItems] = useState<
    Array<{ label: string; cue: string; correct: string; hints: string[]; audio_url?: string }>
  >([
    { label: 'Question 1', cue: 'Look back at Question 1.', correct: 'A', hints: ['', ''], audio_url: '' },
    { label: 'Question 2', cue: 'Look back at Question 2.', correct: 'B', hints: ['', ''], audio_url: '' },
  ])
  const [choiceOptionsText, setChoiceOptionsText] = useState('A, B, C')

  const handleChoiceItemAudioUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64Url = ev.target?.result as string
      setChoiceItems((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], audio_url: base64Url }
        return next
      })

      try {
        const fileExt = file.name.split('.').pop() || 'mp3'
        const filePath = `tasks/choice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
        const { data, error } = await supabase.storage.from('task-audio').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
        if (!error && data) {
          const { data: pubUrl } = supabase.storage.from('task-audio').getPublicUrl(data.path)
          if (pubUrl?.publicUrl) {
            setChoiceItems((prev) => {
              const next = [...prev]
              next[index] = { ...next[index], audio_url: pubUrl.publicUrl }
              return next
            })
          }
        }
      } catch (err) {
        console.warn('Choice item audio upload error, using base64 fallback:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  // ================= FORM 2 BUILDER STATE =================
  const [fillItems, setFillItems] = useState<Array<{
    label: string
    placeholder?: string
    correctAnswers: string
    hints: string[]
    h1?: string
    h2?: string
  }>>([
    { label: '1', placeholder: 'Your answer', correctAnswers: 'school, a school', hints: ['', ''] },
  ])

  // ================= FORM 3 WRITING BUILDER STATE =================
  const [form3SubMode, setForm3SubMode] = useState<Form3SubMode>('FREE_SENTENCE')
  const [form3ScoringCriteria, setForm3ScoringCriteria] = useState('')
  const [paragraphPrompt, setParagraphPrompt] = useState('Write a short paragraph (40-60 words) about your school.')
  const [paragraphMinWords, setParagraphMinWords] = useState(40)
  const [paragraphMaxWords, setParagraphMaxWords] = useState(80)
  const [paragraphHelperWords, setParagraphHelperWords] = useState('library, playground, friendly teachers, classmates')
  const [paragraphCriteria, setParagraphCriteria] = useState<string[]>([
    'Giới thiệu tên trường và vị trí',
    'Kể ít nhất 2 phòng học hoặc tiện ích trong trường',
    'Nêu cảm nghĩ của bạn về trường',
  ])
  const [paragraphHints, setParagraphHints] = useState<string[]>([
    'Sử dụng thì hiện tại đơn (Present Simple)',
    'Chú ý viết hoa đầu câu và dấu chấm câu kết thúc',
  ])

  const [writingItems, setWritingItems] = useState<Array<{
    label: string
    prompt: string
    sentence_starter?: string
    sentence_ending?: string
    requiredWords: string
    hints: string[]
    scoring_criteria?: string
  }>>([
    {
      label: 'Question 1',
      prompt: '',
      sentence_starter: 'My school is',
      sentence_ending: '',
      requiredWords: '',
      hints: ['Viết tiếp tính từ hoặc cụm danh từ mô tả trường học.', 'Kiểm tra chính tả.'],
      scoring_criteria: '',
    },
  ])

  // ================= FORM 4 SPEAKING BUILDER STATE =================
  const [speakingLinkedTaskCode, setSpeakingLinkedTaskCode] = useState('60115')
  const [speakingPassScore, setSpeakingPassScore] = useState(80)
  const [speakingCriteria, setSpeakingCriteria] = useState('')

  // ================= FORM 5 LISTEN & REPEAT STATE =================
  const [form5PassScore, setForm5PassScore] = useState(80)
  const [form5Items, setForm5Items] = useState<
    Array<{ id: string; label: string; target_text: string; audio_url?: string; hints?: string[] }>
  >([
    {
      id: 'item-1',
      label: 'Sentence 1',
      target_text: 'I usually play badminton after school.',
      audio_url: '',
      hints: ['Nghe kỹ phát âm âm đuôi và ngữ điệu.'],
    },
    {
      id: 'item-2',
      label: 'Sentence 2',
      target_text: 'My brother often reads comic books in the library.',
      audio_url: '',
      hints: ['Chú ý phát âm đuôi s ở reads.'],
    },
  ])

  const handleItemAudioUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64Url = ev.target?.result as string
      setForm5Items((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], audio_url: base64Url }
        return next
      })

      try {
        const fileExt = file.name.split('.').pop() || 'mp3'
        const filePath = `tasks/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
        const { data, error } = await supabase.storage.from('task-audio').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
        if (!error && data) {
          const { data: pubUrl } = supabase.storage.from('task-audio').getPublicUrl(data.path)
          if (pubUrl?.publicUrl) {
            setForm5Items((prev) => {
              const next = [...prev]
              next[index] = { ...next[index], audio_url: pubUrl.publicUrl }
              return next
            })
          }
        }
      } catch (err) {
        console.warn('Item audio upload error, using base64 fallback:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  // ================= FORM 6.1 PROFILE Q&A STATE =================
  const [form61ProfileTitle, setForm61ProfileTitle] = useState("New Classmate's Profile")
  const [form61Items, setForm61Items] = useState<
    Array<{ id: string; label: string; profile_value: string; audio_url?: string; accepted_answers: string; hints?: string }>
  >([
    { id: 'name', label: 'Name', profile_value: 'Nam', audio_url: '', accepted_answers: "Nam\nHis name is Nam\nHis name's Nam", hints: 'Nghe kỹ câu hỏi tên bạn ấy trong hồ sơ.' },
    { id: 'class', label: 'Class', profile_value: '6A', audio_url: '', accepted_answers: '6A\nClass 6A\nHe is in class 6A\nin class 6A', hints: 'Bạn ấy học lớp nào? Nhìn vào cột Class nhé.' },
    { id: 'subject', label: 'Favourite subject', profile_value: 'English', audio_url: '', accepted_answers: 'English\nHis favourite subject is English', hints: 'Môn học yêu thích của bạn ấy là gì?' },
    { id: 'activity', label: 'Activity after', profile_value: 'play football', audio_url: '', accepted_answers: 'play football\nplays football\nHe plays football', hints: 'Hoạt động sau giờ học của bạn ấy là gì?' },
  ])

  const handleForm61AudioUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64Url = ev.target?.result as string
      setForm61Items((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], audio_url: base64Url }
        return next
      })

      try {
        const fileExt = file.name.split('.').pop() || 'mp3'
        const filePath = `tasks/form61_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
        const { data, error } = await supabase.storage.from('task-audio').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
        if (!error && data) {
          const { data: pubUrl } = supabase.storage.from('task-audio').getPublicUrl(data.path)
          if (pubUrl?.publicUrl) {
            setForm61Items((prev) => {
              const next = [...prev]
              next[index] = { ...next[index], audio_url: pubUrl.publicUrl }
              return next
            })
          }
        }
      } catch (err) {
        console.warn('Form 6.1 audio upload error, using base64 fallback:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  // ================= FORM 6.2 INTERVIEW STATE =================
  const [form62PassScore, setForm62PassScore] = useState(80)
  const [form62Items, setForm62Items] = useState<
    Array<{
      id: string
      label: string
      target_answer: string
      accepted_values: string
      answer_audio_url?: string
      answer_text_display?: string
      question_bank: string
      hints?: string
    }>
  >([
    {
      id: 'name',
      label: 'Name',
      target_answer: 'Nam',
      accepted_values: 'Nam\nhis name is Nam',
      answer_audio_url: '',
      answer_text_display: 'His name is Nam.',
      question_bank: "What is his name?\nWhat's his name?\nWho is he?\nCan you tell me his name?\nTell me his name",
      hints: 'Hãy hỏi về tên của bạn ấy (ví dụ: What is his name?).',
    },
    {
      id: 'class',
      label: 'Class',
      target_answer: '6A',
      accepted_values: '6A\nclass 6A\nin class 6A',
      answer_audio_url: '',
      answer_text_display: 'He is in class 6A.',
      question_bank: "Which class is he in?\nWhat class is he in?\nWhich class?\nWhat is his class?",
      hints: 'Hãy hỏi về lớp học của bạn ấy (ví dụ: Which class is he in?).',
    },
    {
      id: 'subject',
      label: 'Favourite subject',
      target_answer: 'English',
      accepted_values: 'English\nhis favourite subject is English',
      answer_audio_url: '',
      answer_text_display: 'His favourite subject is English.',
      question_bank: "What is his favourite subject?\nWhat's his favourite subject?\nWhat is his favorite subject?\nWhich subject does he like?\nWhat subject does he like most?",
      hints: 'Hãy hỏi về môn học yêu thích (ví dụ: What is his favourite subject?).',
    },
    {
      id: 'activity',
      label: 'Activity after',
      target_answer: 'play football',
      accepted_values: 'play football\nplays football\nhe plays football',
      answer_audio_url: '',
      answer_text_display: 'He usually plays football after school.',
      question_bank: "What does he do after school?\nWhat is his activity after school?\nWhat does he usually do after school?\nWhat activity does he do?",
      hints: 'Hãy hỏi về hoạt động sau giờ học (ví dụ: What does he do after school?).',
    },
  ])

  const handleForm62AudioUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64Url = ev.target?.result as string
      setForm62Items((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], answer_audio_url: base64Url }
        return next
      })

      try {
        const fileExt = file.name.split('.').pop() || 'mp3'
        const filePath = `tasks/form62_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
        const { data, error } = await supabase.storage.from('task-audio').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
        if (!error && data) {
          const { data: pubUrl } = supabase.storage.from('task-audio').getPublicUrl(data.path)
          if (pubUrl?.publicUrl) {
            setForm62Items((prev) => {
              const next = [...prev]
              next[index] = { ...next[index], answer_audio_url: pubUrl.publicUrl }
              return next
            })
          }
        }
      } catch (err) {
        console.warn('Form 6.2 audio upload error, using base64 fallback:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  // ================= TẢI DỮ LIỆU KHI CHỈNH SỬA (EDIT MODE) =================
  const fetchTaskToEdit = useCallback(async (codeToEdit: string) => {
    setIsLoadingEditTask(true)
    setAuthoringStatus(null)
    setEditingTaskCode(codeToEdit)

    try {
      const { data: dbTask, error: taskErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('code', codeToEdit)
        .maybeSingle()

      if (taskErr) {
        console.warn('Lỗi tải tasks khi sửa bài:', taskErr)
      }

      const { data: dbPolicy, error: policyErr } = await supabase
        .from('task_assessment_policies')
        .select('*')
        .eq('task_code', codeToEdit)
        .maybeSingle()

      if (policyErr) {
        console.warn('Lỗi tải policies khi sửa bài:', policyErr)
      }

      const targetFormType = dbTask?.form_type || 'FORM_1_CHOICE'
      setAuthoringFormType(targetFormType)
      setTaskCode(codeToEdit)

      const unitMatch = (dbTask?.subtitle || '').match(/Unit\s*(\d+)/i)
      const parsedUnit = unitMatch ? parseInt(unitMatch[1], 10) : 1
      const finalUnit = dbTask?.content?.unit || parsedUnit
      const finalLesson = dbTask?.content?.lesson || dbTask?.worksheet || 1
      const finalNumber = dbTask?.task_number ?? 1

      setTaskUnit(finalUnit)
      setTaskLesson(finalLesson)
      setTaskNumber(finalNumber)
      setTaskTitle(dbTask?.title || getAutoTaskTitle(finalLesson, finalNumber))
      setTaskSubtitle(dbTask?.subtitle || `Unit ${finalUnit}`)
      setTaskIntro(dbTask?.content?.intro || '')

      const foundAudioUrl = dbTask?.content?.audio_url || dbTask?.content?.audioUrl || ''
      setTaskAudioUrl(foundAudioUrl)
      setTaskAudioName(foundAudioUrl ? 'audio_task.mp3' : '')

      const content = dbTask?.content || {}
      const keysData = dbPolicy?.keys_data || {}
      const hintsData = dbPolicy?.hints_data || {}

      if (targetFormType === 'FORM_1_CHOICE') {
        const opts = content.options || ['A', 'B', 'C']
        setChoiceOptionsText(Array.isArray(opts) ? opts.join(', ') : 'A, B, C')
        if (content.items && Array.isArray(content.items) && content.items.length > 0) {
          setChoiceItems(
            content.items.map((it: any, idx: number) => {
              const key = String(it.id || idx + 1)
              const correctVal = keysData[key] || it.correct || 'A'
              const pHints = hintsData[key]?.hints || it.hints || []
              return {
                label: it.label || `Question ${idx + 1}`,
                cue: it.cue || '',
                correct: correctVal,
                hints: [pHints[0] || it.firstHint || '', pHints[1] || it.secondHint || ''],
                audio_url: it.audio_url || '',
              }
            })
          )
        }
      } else if (targetFormType === 'FORM_2_FILL') {
        const rawFillList = content.fields || content.items || []
        if (Array.isArray(rawFillList) && rawFillList.length > 0) {
          setFillItems(
            rawFillList.map((it: any, idx: number) => {
              const key = String(it.id !== undefined && it.id !== null ? it.id : idx + 1)
              const keyObj = keysData[key]
              const correctStr = Array.isArray(keyObj?.accepted)
                ? keyObj.accepted.join(', ')
                : Array.isArray(keyObj)
                ? keyObj.join(', ')
                : typeof keyObj === 'string'
                ? keyObj
                : (it.correct || (Array.isArray(it.accepted) ? it.accepted.join(', ') : '') || '')
              const pHints = hintsData[key]?.hints || it.hints || []
              return {
                label: it.label || String(idx + 1),
                placeholder: it.placeholder || '',
                correctAnswers: correctStr,
                hints: [pHints[0] || it.firstHint || '', pHints[1] || it.secondHint || ''],
              }
            })
          )
        }
      } else if (targetFormType === 'FORM_3_WRITING') {
        const isParagraph = content.sub_mode === 'PARAGRAPH' || !!content.paragraph_config
        const resolvedSubMode: Form3SubMode =
          content.sub_mode === 'BOOK_KEYWORD'
            ? 'BOOK_KEYWORD'
            : isParagraph
            ? 'PARAGRAPH'
            : 'FREE_SENTENCE'
        setForm3SubMode(resolvedSubMode)
        setForm3ScoringCriteria(content.scoring_criteria || keysData.scoring_criteria || '')

        if (resolvedSubMode === 'PARAGRAPH' && content.paragraph_config) {
          const cfg = content.paragraph_config
          setParagraphPrompt(cfg.prompt || '')
          setParagraphMinWords(cfg.min_words || 40)
          setParagraphMaxWords(cfg.max_words || 80)
          setParagraphHelperWords(Array.isArray(cfg.helper_words) ? cfg.helper_words.join(', ') : (cfg.helper_words || ''))
          setParagraphCriteria(Array.isArray(cfg.criteria) ? cfg.criteria : [])
          setParagraphHints(Array.isArray(cfg.hints) ? cfg.hints : [])
        } else if (content.items && Array.isArray(content.items)) {
          setWritingItems(
            content.items.map((it: any, idx: number) => {
              const key = `q${idx + 1}`
              const keyObj = keysData[key]
              const reqWords = Array.isArray(it.required_words)
                ? it.required_words.join(', ')
                : (keyObj?.required_words?.join(', ') || '')
              return {
                label: it.label || `Question ${idx + 1}`,
                prompt: it.prompt || '',
                sentence_starter: it.sentence_starter || keyObj?.sentence_starter || '',
                sentence_ending: it.sentence_ending || keyObj?.sentence_ending || '',
                requiredWords: reqWords,
                hints: Array.isArray(it.hints) ? it.hints : [],
                scoring_criteria: it.scoring_criteria || keyObj?.scoring_criteria || '',
              }
            })
          )
        }
      } else if (targetFormType === 'FORM_4_SPEAKING') {
        setSpeakingLinkedTaskCode(content.linked_task_code || keysData.linked_task_code || '60115')
        setSpeakingPassScore(content.pass_score || keysData.pass_score || 80)
        setSpeakingCriteria(content.scoring_criteria || keysData.scoring_criteria || '')
      } else if (targetFormType === 'FORM_5_LISTEN_REPEAT') {
        setForm5PassScore(content.pass_score || keysData.pass_score || 80)
        if (content.items && Array.isArray(content.items) && content.items.length > 0) {
          setForm5Items(
            content.items.map((it: any, idx: number) => ({
              id: it.id || `item-${idx + 1}`,
              label: it.label || `Sentence ${idx + 1}`,
              target_text: it.target_text || '',
              audio_url: it.audio_url || '',
              hints: Array.isArray(it.hints) ? it.hints : ['Nghe kỹ ngữ điệu và phát âm rõ từng từ.'],
            }))
          )
        }
      } else if (targetFormType === 'FORM_6_1_PROFILE_QA') {
        setForm61ProfileTitle(content.profile_title || "New Classmate's Profile")
        if (content.items && Array.isArray(content.items) && content.items.length > 0) {
          setForm61Items(
            content.items.map((it: any) => ({
              id: it.id,
              label: it.label,
              profile_value: it.profile_value || '',
              audio_url: it.audio_url || '',
              accepted_answers: Array.isArray(it.accepted_answers) ? it.accepted_answers.join('\n') : (it.accepted_answers || ''),
              hints: Array.isArray(it.hints) ? (it.hints[0] || '') : (it.hints || ''),
            }))
          )
        }
      } else if (targetFormType === 'FORM_6_2_INTERVIEW_PROFILE') {
        setForm62PassScore(content.pass_score || keysData.pass_score || 80)
        if (content.items && Array.isArray(content.items) && content.items.length > 0) {
          setForm62Items(
            content.items.map((it: any) => ({
              id: it.id,
              label: it.label,
              target_answer: it.target_answer || '',
              accepted_values: Array.isArray(it.accepted_values) ? it.accepted_values.join('\n') : (it.accepted_values || ''),
              answer_audio_url: it.answer_audio_url || '',
              answer_text_display: it.answer_text_display || '',
              question_bank: Array.isArray(it.question_bank) ? it.question_bank.join('\n') : (it.question_bank || ''),
              hints: Array.isArray(it.hints) ? (it.hints[0] || '') : (it.hints || ''),
            }))
          )
        }
      }
    } catch (err: any) {
      console.error('Lỗi tải bài tập để sửa:', err)
      alert(`Không thể tải bài tập: ${err?.message || 'Đã có lỗi xảy ra.'}`)
    } finally {
      setIsLoadingEditTask(false)
    }
  }, [])

  // Tự động khởi tạo dữ liệu ban đầu
  useEffect(() => {
    if (editCodeFromUrl) {
      fetchTaskToEdit(editCodeFromUrl)
    } else {
      const randomSuffix = Math.floor(10 + Math.random() * 89)
      const initialCode = `601${randomSuffix}`
      setTaskCode(initialCode)
      setTaskUnit(1)
      setTaskLesson(1)
      setTaskNumber(1)
      setTaskTitle(getAutoTaskTitle(1, 1))
      setTaskSubtitle('Unit 1')
      setTaskIntro('Check Task 1. Enter your answers.')
      setEditingTaskCode(null)
    }
  }, [editCodeFromUrl, fetchTaskToEdit])

  // ================= XỬ LÝ LƯU & XUẤT BẢN BÀI TẬP =================
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskCode.trim() || !taskTitle.trim()) {
      alert('Vui lòng nhập đầy đủ Mã bài tập và Tiêu đề bài tập!')
      return
    }

    setSavingTask(true)
    setAuthoringStatus(null)

    try {
      let contentPayload: any = {}
      let keysPayload: any = {}
      let hintsPayload: any = {}

      if (authoringFormType === 'FORM_1_CHOICE') {
        const opts = choiceOptionsText.split(',').map((o) => o.trim()).filter(Boolean)
        contentPayload = {
          intro: taskIntro || 'Enter your A, B or C answers.',
          options: opts.length > 0 ? opts : ['A', 'B', 'C'],
          items: choiceItems.map((item, index) => {
            const cleanHints = (item.hints || []).map((h) => h.trim()).filter(Boolean)
            return {
              id: index + 1,
              label: item.label,
              cue: item.cue,
              audio_url: item.audio_url?.trim() || undefined,
              hints: cleanHints,
              firstHint: cleanHints[0] || 'Check the question again.',
              secondHint: cleanHints[1] || cleanHints[0] || 'Look back at your worksheet.',
            }
          }),
        }

        choiceItems.forEach((item, index) => {
          const key = String(index + 1)
          const cleanHints = (item.hints || []).map((h) => h.trim()).filter(Boolean)
          keysPayload[key] = item.correct.trim().toUpperCase()
          hintsPayload[key] = {
            hints: cleanHints,
            h1: cleanHints[0] || 'Check the question again.',
            h2: cleanHints[1] || cleanHints[0] || 'Look back at your worksheet.',
          }
        })
      } else if (authoringFormType === 'FORM_2_FILL') {
        const cleanFields = fillItems.map((item, index) => {
          const cleanHints = (item.hints || []).map((h) => h.trim()).filter(Boolean)
          const cleanAnswers = item.correctAnswers.split(',').map((a) => a.trim()).filter(Boolean)
          return {
            id: index + 1,
            label: item.label || String(index + 1),
            placeholder: item.placeholder || 'Your answer (a, b, c, d or word/phrase)',
            hints: cleanHints,
            accepted: cleanAnswers,
            firstHint: cleanHints[0] || 'Check the sentence carefully.',
            secondHint: cleanHints[1] || cleanHints[0] || 'Look back at the worksheet.',
          }
        })

        contentPayload = {
          intro: taskIntro || 'Check Task 1. Enter your answers from the worksheet.',
          items: cleanFields,
          fields: cleanFields,
        }

        fillItems.forEach((item, index) => {
          const key = String(index + 1)
          const cleanAnswers = item.correctAnswers.split(',').map((a) => a.trim()).filter(Boolean)
          const cleanHints = (item.hints || []).map((h) => h.trim()).filter(Boolean)
          keysPayload[key] = cleanAnswers.map((a) => a.toLowerCase().trim())
          hintsPayload[key] = {
            hints: cleanHints,
            h1: cleanHints[0] || 'Check the sentence carefully.',
            h2: cleanHints[1] || cleanHints[0] || 'Look back at the worksheet.',
          }
        })
      } else if (authoringFormType === 'FORM_3_WRITING') {
        const cleanGeneralCriteria = form3ScoringCriteria.trim() || undefined

        if (form3SubMode === 'PARAGRAPH') {
          const cleanHelpers = paragraphHelperWords.split(',').map((w) => w.trim()).filter(Boolean)
          const cleanCriteria = paragraphCriteria.map((c) => (c || '').trim()).filter(Boolean)
          const cleanHints = paragraphHints.map((h) => (h || '').trim()).filter(Boolean)

          contentPayload = {
            intro: taskIntro.trim() || 'Write a short paragraph about the topic below. AI Tutor will assess your grammar and vocabulary.',
            sub_mode: 'PARAGRAPH',
            scoring_criteria: cleanGeneralCriteria,
            paragraph_config: {
              prompt: paragraphPrompt.trim() || 'Write a short paragraph about your school.',
              min_words: Number(paragraphMinWords) || 40,
              max_words: Number(paragraphMaxWords) || 80,
              helper_words: cleanHelpers,
              criteria: cleanCriteria,
              hints: cleanHints,
            },
          }

          keysPayload = {
            min_words: Number(paragraphMinWords) || 40,
            max_words: Number(paragraphMaxWords) || 80,
            helper_words: cleanHelpers,
            criteria: cleanCriteria,
            scoring_criteria: cleanGeneralCriteria,
          }

          hintsPayload = {
            hints: cleanHints,
            h1: cleanHints[0] || 'Pay attention to capitalization and punctuation.',
            h2: cleanHints[1] || cleanHints[0] || 'Use compound sentences and rich vocabulary.',
          }
        } else {
          contentPayload = {
            intro: taskIntro.trim() || 'Look at each prompt. Write a complete English sentence with given words.',
            sub_mode: form3SubMode,
            scoring_criteria: cleanGeneralCriteria,
            items: writingItems.map((item, index) => {
              const reqWords = item.requiredWords.split(',').map((w) => w.trim()).filter(Boolean)
              const rawHints = item.hints && Array.isArray(item.hints) ? item.hints : []
              const cleanHints = rawHints.map((h: string) => (h || '').trim()).filter(Boolean)
              return {
                id: `q${index + 1}`,
                label: item.label || `Question ${index + 1}`,
                prompt: item.prompt || '',
                sentence_starter: item.sentence_starter?.trim() || undefined,
                sentence_ending: item.sentence_ending?.trim() || undefined,
                required_words: reqWords.length > 0 ? reqWords : undefined,
                hints: cleanHints,
                cue: reqWords.length > 0 ? `Target words: ${reqWords.join(', ')}` : undefined,
                scoring_criteria: item.scoring_criteria?.trim() || undefined,
              }
            }),
          }

          keysPayload = {
            scoring_criteria: cleanGeneralCriteria,
          }

          writingItems.forEach((item, index) => {
            const key = `q${index + 1}`
            const reqWords = item.requiredWords.split(',').map((w) => w.trim()).filter(Boolean)
            keysPayload[key] = {
              sentence_starter: item.sentence_starter?.trim() || undefined,
              sentence_ending: item.sentence_ending?.trim() || undefined,
              required_words: reqWords,
              scoring_criteria: item.scoring_criteria?.trim() || undefined,
            }

            const rawHints = item.hints && Array.isArray(item.hints) ? item.hints : []
            const cleanHints = rawHints.map((h: string) => (h || '').trim()).filter(Boolean)
            hintsPayload[key] = {
              hints: cleanHints,
              h1: cleanHints[0] || 'Check your sentence grammar.',
              h2: cleanHints[1] || cleanHints[0] || 'Check subject-verb agreement and word order.',
            }
          })
        }
      } else if (authoringFormType === 'FORM_4_SPEAKING') {
        contentPayload = {
          intro: taskIntro.trim() || 'Read aloud the sentences you wrote. AI will evaluate your pronunciation clarity.',
          linked_task_code: speakingLinkedTaskCode.trim() || '60115',
          pass_score: Number(speakingPassScore) || 80,
          scoring_criteria: speakingCriteria.trim() || undefined,
        }

        keysPayload = {
          linked_task_code: speakingLinkedTaskCode.trim() || '60115',
          pass_score: Number(speakingPassScore) || 80,
          scoring_criteria: speakingCriteria.trim() || undefined,
        }

        hintsPayload = {
          h1: 'Speak clearly into your microphone at a steady pace.',
          h2: 'Listen to the audio guide or try again if words are unclear.',
        }
      } else if (authoringFormType === 'FORM_5_LISTEN_REPEAT') {
        const cleanItems = form5Items
          .map((item, index) => {
            const rawHints = item.hints && Array.isArray(item.hints) ? item.hints : []
            const cleanHints = rawHints.map((h: string) => (h || '').trim()).filter(Boolean)
            if (cleanHints.length === 0) {
              cleanHints.push('Nghe kỹ ngữ điệu và phát âm rõ từng từ.')
            }
            return {
              id: item.id || `item-${index + 1}`,
              label: item.label || `Sentence ${index + 1}`,
              target_text: item.target_text.trim(),
              audio_url: item.audio_url?.trim() || undefined,
              hints: cleanHints,
            }
          })
          .filter((it) => it.target_text.length > 0)

        contentPayload = {
          intro: taskIntro.trim() || 'Listen to each audio clip carefully. Repeat aloud into your microphone to get scored.',
          pass_score: Number(form5PassScore) || 80,
          items: cleanItems.length > 0 ? cleanItems : [
            {
              id: 'item-1',
              label: 'Sentence 1',
              target_text: 'I usually play badminton after school.',
              hints: ['Nghe kỹ ngữ điệu và phát âm rõ từng từ.'],
            },
          ],
        }

        keysPayload = {
          pass_score: Number(form5PassScore) || 80,
          items: cleanItems,
        }

        hintsPayload = {
          h1: 'Listen carefully to the model voice before recording.',
          h2: 'Repeat clearly at a steady pace to get over 80%.',
        }
      } else if (authoringFormType === 'FORM_6_1_PROFILE_QA') {
        const cleanItems = form61Items.map((item) => {
          const accepted = item.accepted_answers
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
          if (accepted.length === 0 && item.profile_value.trim()) {
            accepted.push(item.profile_value.trim())
          }
          return {
            id: item.id,
            label: item.label.trim(),
            profile_value: item.profile_value.trim(),
            audio_url: item.audio_url?.trim() || undefined,
            accepted_answers: accepted,
            hints: item.hints?.trim() ? [item.hints.trim()] : [],
          }
        })

        contentPayload = {
          intro: taskIntro.trim() || "Look at your new classmate's profile. Listen to the AI Coach and answer.",
          profile_title: form61ProfileTitle.trim() || "New Classmate's Profile",
          is_fixed_first_field: true,
          items: cleanItems,
        }

        keysPayload = {
          items: cleanItems,
        }

        hintsPayload = {
          h1: 'Listen to the AI Coach carefully and check the classmate profile.',
          h2: 'Type your answer into the conversation box.',
        }
      } else if (authoringFormType === 'FORM_6_2_INTERVIEW_PROFILE') {
        const cleanItems = form62Items.map((item) => {
          const accepted = item.accepted_values
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
          if (accepted.length === 0 && item.target_answer.trim()) {
            accepted.push(item.target_answer.trim())
          }
          const questions = item.question_bank
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
          return {
            id: item.id,
            label: item.label.trim(),
            target_answer: item.target_answer.trim(),
            accepted_values: accepted,
            answer_audio_url: item.answer_audio_url?.trim() || undefined,
            answer_text_display: item.answer_text_display?.trim() || undefined,
            question_bank: questions,
            hints: item.hints?.trim() ? [item.hints.trim()] : [],
          }
        })

        contentPayload = {
          intro: taskIntro.trim() || 'Ask AI Tutor, fill in the profile, and hit Submit!',
          pass_score: Number(form62PassScore) || 80,
          items: cleanItems,
        }

        keysPayload = {
          pass_score: Number(form62PassScore) || 80,
          items: cleanItems,
        }

        hintsPayload = {
          h1: 'Ask questions to the AI Tutor to discover classmate information.',
          h2: 'Fill all fields in the profile, then click Submit.',
        }
      }

      const isCustomVoiceTask =
        authoringFormType === 'FORM_3_WRITING' ||
        authoringFormType === 'FORM_4_SPEAKING' ||
        authoringFormType === 'FORM_5_LISTEN_REPEAT' ||
        authoringFormType === 'FORM_6_1_PROFILE_QA' ||
        authoringFormType === 'FORM_6_2_INTERVIEW_PROFILE'

      if (!isCustomVoiceTask && taskAudioUrl.trim()) {
        contentPayload.audioUrl = taskAudioUrl.trim()
      }

      const finalUnit = Math.max(1, parseInt(String(taskUnit), 10) || 1)
      const finalLesson = Math.max(1, parseInt(String(taskLesson), 10) || 1)
      const finalNumber = Math.max(1, parseInt(String(taskNumber), 10) || 1)

      const taskContent = {
        ...contentPayload,
        audioUrl: !isCustomVoiceTask ? (taskAudioUrl.trim() || undefined) : undefined,
        unit: finalUnit,
        lesson: finalLesson,
      }

      const baseTaskPayload: any = {
        code: taskCode.trim(),
        worksheet: finalLesson,
        task_number: finalNumber,
        title: taskTitle.trim(),
        subtitle: taskSubtitle.trim(),
        form_type: authoringFormType,
        archetypes: ['standardized', authoringFormType.toLowerCase()],
        content: taskContent,
        is_published: true,
      }

      const { error: taskErr } = await supabase.from('tasks').upsert(baseTaskPayload)
      if (taskErr) throw taskErr

      const { error: policyErr } = await supabase.from('task_assessment_policies').upsert({
        task_code: taskCode.trim(),
        max_attempts: 2,
        keys_data: keysPayload,
        hints_data: hintsPayload,
      })

      if (policyErr) throw policyErr

      // Xóa cache cũ để người dùng nạp ngay bản mới nhất
      await taskCacheService.invalidateTask(taskCode.trim())

      const deletedCodes: string[] = JSON.parse(localStorage.getItem('gsec_deleted_tasks') || '[]')
      if (deletedCodes.includes(taskCode.trim())) {
        localStorage.setItem('gsec_deleted_tasks', JSON.stringify(deletedCodes.filter((c) => c !== taskCode.trim())))
      }

      setAuthoringStatus({
        success: true,
        text: `Đã ${editingTaskCode ? 'cập nhật' : 'lưu thành công'} bài tập ${taskCode.trim()} (Lesson ${finalLesson} - Task ${finalNumber})!`,
      })
    } catch (err: any) {
      console.error('Lỗi lưu bài tập:', err)
      setAuthoringStatus({
        success: false,
        text: `Lưu thất bại: ${err?.message || 'Lỗi không xác định.'}`,
      })
    } finally {
      setSavingTask(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '80px' }}>
      <AppHeader />

      {/* STICKY TOP STUDIO BAR */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          padding: '12px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* LEFT: BACK BUTTON & TITLE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <span>←</span>
              <span>Quay lại Quản trị</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  {editingTaskCode ? `✏️ Chỉnh Sửa Bài Tập #${editingTaskCode}` : '✨ Studio Soạn Bài Tập Mới'}
                </h1>
                <span
                  style={{
                    background: '#ede9fe',
                    color: '#6d28d9',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.3px',
                  }}
                >
                  {authoringFormType}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Soạn thảo trực quan toàn màn hình, hỗ trợ phát âm, âm thanh và chấm điểm AI
              </p>
            </div>
          </div>

          {/* RIGHT: ACTION BUTTONS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleSaveTask}
              disabled={savingTask}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: savingTask ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(109, 40, 217, 0.25)',
                opacity: savingTask ? 0.7 : 1,
              }}
            >
              <span>💾</span>
              <span>{savingTask ? 'Đang lưu bài...' : editingTaskCode ? 'Cập Nhật Bài Tập' : 'Lưu & Xuất Bản Bài'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN STUDIO CONTAINER */}
      <div style={{ maxWidth: '1280px', margin: '24px auto', padding: '0 24px' }}>
        {/* STATUS NOTIFICATION BANNER */}
        {authoringStatus && (
          <div
            style={{
              marginBottom: '20px',
              padding: '14px 20px',
              borderRadius: '10px',
              border: authoringStatus.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
              background: authoringStatus.success ? '#ecfdf5' : '#fef2f2',
              color: authoringStatus.success ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600 }}>
              <span>{authoringStatus.success ? '🎉' : '⚠️'}</span>
              <span>{authoringStatus.text}</span>
            </div>

            {authoringStatus.success && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => navigate(`/tasks/${taskCode.trim()}`)}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ▶ Mở xem ngay
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  style={{
                    background: '#ffffff',
                    color: '#047857',
                    border: '1px solid #6ee7b7',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← Về danh sách bài tập
                </button>
              </div>
            )}
          </div>
        )}

        {isLoadingEditTask ? (
          <div style={{ background: '#ffffff', padding: '60px 20px', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <div style={{ fontWeight: 600 }}>Đang tải dữ liệu bài tập #{editingTaskCode}...</div>
          </div>
        ) : (
          <form onSubmit={handleSaveTask}>
            {/* CARD 1: THÔNG TIN CƠ BẢN & ĐỊNH DANH BÀI TẬP */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '20px' }}>📋</span>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  1. Cấu hình Chung & Định danh Bài Tập
                </h2>
              </div>

              {/* ROW 1: Dạng bài & Mã bài */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Dạng bài (Form Archetype):
                  </label>
                  <select
                    className="auth-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}
                    value={authoringFormType}
                    onChange={(e) => setAuthoringFormType(e.target.value)}
                  >
                    <option value="FORM_1_CHOICE">FORM 1: Trắc nghiệm (A/B/C hoặc T/F)</option>
                    <option value="FORM_2_FILL">FORM 2: Điền từ vào chỗ trống (Fill in Blanks)</option>
                    <option value="FORM_3_WRITING">FORM 3: Viết câu / Đoạn văn (AI Tutor chấm điểm)</option>
                    <option value="FORM_4_SPEAKING">FORM 4: Đọc thành tiếng / Speaking</option>
                    <option value="FORM_5_LISTEN_REPEAT">FORM 5: Nghe & Nhại lại câu (Listen & Repeat)</option>
                    <option value="FORM_6_1_PROFILE_QA">FORM 6.1: Nghe & Trả lời thông tin nhân vật (Profile Q&A)</option>
                    <option value="FORM_6_2_INTERVIEW_PROFILE">FORM 6.2: Phỏng vấn điền thông tin nhân vật (Interview Profile)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Mã bài tập (5 chữ số):
                  </label>
                  <input
                    type="text"
                    className="auth-input"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: editingTaskCode ? '#f8fafc' : '#ffffff',
                    }}
                    placeholder="Ví dụ: 60115"
                    value={taskCode}
                    onChange={(e) => setTaskCode(e.target.value)}
                    readOnly={Boolean(editingTaskCode)}
                  />
                  {editingTaskCode && (
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      🔒 Mã bài tập được cố định trong chế độ sửa để bảo toàn lịch sử học tập.
                    </span>
                  )}
                  {!editingTaskCode && taskCode.trim() && hasTask(taskCode.trim()) && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        fontSize: '12px',
                        lineHeight: 1.45,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                      <span>
                        <strong>Mã bài này trùng với 1 trong 32 bài cũ ({taskCode.trim()}).</strong> Khi lưu, bài tập mới này sẽ <strong>ghi đè và thay thế</strong> bài cũ khi học sinh mở làm bài. Nếu bạn muốn tạo bài hoàn toàn riêng biệt, hãy chọn mã số khác (ví dụ: 60171, 60181, 60201...).
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ROW 2: Unit, Lesson, Task # */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Unit:
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="auth-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                    value={taskUnit}
                    onChange={(e) => handleUnitChange(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Lesson (Worksheet #):
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="auth-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                    value={taskLesson}
                    onChange={(e) => handleLessonChange(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Bài số (Task #):
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="auth-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                    value={taskNumber}
                    onChange={(e) => handleTaskNumberChange(e.target.value)}
                  />
                </div>
              </div>

              {/* ROW 3: Tiêu đề & Lời dẫn dắt */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Tiêu đề bài tập (Tự động theo Lesson & Task):
                  </label>
                  <input
                    type="text"
                    className="auth-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Lời dẫn dắt của AI Tutor (Intro Text):
                  </label>
                  <input
                    type="text"
                    className="auth-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                    placeholder="Check Task 1. Enter your answers."
                    value={taskIntro}
                    onChange={(e) => setTaskIntro(e.target.value)}
                  />
                </div>
              </div>

              {/* AUDIO TỔNG (Nếu là Form 1 hoặc Form 2) */}
              {(authoringFormType === 'FORM_1_CHOICE' || authoringFormType === 'FORM_2_FILL') && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    marginTop: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                      🎧 File âm thanh bài nghe chung (Tùy chọn - Dành cho bài Listening):
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Hỗ trợ MP3, WAV, M4A</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={audioInputRef}
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={handleAudioFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      disabled={isUploadingAudio}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #fbcfe8',
                        background: '#fdf2f8',
                        color: '#be185d',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <span>📁</span>
                      <span>{isUploadingAudio ? 'Đang tải file lên...' : 'Tải file âm thanh từ máy'}</span>
                    </button>

                    {taskAudioUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                        {taskAudioName && <span style={{ fontSize: '12px', color: '#64748b' }}>({taskAudioName})</span>}
                        <audio controls src={taskAudioUrl} style={{ height: '36px', flex: 1 }} />
                        <button
                          type="button"
                          onClick={handleRemoveAudio}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fff',
                            color: '#dc2626',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Xóa audio
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: KHU VỰC SOẠN THẢO CHI TIẾT THEO TỪNG FORM ARCHETYPE */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '20px' }}>✍️</span>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  2. Nội dung Chi Tiết & Ngân Hàng Câu Hỏi ({authoringFormType})
                </h2>
              </div>

              {/* ================= BUILDER FORM 1: TRẮC NGHIỆM ================= */}
              {authoringFormType === 'FORM_1_CHOICE' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Các lựa chọn trắc nghiệm (Phân cách bằng dấu phẩy):
                    </label>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                      value={choiceOptionsText}
                      onChange={(e) => setChoiceOptionsText(e.target.value)}
                      placeholder="A, B, C hoặc T, F"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Danh sách Câu hỏi & Đáp án bí mật ({choiceItems.length} câu):
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setChoiceItems([
                          ...choiceItems,
                          {
                            label: `Question ${choiceItems.length + 1}`,
                            cue: `Look back at Question ${choiceItems.length + 1}.`,
                            correct: 'A',
                            hints: ['', ''],
                            audio_url: '',
                          },
                        ])
                      }
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #c4b5fd',
                        background: '#f5f3ff',
                        color: '#6d28d9',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      + Thêm câu hỏi
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {choiceItems.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                            Câu hỏi #{index + 1}
                          </span>
                          {choiceItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setChoiceItems(choiceItems.filter((_, i) => i !== index))}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✕ Xóa câu
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Tiêu đề / Nội dung câu:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                              value={item.label}
                              onChange={(e) => {
                                const next = [...choiceItems]
                                next[index].label = e.target.value
                                setChoiceItems(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Đáp án đúng:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 800, color: '#047857' }}
                              value={item.correct}
                              onChange={(e) => {
                                const next = [...choiceItems]
                                next[index].correct = e.target.value.toUpperCase()
                                setChoiceItems(next)
                              }}
                            />
                          </div>
                        </div>

                        {/* File âm thanh câu hỏi */}
                        <div style={{ marginBottom: '12px', padding: '10px', background: '#ffffff', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                            🎧 Audio câu hỏi (Tùy chọn):
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                              placeholder="Dán link audio (mp3/wav) hoặc bấm tải file từ máy..."
                              value={item.audio_url || ''}
                              onChange={(e) => {
                                const next = [...choiceItems]
                                next[index].audio_url = e.target.value
                                setChoiceItems(next)
                              }}
                            />
                            <label
                              style={{
                                padding: '7px 12px',
                                borderRadius: '6px',
                                border: '1px solid #fbcfe8',
                                background: '#fdf2f8',
                                color: '#be185d',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              📁 Tải file
                              <input
                                type="file"
                                accept="audio/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleChoiceItemAudioUpload(index, e)}
                              />
                            </label>
                          </div>
                          {item.audio_url && (
                            <audio controls src={item.audio_url} style={{ height: '32px', width: '100%', marginTop: '6px' }} />
                          )}
                        </div>

                        {/* Gợi ý 1 & 2 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              💡 Gợi ý lần 1:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                              placeholder="Gợi ý khi học sinh chọn sai lần 1..."
                              value={item.hints[0] || ''}
                              onChange={(e) => {
                                const next = [...choiceItems]
                                next[index].hints[0] = e.target.value
                                setChoiceItems(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              💡 Gợi ý lần 2:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                              placeholder="Gợi ý khi học sinh chọn sai lần 2..."
                              value={item.hints[1] || ''}
                              onChange={(e) => {
                                const next = [...choiceItems]
                                next[index].hints[1] = e.target.value
                                setChoiceItems(next)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= BUILDER FORM 2: ĐIỀN TỪ ================= */}
              {authoringFormType === 'FORM_2_FILL' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Danh sách Chỗ trống cần điền ({fillItems.length} câu):
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setFillItems([
                          ...fillItems,
                          {
                            label: String(fillItems.length + 1),
                            placeholder: 'Your answer',
                            correctAnswers: '',
                            hints: ['', ''],
                          },
                        ])
                      }
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #c4b5fd',
                        background: '#f5f3ff',
                        color: '#6d28d9',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      + Thêm ô điền từ
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {fillItems.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                            Chỗ trống #{index + 1}
                          </span>
                          {fillItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFillItems(fillItems.filter((_, i) => i !== index))}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✕ Xóa ô
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Nhãn / Số thứ tự:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                              value={item.label}
                              onChange={(e) => {
                                const next = [...fillItems]
                                next[index].label = e.target.value
                                setFillItems(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Các đáp án chấp nhận (chữ cái a, b, c, d hoặc từ, cụm từ - phân cách bằng dấu phẩy):
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 700, color: '#047857' }}
                              placeholder="Ví dụ: a, study (chấp nhận cả chữ cái hoặc từ)"
                              value={item.correctAnswers}
                              onChange={(e) => {
                                const next = [...fillItems]
                                next[index].correctAnswers = e.target.value
                                setFillItems(next)
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              💡 Gợi ý lần 1:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                              value={item.hints[0] || ''}
                              onChange={(e) => {
                                const next = [...fillItems]
                                next[index].hints[0] = e.target.value
                                setFillItems(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              💡 Gợi ý lần 2:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                              value={item.hints[1] || ''}
                              onChange={(e) => {
                                const next = [...fillItems]
                                next[index].hints[1] = e.target.value
                                setFillItems(next)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= BUILDER FORM 3: VIẾT CÂU & ĐOẠN VĂN ================= */}
              {authoringFormType === 'FORM_3_WRITING' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      background: '#f1f5f9',
                      padding: '4px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setForm3SubMode('FREE_SENTENCE')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: form3SubMode === 'FREE_SENTENCE' ? '#ffffff' : 'transparent',
                        color: form3SubMode === 'FREE_SENTENCE' ? '#0f172a' : '#64748b',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: form3SubMode === 'FREE_SENTENCE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      📝 Chế độ 3.1: Viết Câu Tự Do (Free Sentence)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm3SubMode('BOOK_KEYWORD')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: form3SubMode === 'BOOK_KEYWORD' ? '#ffffff' : 'transparent',
                        color: form3SubMode === 'BOOK_KEYWORD' ? '#0f172a' : '#64748b',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: form3SubMode === 'BOOK_KEYWORD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      📖 Chế độ 3.2: Đặt câu theo từ khóa sách (Book Keywords)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm3SubMode('PARAGRAPH')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: form3SubMode === 'PARAGRAPH' ? '#ffffff' : 'transparent',
                        color: form3SubMode === 'PARAGRAPH' ? '#0f172a' : '#64748b',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: form3SubMode === 'PARAGRAPH' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      📄 Chế độ 3.3: Viết Đoạn Văn (Paragraph)
                    </button>
                  </div>

                  {/* Ô NHẬP TIÊU CHÍ CHẤM ĐIỂM CỦA AI CHO FORM 3 (ÁP DỤNG CHO CẢ 3.1 VÀ 3.2) */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13.5px',
                        fontWeight: 750,
                        color: '#0f172a',
                        marginBottom: '6px',
                      }}
                    >
                      <span>🎯</span>
                      <span>Tiêu chí chấm điểm của AI (Áp dụng cho Form 3.1 & 3.2):</span>
                    </label>
                    <textarea
                      className="auth-input"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        lineHeight: 1.5,
                        resize: 'vertical',
                      }}
                      placeholder="Ví dụ: Bắt buộc dùng thì quá khứ đơn, viết hoa chữ cái đầu câu, kết thúc bằng dấu chấm (.), không dùng từ viết tắt, câu phải có tối thiểu 5 từ và diễn đạt chuẩn ngữ pháp..."
                      value={form3ScoringCriteria}
                      onChange={(e) => setForm3ScoringCriteria(e.target.value)}
                    />
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                      💡 <strong>Hướng dẫn:</strong> Giáo viên nhập các yêu cầu cụ thể (thì ngữ pháp, viết hoa, dấu câu, từ vựng...). AI Tutor (Gemini) sẽ đối chiếu sát sao tiêu chí này khi chấm câu của học sinh ở cả <strong>Form 3.1 & 3.2</strong>, trừ điểm nếu vi phạm và yêu cầu sửa lại.
                    </p>
                  </div>

                  {form3SubMode !== 'PARAGRAPH' ? (
                    <div>
                      {form3SubMode === 'BOOK_KEYWORD' && (
                        <div
                          style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '16px',
                            fontSize: '12.5px',
                            color: '#166534',
                            lineHeight: 1.5,
                          }}
                        >
                          📖 <strong>Chế độ 3.2 (Đặt câu theo từ khóa trong sách bài tập):</strong> Học sinh quan sát từ gợi ý trong sách bài tập để đặt câu. Bạn hãy nhập các từ gợi ý vào ô "Từ khóa bắt buộc" của mỗi câu. Hệ thống sẽ đảm bảo học sinh dùng đủ từ gợi ý trước khi AI chấm điểm!
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                          Danh sách Câu hỏi viết ({writingItems.length} câu):
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setWritingItems([
                              ...writingItems,
                              {
                                label: `Question ${writingItems.length + 1}`,
                                prompt: '',
                                sentence_starter: '',
                                sentence_ending: '',
                                requiredWords: '',
                                hints: ['Sử dụng thì hiện tại đơn.', 'Kiểm tra chủ ngữ và chia động từ.'],
                                scoring_criteria: '',
                              },
                            ])
                          }
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #c4b5fd',
                            background: '#f5f3ff',
                            color: '#6d28d9',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Thêm câu viết
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {writingItems.map((item, index) => (
                          <div
                            key={index}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '16px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                                Câu viết #{index + 1}
                              </span>
                              {writingItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setWritingItems(writingItems.filter((_, i) => i !== index))}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#ef4444',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✕ Xóa câu
                                </button>
                              )}
                            </div>

                            {/* DÒNG TỪ GỢI Ý CHO TRƯỚC (SENTENCE STARTER) */}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1.4fr 1fr',
                                gap: '12px',
                                marginBottom: '12px',
                                background: '#f0fdf4',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: 750,
                                    color: '#166534',
                                    marginBottom: '4px',
                                  }}
                                >
                                  <span>✍️</span>
                                  <span>Từ/Cụm từ mở đầu cho trước (Sentence Starter):</span>
                                </label>
                                <input
                                  type="text"
                                  className="auth-input"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 700, color: '#15803d', background: '#ffffff' }}
                                  placeholder="Ví dụ: My school is / In my school bag, I have / I feel..."
                                  value={item.sentence_starter || ''}
                                  onChange={(e) => {
                                    const next = [...writingItems]
                                    next[index].sentence_starter = e.target.value
                                    setWritingItems(next)
                                  }}
                                />
                                <span style={{ fontSize: '11px', color: '#166534', marginTop: '3px', display: 'block', opacity: 0.9 }}>
                                  💡 Học sinh thấy cụm từ này ở đầu câu và chỉ cần viết tiếp. AI sẽ tự động gộp cả câu để chấm.
                                </span>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                                  Phần kết câu cho trước (tùy chọn):
                                </label>
                                <input
                                  type="text"
                                  className="auth-input"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', color: '#15803d', background: '#ffffff' }}
                                  placeholder="Ví dụ: at school. / in my bedroom."
                                  value={item.sentence_ending || ''}
                                  onChange={(e) => {
                                    const next = [...writingItems]
                                    next[index].sentence_ending = e.target.value
                                    setWritingItems(next)
                                  }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                                  (Để trống nếu học sinh tự viết kết thúc câu)
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                                  Đề bài / Yêu cầu viết (Prompt):
                                </label>
                                <input
                                  type="text"
                                  className="auth-input"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                                  placeholder="Write a sentence about your friend."
                                  value={item.prompt}
                                  onChange={(e) => {
                                    const next = [...writingItems]
                                    next[index].prompt = e.target.value
                                    setWritingItems(next)
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                                  Từ khóa bắt buộc xuất hiện trong câu (Phân cách bằng dấu phẩy):
                                </label>
                                <input
                                  type="text"
                                  className="auth-input"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 700, color: '#7c3aed' }}
                                  placeholder="usually, badminton"
                                  value={item.requiredWords}
                                  onChange={(e) => {
                                    const next = [...writingItems]
                                    next[index].requiredWords = e.target.value
                                    setWritingItems(next)
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                                💡 Gợi ý ngữ pháp cho học sinh (Mỗi gợi ý 1 dòng):
                              </label>
                              <textarea
                                className="auth-input"
                                rows={2}
                                style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                                value={item.hints?.join('\n') || ''}
                                onChange={(e) => {
                                  const next = [...writingItems]
                                  next[index].hints = e.target.value.split('\n')
                                  setWritingItems(next)
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                                🎯 Tiêu chí chấm điểm riêng cho câu này (Tùy chọn - bổ sung thêm):
                              </label>
                              <input
                                type="text"
                                className="auth-input"
                                style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                                placeholder="Ví dụ: Bắt buộc dùng liên từ 'because' hoặc chia đúng thì hoàn thành..."
                                value={item.scoring_criteria || ''}
                                onChange={(e) => {
                                  const next = [...writingItems]
                                  next[index].scoring_criteria = e.target.value
                                  setWritingItems(next)
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          Đề bài viết đoạn văn:
                        </label>
                        <textarea
                          className="auth-input"
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                          value={paragraphPrompt}
                          onChange={(e) => setParagraphPrompt(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Số từ tối thiểu (Min words):
                          </label>
                          <input
                            type="number"
                            min="10"
                            className="auth-input"
                            style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                            value={paragraphMinWords}
                            onChange={(e) => setParagraphMinWords(Number(e.target.value))}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Số từ tối đa (Max words):
                          </label>
                          <input
                            type="number"
                            min="20"
                            className="auth-input"
                            style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                            value={paragraphMaxWords}
                            onChange={(e) => setParagraphMaxWords(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          Từ gợi ý cho đoạn văn (Helper Words - Phân cách bằng dấu phẩy):
                        </label>
                        <input
                          type="text"
                          className="auth-input"
                          style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                          value={paragraphHelperWords}
                          onChange={(e) => setParagraphHelperWords(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Tiêu chí chấm điểm (Mỗi tiêu chí 1 dòng):
                          </label>
                          <textarea
                            className="auth-input"
                            rows={4}
                            style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                            value={paragraphCriteria.join('\n')}
                            onChange={(e) => setParagraphCriteria(e.target.value.split('\n'))}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Gợi ý viết bài (Mỗi gợi ý 1 dòng):
                          </label>
                          <textarea
                            className="auth-input"
                            rows={4}
                            style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                            value={paragraphHints.join('\n')}
                            onChange={(e) => setParagraphHints(e.target.value.split('\n'))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= BUILDER FORM 4: SPEAKING ================= */}
              {authoringFormType === 'FORM_4_SPEAKING' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '18px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        Mã bài tập viết liên kết (Linked Task Code):
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700 }}
                        value={speakingLinkedTaskCode}
                        onChange={(e) => setSpeakingLinkedTaskCode(e.target.value)}
                      />
                      <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                        Học sinh sẽ đọc lại các câu đã hoàn thành và được duyệt ở bài Form 3 này.
                      </p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        Điểm chuẩn vượt qua (Pass Score: {speakingPassScore}%):
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        step="5"
                        style={{ width: '100%', marginTop: '10px' }}
                        value={speakingPassScore}
                        onChange={(e) => setSpeakingPassScore(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Ô NHẬP TIÊU CHÍ CHẤM ĐIỂM CỦA AI */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 750, color: '#0f172a', marginBottom: '6px' }}>
                      <span>🎯</span>
                      <span>Tiêu chí chấm điểm của AI (Scoring Criteria & Rubric):</span>
                    </label>
                    <textarea
                      className="auth-input"
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5, resize: 'vertical' }}
                      placeholder="Ví dụ: Chấm chặt chẽ âm đuôi (/s/, /z/, /ed/, /t/), ngữ điệu tự nhiên, không chấp nhận nuốt âm, phát âm tròn vành rõ chữ từng từ..."
                      value={speakingCriteria}
                      onChange={(e) => setSpeakingCriteria(e.target.value)}
                    />
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                      💡 <strong>Hướng dẫn:</strong> Giáo viên có thể nhập các yêu cầu cụ thể (ví dụ: phát âm rõ âm đuôi, nhấn trọng âm, tốc độ đọc vừa phải...). AI sẽ dựa trực tiếp vào tiêu chí này để chấm điểm chuẩn xác, trừ điểm các lỗi vi phạm và đưa ra nhận xét sư phạm sát sao cho học sinh.
                    </p>
                  </div>
                </div>
              )}

              {/* ================= BUILDER FORM 5: LISTEN & REPEAT ================= */}
              {authoringFormType === 'FORM_5_LISTEN_REPEAT' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Điểm chuẩn hoàn thành (Pass Score: {form5PassScore}%):
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      style={{ width: '320px' }}
                      value={form5PassScore}
                      onChange={(e) => setForm5PassScore(Number(e.target.value))}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Danh sách Câu phát âm mẫu ({form5Items.length} câu):
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setForm5Items([
                          ...form5Items,
                          {
                            id: `item-${form5Items.length + 1}`,
                            label: `Sentence ${form5Items.length + 1}`,
                            target_text: '',
                            audio_url: '',
                            hints: ['Nghe kỹ ngữ điệu và phát âm rõ từng từ.'],
                          },
                        ])
                      }
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #c4b5fd',
                        background: '#f5f3ff',
                        color: '#6d28d9',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      + Thêm câu nghe nhại
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {form5Items.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                            Câu #{index + 1}: {item.label}
                          </span>
                          {form5Items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setForm5Items(form5Items.filter((_, i) => i !== index))}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✕ Xóa câu
                            </button>
                          )}
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                            Nội dung câu tiếng Anh cần phát âm (Target text):
                          </label>
                          <input
                            type="text"
                            className="auth-input"
                            style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 600 }}
                            value={item.target_text}
                            onChange={(e) => {
                              const next = [...form5Items]
                              next[index].target_text = e.target.value
                              setForm5Items(next)
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              🎧 File âm thanh mẫu:
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="auth-input"
                                style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                                placeholder="Dán link audio hoặc tải file..."
                                value={item.audio_url || ''}
                                onChange={(e) => {
                                  const next = [...form5Items]
                                  next[index].audio_url = e.target.value
                                  setForm5Items(next)
                                }}
                              />
                              <label
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #fbcfe8',
                                  background: '#fdf2f8',
                                  color: '#be185d',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                📁 Tải file
                                <input
                                  type="file"
                                  accept="audio/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleItemAudioUpload(index, e)}
                                />
                              </label>
                            </div>
                            {item.audio_url && (
                              <audio controls src={item.audio_url} style={{ height: '32px', width: '100%', marginTop: '6px' }} />
                            )}
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              💡 Gợi ý phát âm:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                              value={item.hints?.[0] || ''}
                              onChange={(e) => {
                                const next = [...form5Items]
                                next[index].hints = [e.target.value]
                                setForm5Items(next)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= BUILDER FORM 6.1: PROFILE Q&A ================= */}
              {authoringFormType === 'FORM_6_1_PROFILE_QA' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Tiêu đề hồ sơ nhân vật (Profile Title):
                    </label>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}
                      value={form61ProfileTitle}
                      onChange={(e) => setForm61ProfileTitle(e.target.value)}
                    />
                  </div>

                  <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    4 Trường thông tin & Audio bài nghe:
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {form61Items.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <span
                            style={{
                              background: index === 0 ? '#10b981' : '#3b82f6',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {index === 0 ? 'Phát đầu tiên' : `Đoạn ngẫu nhiên #${index}`}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                            Trường #{index + 1}: {item.label}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Tên trường / Nhãn:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                              value={item.label}
                              onChange={(e) => {
                                const next = [...form61Items]
                                next[index].label = e.target.value
                                setForm61Items(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Giá trị thông tin (Hiển thị trong hồ sơ):
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}
                              value={item.profile_value}
                              onChange={(e) => {
                                const next = [...form61Items]
                                next[index].profile_value = e.target.value
                                setForm61Items(next)
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                            🎧 File âm thanh đoạn nói (Audio URL):
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                              placeholder="Dán link audio hoặc tải file..."
                              value={item.audio_url || ''}
                              onChange={(e) => {
                                const next = [...form61Items]
                                next[index].audio_url = e.target.value
                                setForm61Items(next)
                              }}
                            />
                            <label
                              style={{
                                padding: '7px 12px',
                                borderRadius: '6px',
                                border: '1px solid #fbcfe8',
                                background: '#fdf2f8',
                                color: '#be185d',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              📁 Tải file
                              <input
                                type="file"
                                accept="audio/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleForm61AudioUpload(index, e)}
                              />
                            </label>
                          </div>
                          {item.audio_url && (
                            <audio controls src={item.audio_url} style={{ height: '32px', width: '100%', marginTop: '6px' }} />
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Đáp án chấm điểm (Mỗi đáp án 1 dòng):
                            </label>
                            <textarea
                              className="auth-input"
                              rows={3}
                              style={{ width: '100%', padding: '8px 10px', fontSize: '12px', color: '#047857', fontWeight: 600 }}
                              value={item.accepted_answers}
                              onChange={(e) => {
                                const next = [...form61Items]
                                next[index].accepted_answers = e.target.value
                                setForm61Items(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              💡 Gợi ý cho học sinh:
                            </label>
                            <textarea
                              className="auth-input"
                              rows={3}
                              style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                              value={item.hints || ''}
                              onChange={(e) => {
                                const next = [...form61Items]
                                next[index].hints = e.target.value
                                setForm61Items(next)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= BUILDER FORM 6.2: INTERVIEW PROFILE ================= */}
              {authoringFormType === 'FORM_6_2_INTERVIEW_PROFILE' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Điểm chuẩn hoàn thành (Pass Score: {form62PassScore}%):
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      style={{ width: '320px' }}
                      value={form62PassScore}
                      onChange={(e) => setForm62PassScore(Number(e.target.value))}
                    />
                  </div>

                  <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    4 Trường phỏng vấn & Ngân hàng câu hỏi:
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {form62Items.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '18px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <span
                            style={{
                              background: '#3b82f6',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Trường #{index + 1}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                            {item.label}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Tên trường / Nhãn:
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                              value={item.label}
                              onChange={(e) => {
                                const next = [...form62Items]
                                next[index].label = e.target.value
                                setForm62Items(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Đáp án chuẩn cần điền vào hồ sơ (Target Answer):
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}
                              value={item.target_answer}
                              onChange={(e) => {
                                const next = [...form62Items]
                                next[index].target_answer = e.target.value
                                setForm62Items(next)
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Câu nói trả lời của AI Tutor (Answer text display):
                            </label>
                            <input
                              type="text"
                              className="auth-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                              value={item.answer_text_display || ''}
                              onChange={(e) => {
                                const next = [...form62Items]
                                next[index].answer_text_display = e.target.value
                                setForm62Items(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              🎧 Audio câu trả lời của AI:
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="auth-input"
                                style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                                placeholder="Dán link audio hoặc tải file..."
                                value={item.answer_audio_url || ''}
                                onChange={(e) => {
                                  const next = [...form62Items]
                                  next[index].answer_audio_url = e.target.value
                                  setForm62Items(next)
                                }}
                              />
                              <label
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #fbcfe8',
                                  background: '#fdf2f8',
                                  color: '#be185d',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                📁 Tải file
                                <input
                                  type="file"
                                  accept="audio/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleForm62AudioUpload(index, e)}
                                />
                              </label>
                            </div>
                            {item.answer_audio_url && (
                              <audio controls src={item.answer_audio_url} style={{ height: '32px', width: '100%', marginTop: '6px' }} />
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Ngân hàng câu hỏi của học sinh (Mỗi câu hỏi chấp nhận 1 dòng):
                            </label>
                            <textarea
                              className="auth-input"
                              rows={4}
                              style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                              value={item.question_bank}
                              onChange={(e) => {
                                const next = [...form62Items]
                                next[index].question_bank = e.target.value
                                setForm62Items(next)
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                              Các giá trị điền được chấp nhận (Mỗi giá trị 1 dòng):
                            </label>
                            <textarea
                              className="auth-input"
                              rows={4}
                              style={{ width: '100%', padding: '8px 10px', fontSize: '12px', color: '#047857', fontWeight: 600 }}
                              value={item.accepted_values}
                              onChange={(e) => {
                                const next = [...form62Items]
                                next[index].accepted_values = e.target.value
                                setForm62Items(next)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 3: HÀNH ĐỘNG & XUẤT BẢN */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Quay lại Quản trị
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={savingTask}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: savingTask ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(109, 40, 217, 0.3)',
                    opacity: savingTask ? 0.7 : 1,
                  }}
                >
                  <span>💾</span>
                  <span>{savingTask ? 'Đang lưu bài tập...' : editingTaskCode ? 'Cập Nhật Bài Tập' : 'Lưu & Xuất Bản Bài Tập'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
