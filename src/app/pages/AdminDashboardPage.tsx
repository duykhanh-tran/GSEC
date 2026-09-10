import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../auth'
import { TASKS } from '../registry'
import { AppHeader } from '../../components/shell/AppHeader'
import '../../styles/portal.css'
import '../../styles/auth.css'

interface TaskListItem {
  code: string
  unit?: number
  worksheet: number
  lesson?: number
  task_number: number
  title: string
  subtitle: string
  form_type: string
  is_published: boolean
  is_custom?: boolean
  updated_at?: string
}

interface ClassOption {
  id: string
  name: string
  code: string
  teacher_name?: string
  teacher_email?: string
  student_count?: number
  created_at?: string
}

interface AssignmentItem {
  id: string
  task_code: string
  due_date: string | null
  created_at: string
  classes?: { name: string; code: string }
  tasks?: { title: string; subtitle?: string; form_type?: string }
}

interface GradebookAttemptItem {
  id: string
  student_id: string
  student_name?: string
  student_email?: string
  student_username?: string
  class_id?: string
  class_name?: string
  class_code?: string
  task_code: string
  first_score?: number | null
  score: number
  max_score: number
  status: 'completed' | 'in_progress'
  attempt_count: number
  completed_at?: string | null
  updated_at?: string | null
  created_at: string
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [activeTab, setActiveTab] = useState<'tasks' | 'assignments' | 'gradebook' | 'classes'>('tasks')

  // Tasks state
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [taskFilterWs, setTaskFilterWs] = useState<string>('ALL')
  const [taskFilterForm, setTaskFilterForm] = useState<string>('ALL')
  const [taskSearch, setTaskSearch] = useState<string>('')

  // Assignment states
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [assignTaskCode, setAssignTaskCode] = useState('')
  const [assignDueDate, setAssignDueDate] = useState('')
  const [assignMessage, setAssignMessage] = useState<{ success: boolean; text: string } | null>(null)
  const [isDeletingAssignId, setIsDeletingAssignId] = useState<string | null>(null)
  const [isDeletingTaskCode, setIsDeletingTaskCode] = useState<string | null>(null)
  const [taskActionFeedback, setTaskActionFeedback] = useState<{ success: boolean; text: string } | null>(null)

  // Gradebook states
  const [attempts, setAttempts] = useState<GradebookAttemptItem[]>([])
  const [gradebookClassFilter, setGradebookClassFilter] = useState<string>('ALL')
  const [gradebookStatusFilter, setGradebookStatusFilter] = useState<'ALL' | 'completed' | 'in_progress'>('ALL')
  const [gradebookSearch, setGradebookSearch] = useState<string>('')
  const [isRefreshingGradebook, setIsRefreshingGradebook] = useState(false)

  // Authoring Modal states
  const [isAuthoringOpen, setIsAuthoringOpen] = useState(false)
  const [authoringFormType, setAuthoringFormType] = useState<string>('FORM_1_CHOICE')
  const [taskCode, setTaskCode] = useState('')
  const [taskUnit, setTaskUnit] = useState<number | string>(1)
  const [taskLesson, setTaskLesson] = useState<number | string>(1)
  const [taskNumber, setTaskNumber] = useState<number | string>(1)
  const [taskTitle, setTaskTitle] = useState('AI Tutor • WS 1 - Task 1')
  const [taskSubtitle, setTaskSubtitle] = useState('Unit 1')
  const [taskIntro, setTaskIntro] = useState('')

  // Audio Upload states
  const [taskAudioUrl, setTaskAudioUrl] = useState('')
  const [taskAudioName, setTaskAudioName] = useState('')
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setTaskAudioName(file.name)
    setIsUploadingAudio(true)

    // 1. Đọc data URL làm bản lưu an toàn
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64Url = ev.target?.result as string
      setTaskAudioUrl(base64Url)

      // 2. Thử upload lên Supabase Storage bucket 'task-audio' nếu có
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

  const openAuthoringModal = () => {
    const nextLesson = 1
    const nextNum = 1
    setTaskUnit(1)
    setTaskLesson(nextLesson)
    setTaskNumber(nextNum)
    setTaskCode(`601${tasks.length + 1}`)
    setTaskTitle(getAutoTaskTitle(nextLesson, nextNum))
    setTaskSubtitle('Unit 1')
    setTaskIntro('Check Task 1. Enter your answers.')
    setTaskAudioUrl('')
    setTaskAudioName('')
    if (audioInputRef.current) {
      audioInputRef.current.value = ''
    }
    setIsAuthoringOpen(true)
  }

  // Question builders
  const [choiceItems, setChoiceItems] = useState<
    Array<{ label: string; cue: string; correct: string; hints: string[] }>
  >([
    { label: 'Question 1', cue: 'Look back at Question 1.', correct: 'A', hints: ['', ''] },
    { label: 'Question 2', cue: 'Look back at Question 2.', correct: 'B', hints: ['', ''] },
  ])
  const [choiceOptionsText, setChoiceOptionsText] = useState('A, B, C')

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

  const [savingTask, setSavingTask] = useState(false)
  const [authoringStatus, setAuthoringStatus] = useState<{ success: boolean; text: string } | null>(null)

  const isAdmin = profile?.role === 'ADMIN'

  // 1. Tải danh sách Task (Kết hợp 32 bài chuẩn hóa trong hệ thống + bài tạo mới từ Supabase)
  // TỐI ƯU: Không select cột 'content' ở đây để tránh tải file âm thanh Base64 nặng 1.4MB về bảng danh sách!
  const loadTasks = useCallback(async () => {
    setLoadingTasks(true)
    const { data: dbTasks } = await supabase
      .from('tasks')
      .select('code, worksheet, task_number, title, subtitle, form_type, is_published, updated_at')
      .order('worksheet', { ascending: true })
      .order('task_number', { ascending: true })

    const dbMap = new Map<string, any>()
    if (dbTasks) {
      dbTasks.forEach((t) => dbMap.set(t.code, t))
    }

    // Gộp bài từ TASKS registry
    const catalogList: TaskListItem[] = TASKS.map((t) => {
      const dbItem = dbMap.get(t.code)
      if (dbItem) {
        const itemLesson = dbItem.worksheet || 1
        const unitMatch = (dbItem.subtitle || '').match(/Unit\s*(\d+)/i)
        const itemUnit = unitMatch ? parseInt(unitMatch[1], 10) : 1
        return {
          code: dbItem.code,
          unit: itemUnit,
          worksheet: dbItem.worksheet,
          lesson: itemLesson,
          task_number: dbItem.task_number,
          title: dbItem.title,
          subtitle: dbItem.subtitle || t.subtitle,
          form_type: dbItem.form_type || 'FORM_1_CHOICE',
          is_published: dbItem.is_published ?? true,
          is_custom: false,
          updated_at: dbItem.updated_at,
        }
      }

      // Xác định form_type từ archetypes
      let formType = 'FORM_1_CHOICE'
      if (t.archetypes.includes('answer-entry')) formType = 'FORM_2_FILL'
      else if (t.archetypes.includes('writing-repair')) formType = 'FORM_4_SENTENCE_REPAIR'
      else if (t.archetypes.includes('sequence-ordering')) formType = 'FORM_5_SEQUENCE'

      return {
        code: t.code,
        unit: 1,
        worksheet: t.worksheet,
        lesson: t.worksheet,
        task_number: t.taskNumber,
        title: t.title,
        subtitle: t.subtitle,
        form_type: formType,
        is_published: true,
        is_custom: false,
      }
    })

    // Thêm các task mới do Admin tạo mà không có trong TASKS registry (ví dụ: 60171)
    if (dbTasks) {
      dbTasks.forEach((dbT) => {
        if (!catalogList.some((c) => c.code === dbT.code)) {
          const tLesson = dbT.worksheet || 1
          const unitMatch = (dbT.subtitle || '').match(/Unit\s*(\d+)/i)
          const tUnit = unitMatch ? parseInt(unitMatch[1], 10) : 1
          catalogList.push({
            code: dbT.code,
            unit: tUnit,
            worksheet: dbT.worksheet || tLesson,
            lesson: tLesson,
            task_number: dbT.task_number,
            title: dbT.title,
            subtitle: dbT.subtitle || '',
            form_type: dbT.form_type || 'FORM_1_CHOICE',
            is_published: dbT.is_published ?? true,
            is_custom: true,
            updated_at: dbT.updated_at,
          })
        }
      })
    }

    // Sắp xếp bài tập: Ưu tiên theo Lesson (worksheet) tăng dần, sau đó task_number tăng dần
    catalogList.sort((a, b) => {
      const wsA = a.worksheet || a.lesson || 1
      const wsB = b.worksheet || b.lesson || 1
      if (wsA !== wsB) {
        return wsA - wsB
      }
      return (a.task_number || 0) - (b.task_number || 0)
    })

    // Lọc bỏ các bài đã được Admin xóa (đặc biệt các bài catalog tĩnh)
    const deletedCodes: string[] = JSON.parse(localStorage.getItem('gsec_deleted_tasks') || '[]')
    const finalCatalog = catalogList.filter((c) => !deletedCodes.includes(c.code))

    setTasks(finalCatalog)
    setLoadingTasks(false)
  }, [])

  // 2. Tải danh sách lớp và bài tập được giao (Có fallback chống lỗi PGRST201)
  const loadClassesAndAssignments = useCallback(async () => {
    try {
      // 2.1. Lấy danh sách lớp học
      let rawClasses: any[] = []
      const { data: cData, error: cErr } = await supabase
        .from('classes')
        .select('id, name, code, created_at, teacher_id, teacher:profiles!classes_teacher_id_fkey(full_name, email)')
        .order('name')

      if (!cErr && cData) {
        rawClasses = cData
      } else {
        // Fallback: Lấy plain classes rồi join profiles thủ công
        const { data: plainClasses, error: plainErr } = await supabase
          .from('classes')
          .select('*')
          .order('name')

        if (plainClasses) {
          const teacherIds = Array.from(new Set(plainClasses.map((c: any) => c.teacher_id).filter(Boolean)))
          const teacherMap: Record<string, any> = {}
          if (teacherIds.length > 0) {
            const { data: tProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', teacherIds)
            if (tProfiles) {
              tProfiles.forEach((tp: any) => { teacherMap[tp.id] = tp })
            }
          }
          rawClasses = plainClasses.map((c: any) => ({
            ...c,
            teacher: teacherMap[c.teacher_id],
          }))
        } else if (plainErr) {
          console.error('Lỗi tải classes:', plainErr)
        }
      }

      // 2.2. Lấy số lượng học sinh mỗi lớp
      const { data: csData } = await supabase.from('class_students').select('class_id')
      const countMap: Record<string, number> = {}
      if (csData) {
        csData.forEach((row) => {
          countMap[row.class_id] = (countMap[row.class_id] || 0) + 1
        })
      }

      if (rawClasses && rawClasses.length > 0) {
        const formattedClasses: ClassOption[] = rawClasses.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          teacher_name: c.teacher?.full_name || 'Chưa phân công',
          teacher_email: c.teacher?.email,
          student_count: countMap[c.id] || 0,
          created_at: c.created_at,
        }))
        setClasses(formattedClasses)
        if (formattedClasses.length > 0) {
          setSelectedClassId((prev) => prev || formattedClasses[0].id)
        }
      } else {
        setClasses([])
      }

      // 2.3. Lấy danh sách bài tập đã giao
      const { data: assignData, error: aErr } = await supabase
        .from('assignments')
        .select('id, class_id, task_code, due_date, created_at, classes(name, code), tasks(title, subtitle, form_type)')
        .order('created_at', { ascending: false })

      const catalogMap = new Map(TASKS.map((t) => [t.code, t]))
      const classLookup = new Map<string, any>()
      if (rawClasses) {
        rawClasses.forEach((c: any) => classLookup.set(c.id, c))
      }

      let rawAssignList: any[] = (assignData as any[]) || []
      if (aErr || !assignData) {
        const { data: plainAssign } = await supabase
          .from('assignments')
          .select('id, class_id, task_code, due_date, created_at')
          .order('created_at', { ascending: false })
        rawAssignList = plainAssign || []
      }

      const formattedAssignments: AssignmentItem[] = (rawAssignList || []).map((item: any) => {
        const cInfo = classLookup.get(item.class_id)
        const catTask = catalogMap.get(item.task_code)
        return {
          id: item.id,
          task_code: item.task_code,
          due_date: item.due_date,
          created_at: item.created_at,
          classes: {
            name: item.classes?.name || cInfo?.name || 'Lớp học',
            code: item.classes?.code || cInfo?.code || '',
          },
          tasks: {
            title: item.tasks?.title || catTask?.title || `Bài tập ${item.task_code}`,
            subtitle: item.tasks?.subtitle || catTask?.subtitle || '',
            form_type: item.tasks?.form_type || '',
          },
        }
      })
      setAssignments(formattedAssignments)
    } catch (err) {
      console.error('Lỗi loadClassesAndAssignments:', err)
    }
  }, [])

  // 3. Tải Bảng điểm Realtime toàn trường cho Admin
  const loadGradebookAttempts = useCallback(async () => {
    setIsRefreshingGradebook(true)
    try {
      const { data: attemptData } = await supabase
        .from('student_attempts')
        .select('*, profiles(id, full_name, email, username)')
        .order('updated_at', { ascending: false })
        .limit(150)

      if (!attemptData) return

      const studentIds = Array.from(new Set(attemptData.map((a: any) => a.student_id).filter(Boolean)))
      const classMap: Record<string, { id: string; name: string; code: string }> = {}

      if (studentIds.length > 0) {
        const { data: csData } = await supabase
          .from('class_students')
          .select('student_id, class_id, classes(id, name, code)')
          .in('student_id', studentIds)

        if (csData) {
          csData.forEach((cs: any) => {
            if (cs.classes) {
              classMap[cs.student_id] = {
                id: cs.classes.id,
                name: cs.classes.name,
                code: cs.classes.code,
              }
            }
          })
        }
      }

      const formatted: GradebookAttemptItem[] = attemptData.map((row: any) => {
        const cInfo = classMap[row.student_id]
        return {
          id: row.id,
          student_id: row.student_id,
          student_name: row.profiles?.full_name || 'Học sinh',
          student_email: row.profiles?.email,
          student_username: row.profiles?.username,
          class_id: cInfo?.id,
          class_name: cInfo?.name,
          class_code: cInfo?.code,
          task_code: row.task_code,
          first_score: row.first_score ?? row.score,
          score: row.score,
          max_score: row.max_score || 100,
          status: row.status || 'in_progress',
          attempt_count: row.attempt_count || 1,
          completed_at: row.completed_at,
          updated_at: row.updated_at,
          created_at: row.created_at,
        }
      })

      setAttempts(formatted)
    } finally {
      setIsRefreshingGradebook(false)
    }
  }, [])

  useEffect(() => {
    if (user && isAdmin) {
      loadTasks()
      loadClassesAndAssignments()
      loadGradebookAttempts()
    }
  }, [user, isAdmin, loadTasks, loadClassesAndAssignments, loadGradebookAttempts])

  // Lắng nghe Realtime bảng điểm
  useEffect(() => {
    if (!isAdmin) return
    const channel = supabase
      .channel('admin-realtime-gradebook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_attempts' }, () => {
        loadGradebookAttempts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAdmin, loadGradebookAttempts])

  // Giao bài tập cho lớp
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId || !assignTaskCode || !user) return

    setAssignMessage(null)
    const { error } = await supabase.from('assignments').insert({
      class_id: selectedClassId,
      task_code: assignTaskCode,
      assigned_by: user.id,
      due_date: assignDueDate ? new Date(assignDueDate).toISOString() : null,
    })

    if (error) {
      setAssignMessage({ success: false, text: error.message })
    } else {
      setAssignMessage({ success: true, text: `Đã giao bài tập ${assignTaskCode} cho lớp thành công!` })
      setAssignTaskCode('')
      setAssignDueDate('')
      loadClassesAndAssignments()
    }
  }

  // Hủy / xóa bài tập đã giao
  const handleDeleteAssignment = async (assignId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy giao bài tập này cho lớp không?')) return
    setIsDeletingAssignId(assignId)
    const { error } = await supabase.from('assignments').delete().eq('id', assignId)
    setIsDeletingAssignId(null)
    if (!error) {
      setAssignments((prev) => prev.filter((a) => a.id !== assignId))
    } else {
      alert(`Không thể hủy bài: ${error.message}`)
    }
  }

  // Xóa bài tập khỏi hệ thống và CSDL Supabase
  const handleDeleteTask = async (taskItem: TaskListItem) => {
    const isCustom = taskItem.is_custom
    const confirmPrompt =
      `Bạn có chắc chắn muốn xóa bài tập "${taskItem.title}" (Mã: ${taskItem.code}) không?\n\n` +
      (isCustom
        ? `Bài tập tự soạn này sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu Supabase và ngân hàng bài tập.`
        : `Bài tập này sẽ được xóa khỏi hệ thống và cơ sở dữ liệu Supabase.`)

    if (!window.confirm(confirmPrompt)) return

    setIsDeletingTaskCode(taskItem.code)
    setTaskActionFeedback(null)

    try {
      // 1. Thử gọi RPC xóa an toàn delete_task_by_admin (nếu có trên DB)
      let rpcSuccess = false
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('delete_task_by_admin', {
          p_task_code: taskItem.code,
        })
        if (!rpcError && rpcData && (rpcData as any).success) {
          rpcSuccess = true
        }
      } catch {
        rpcSuccess = false
      }

      // 2. Nếu RPC chưa chạy trên DB, thực hiện xóa trực tiếp từng bảng từ client
      if (!rpcSuccess) {
        // Xóa lần nộp của học sinh
        await supabase.from('student_attempts').delete().eq('task_code', taskItem.code)
        // Xóa các lượt giao bài cho lớp
        await supabase.from('assignments').delete().eq('task_code', taskItem.code)
        // Xóa chính sách chấm điểm
        await supabase.from('task_assessment_policies').delete().eq('task_code', taskItem.code)
        // Xóa bài tập trong bảng tasks
        const { error: delError } = await supabase.from('tasks').delete().eq('code', taskItem.code)
        if (delError && delError.code !== 'PGRST116') {
          console.warn('Xóa bảng tasks:', delError)
        }
      }

      // 3. Ghi nhận mã bài đã xóa vào localStorage (đặc biệt cho bài mẫu tĩnh)
      const deletedCodes: string[] = JSON.parse(localStorage.getItem('gsec_deleted_tasks') || '[]')
      if (!deletedCodes.includes(taskItem.code)) {
        deletedCodes.push(taskItem.code)
        localStorage.setItem('gsec_deleted_tasks', JSON.stringify(deletedCodes))
      }

      // 4. Cập nhật state danh sách bài tập và bài tập đã giao
      setTasks((prev) => prev.filter((t) => t.code !== taskItem.code))
      setAssignments((prev) => prev.filter((a) => a.task_code !== taskItem.code))

      setTaskActionFeedback({
        success: true,
        text: `Đã xóa bài tập ${taskItem.code} (${taskItem.title}) khỏi hệ thống và CSDL Supabase.`,
      })

      setTimeout(() => {
        setTaskActionFeedback(null)
      }, 4500)
    } catch (err: any) {
      console.error('Lỗi khi xóa bài tập:', err)
      alert(`Không thể xóa bài tập: ${err?.message || 'Đã có lỗi xảy ra.'}`)
    } finally {
      setIsDeletingTaskCode(null)
    }
  }

  // Soạn bài tập mới
  const handleSaveNewTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskCode.trim() || !taskTitle.trim()) return

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
        contentPayload = {
          intro: taskIntro || 'Check Task 1. Enter your answers from the worksheet.',
          fields: fillItems.map((f, index) => {
            const rawHints = f.hints && Array.isArray(f.hints) ? f.hints : [(f as any).h1, (f as any).h2]
            const cleanHints = rawHints.map((h: string) => (h || '').trim()).filter(Boolean)
            if (cleanHints.length === 0) {
              cleanHints.push('Check the word or phrase in your worksheet.')
              cleanHints.push('Look closely at the lesson context and spelling.')
            }
            return {
              id: `q${index + 1}`,
              label: f.label,
              placeholder: f.placeholder || 'Your answer',
              hints: cleanHints,
              hint: cleanHints[0],
              second: cleanHints[1] || cleanHints[0],
              cue: `Look back at Question ${f.label || index + 1} from the worksheet.`,
            }
          }),
        }

        fillItems.forEach((f, index) => {
          const key = `q${index + 1}`
          const accepted = f.correctAnswers.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean)
          keysPayload[key] = accepted.length === 1 ? accepted[0] : accepted

          const rawHints = f.hints && Array.isArray(f.hints) ? f.hints : [(f as any).h1, (f as any).h2]
          const cleanHints = rawHints.map((h: string) => (h || '').trim()).filter(Boolean)
          hintsPayload[key] = {
            hints: cleanHints,
            h1: cleanHints[0] || 'Check the word or phrase in your worksheet.',
            h2: cleanHints[1] || cleanHints[0] || 'Look closely at the lesson context and spelling.',
          }
        })
      }

      // Bổ sung file âm thanh nếu có
      if (taskAudioUrl.trim()) {
        contentPayload.audioUrl = taskAudioUrl.trim()
        contentPayload.audio_url = taskAudioUrl.trim()
      }

      const finalUnit = Math.max(1, parseInt(String(taskUnit), 10) || 1)
      const finalLesson = Math.max(1, parseInt(String(taskLesson), 10) || 1)
      const finalNumber = Math.max(1, parseInt(String(taskNumber), 10) || 1)

      // 1. Lưu vào bảng public.tasks
      const taskContent = {
        ...contentPayload,
        audioUrl: taskAudioUrl.trim() || undefined,
        audio_url: taskAudioUrl.trim() || undefined,
        unit: finalUnit,
        lesson: finalLesson,
      }

      const baseTaskPayload: any = {
        code: taskCode.trim(),
        worksheet: finalLesson, // worksheet lưu số lesson trong DB để tương thích 100%
        task_number: finalNumber,
        title: taskTitle.trim(),
        subtitle: taskSubtitle.trim(),
        form_type: authoringFormType,
        archetypes: ['standardized', authoringFormType.toLowerCase()],
        content: taskContent,
        is_published: true,
      }

      // Lưu trực tiếp baseTaskPayload (đã chứa worksheet và content.unit/lesson)
      const { error: taskErr } = await supabase.from('tasks').upsert(baseTaskPayload)
      if (taskErr) throw taskErr

      // 2. Lưu vào bảng bảo mật public.task_assessment_policies
      const { error: policyErr } = await supabase.from('task_assessment_policies').upsert({
        task_code: taskCode.trim(),
        max_attempts: 2,
        keys_data: keysPayload,
        hints_data: hintsPayload,
      })

      if (policyErr) throw policyErr

      // Nếu bài này từng nằm trong danh sách bài đã xóa, bỏ ra khỏi danh sách
      const deletedCodes: string[] = JSON.parse(localStorage.getItem('gsec_deleted_tasks') || '[]')
      if (deletedCodes.includes(taskCode.trim())) {
        localStorage.setItem('gsec_deleted_tasks', JSON.stringify(deletedCodes.filter((c) => c !== taskCode.trim())))
      }

      setAuthoringStatus({ success: true, text: `Đã lưu thành công bài tập ${taskCode.trim()} (Lesson ${finalLesson} - Task ${finalNumber})!` })
      // Tự động chuyển bộ lọc về ALL và tìm đúng mã bài vừa tạo để bài tập xuất hiện ngay trên bảng
      setTaskFilterWs('ALL')
      setTaskSearch(taskCode.trim())
      loadTasks()
      setTimeout(() => {
        setIsAuthoringOpen(false)
        setAuthoringStatus(null)
      }, 2000)
    } catch (err: any) {
      setAuthoringStatus({ success: false, text: err?.message || 'Có lỗi khi lưu bài tập.' })
    } finally {
      setSavingTask(false)
    }
  }

  // Helper lọc bài tập
  const filteredTasks = tasks.filter((t) => {
    if (taskFilterWs !== 'ALL' && String(t.lesson || t.worksheet) !== taskFilterWs) return false
    if (taskFilterForm !== 'ALL' && t.form_type !== taskFilterForm) return false
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase().trim()
      const matchCode = t.code.toLowerCase().includes(q)
      const matchTitle = t.title.toLowerCase().includes(q)
      const matchSub = t.subtitle?.toLowerCase().includes(q)
      if (!matchCode && !matchTitle && !matchSub) return false
    }
    return true
  })

  // Helper lọc bảng điểm
  const filteredAttempts = attempts.filter((a) => {
    if (gradebookClassFilter !== 'ALL' && a.class_id !== gradebookClassFilter) return false
    if (gradebookStatusFilter !== 'ALL' && a.status !== gradebookStatusFilter) return false
    if (gradebookSearch.trim()) {
      const q = gradebookSearch.toLowerCase().trim()
      const matchName = a.student_name?.toLowerCase().includes(q)
      const matchEmail = a.student_email?.toLowerCase().includes(q) || a.student_username?.toLowerCase().includes(q)
      const matchTask = a.task_code?.toLowerCase().includes(q)
      const matchClass = a.class_name?.toLowerCase().includes(q) || a.class_code?.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchTask && !matchClass) return false
    }
    return true
  })

  const formatAttemptTime = (a: GradebookAttemptItem) => {
    const raw = a.completed_at || a.updated_at || a.created_at
    if (!raw) return '-'
    const d = new Date(raw)
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return 'Vừa cập nhật'
    return d.toLocaleString('vi-VN')
  }

  const completedCount = filteredAttempts.filter((a) => a.status === 'completed').length
  const inProgressCount = filteredAttempts.filter((a) => a.status === 'in_progress').length
  const avgScore = filteredAttempts.length > 0
    ? Math.round(filteredAttempts.reduce((acc, a) => acc + a.score, 0) / filteredAttempts.length)
    : 0

  if (!isAdmin) {
    return (
      <main className="auth-container" style={{ textAlign: 'center', margin: '15vh auto' }}>
        <span className="launcher-avatar" aria-hidden="true" style={{ margin: '0 auto 16px' }}>
          !
        </span>
        <h2>Khu vực Quản trị Hệ thống (Admin Only)</h2>
        <p style={{ color: 'var(--color-muted)', fontSize: '14px', margin: '12px 0 24px' }}>
          Tài khoản của bạn không có vai trò <strong>ADMIN</strong>. Vui lòng liên hệ để được cấp quyền.
        </p>
        <Link to="/" className="btn-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
          ← Quay lại trang chủ
        </Link>
      </main>
    )
  }

  return (
    <>
      <AppHeader currentPortal="admin" />
      <div className="portal-shell">
        {/* HEADER QUẢN TRỊ ADMIN */}
        <header className="portal-header">
          <div className="portal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🛠️</span>
              <h1>Trung Tâm Điều Hành Quản Trị (Admin Hub)</h1>
            </div>
            <p>Quản lý toàn diện ngân hàng đề bài, soạn bài tập mới, lớp học và giám sát bảng điểm toàn trường</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                margin: 0,
              }}
              onClick={openAuthoringModal}
            >
              <span>✨</span>
              <span>Soạn Bài Tập Mới</span>
            </button>
          </div>
        </header>

      {/* THỐNG KÊ NHANH KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>📚 Ngân hàng Bài tập</div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--color-primary)' }}>
            {tasks.length} bài
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>🏫 Lớp học hoạt động</div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#0284c7' }}>
            {classes.length} lớp
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>📝 Lượt bài tập đã giao</div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#7c3aed' }}>
            {assignments.length} lượt
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>📊 Bảng điểm theo dõi</div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#16a34a' }}>
            {attempts.length} bài nộp
          </div>
        </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG TAB CHỨC NĂNG ADMIN */}
      <nav className="portal-tabs">
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'tasks' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📚 Quản lý & Soạn Bài Tập ({tasks.length})
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'assignments' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          📝 Giao bài theo Lớp ({assignments.length})
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'gradebook' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('gradebook')}
        >
          📊 Bảng Điểm Toàn Trường ({attempts.length})
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'classes' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          🏫 Danh Sách Lớp & Giáo Viên ({classes.length})
        </button>
      </nav>

      {/* TAB 1: NGÂN HÀNG BÀI TẬP & SOẠN ĐỀ */}
      {activeTab === 'tasks' && (
        <section>
          {/* Header công cụ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Ngân Hàng Bài Tập Hệ Thống</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                Bao gồm 32 bài tập tiêu chuẩn cùng các bài tập mới được Admin soạn thảo
              </p>
            </div>
            <button
              type="button"
              className="btn-submit"
              style={{ width: 'auto', padding: '10px 20px', fontWeight: 700 }}
              onClick={openAuthoringModal}
            >
              + Soạn Bài Tập Mới
            </button>
          </div>

          {/* Bộ lọc bài tập */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px', background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="filter-ws" style={{ fontSize: '13px', fontWeight: 700 }}>Lesson:</label>
              <select
                id="filter-ws"
                className="form-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                value={taskFilterWs}
                onChange={(e) => setTaskFilterWs(e.target.value)}
              >
                <option value="ALL">Tất cả Lesson</option>
                {Array.from(new Set(tasks.map((t) => t.lesson || t.worksheet)))
                  .sort((a, b) => a - b)
                  .map((l) => (
                    <option key={l} value={String(l)}>Lesson {l}</option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="filter-form" style={{ fontSize: '13px', fontWeight: 700 }}>Dạng bài:</label>
              <select
                id="filter-form"
                className="form-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                value={taskFilterForm}
                onChange={(e) => setTaskFilterForm(e.target.value)}
              >
                <option value="ALL">Tất cả dạng bài</option>
                <option value="FORM_1_CHOICE">Trắc nghiệm (A/B/C hoặc T/F)</option>
                <option value="FORM_2_FILL">Điền từ vào ô trống</option>
                <option value="FORM_4_SENTENCE_REPAIR">Sửa lỗi câu & Ngữ pháp</option>
                <option value="FORM_5_SEQUENCE">Sắp xếp đoạn văn</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }}
                placeholder="Tìm theo mã bài (60113), tiêu đề, chủ đề..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>
          </div>

          {taskActionFeedback && (
            <div
              className={`auth-message ${taskActionFeedback.success ? 'auth-message--success' : 'auth-message--error'}`}
              style={{ marginBottom: '16px' }}
            >
              {taskActionFeedback.text}
            </div>
          )}

          {/* Bảng danh sách bài tập */}
          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Mã bài</th>
                  <th>Vị trí</th>
                  <th>Tiêu đề & Chủ đề</th>
                  <th>Dạng bài chuẩn</th>
                  <th>Nguồn</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingTasks ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
                      Đang tải danh sách bài tập...
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
                      Không tìm thấy bài tập nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.code}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', fontSize: '15px', color: 'var(--color-primary)' }}>
                          {t.code}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>Unit {t.unit || 1} • Lesson {t.lesson || t.worksheet}</span>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Task {t.task_number}</div>
                      </td>
                      <td>
                        <strong>{t.title}</strong>
                        {t.subtitle && <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>{t.subtitle}</div>}
                      </td>
                      <td>
                        <span className="user-badge user-badge--student" style={{ fontSize: '11px' }}>
                          {t.form_type}
                        </span>
                      </td>
                      <td>
                        {t.is_custom ? (
                          <span className="user-badge user-badge--admin" style={{ fontSize: '11px' }}>Admin tạo</span>
                        ) : (
                          <span className="user-badge" style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>Tiêu chuẩn</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-submit"
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              width: 'auto',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() => navigate(`/tasks/${t.code}`)}
                          >
                            ▶ Mở xem bài
                          </button>
                          <button
                            type="button"
                            className="btn-delete-task"
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              width: 'auto',
                              borderRadius: '6px',
                              cursor: isDeletingTaskCode === t.code ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              fontWeight: 600,
                              opacity: isDeletingTaskCode === t.code ? 0.6 : 1,
                              transition: 'all 0.15s ease',
                            }}
                            disabled={isDeletingTaskCode === t.code}
                            onClick={() => handleDeleteTask(t)}
                            title={`Xóa bài tập ${t.code} khỏi hệ thống và CSDL`}
                          >
                            {isDeletingTaskCode === t.code ? 'Đang xóa...' : '🗑️ Xóa'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: GIAO BÀI THEO LỚP */}
      {activeTab === 'assignments' && (
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            <div
              style={{
                background: '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--color-line)',
                height: 'fit-content',
              }}
            >
              <h2 style={{ fontSize: '18px', margin: '0 0 16px' }}>Giao Bài Tập Cho Lớp</h2>

              {assignMessage && (
                <div
                  className={`auth-message ${assignMessage.success ? 'auth-message--success' : 'auth-message--error'}`}
                  style={{ marginBottom: '14px' }}
                >
                  {assignMessage.text}
                </div>
              )}

              <form onSubmit={handleAssignTask} className="auth-form">
                <div className="form-group">
                  <label htmlFor="assign-class">Chọn Lớp nhận bài:</label>
                  <select
                    id="assign-class"
                    className="form-input"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    required
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Mã: {c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="assign-task">Chọn Bài tập giao:</label>
                  <select
                    id="assign-task"
                    className="form-input"
                    value={assignTaskCode}
                    onChange={(e) => setAssignTaskCode(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn bài tập --</option>
                    {tasks.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.code} - {t.title} ({t.form_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="assign-due">Hạn hoàn thành (Tùy chọn):</label>
                  <input
                    id="assign-due"
                    type="datetime-local"
                    className="form-input"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-submit" style={{ marginTop: '8px' }}>
                  🚀 Giao bài tập ngay
                </button>
              </form>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>Lịch Sử Bài Tập Đã Giao</h2>
                <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>
                  {assignments.length} bài đã giao
                </span>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Lớp học</th>
                      <th>Bài tập</th>
                      <th>Hạn nộp</th>
                      <th>Ngày giao</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
                          Chưa có bài tập nào được giao. Hãy dùng khung bên trái để giao bài.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((item) => {
                        const isOverdue = item.due_date ? new Date(item.due_date).getTime() < Date.now() : false
                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.classes?.name || 'Lớp'}</strong>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{item.classes?.code}</div>
                            </td>
                            <td>
                              <span className="task-code-pill" style={{ display: 'inline-block', marginBottom: '4px' }}>
                                {item.task_code}
                              </span>
                              <div style={{ fontSize: '12px', color: 'var(--color-text)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.tasks?.title || `Bài tập ${item.task_code}`}
                              </div>
                            </td>
                            <td>
                              {item.due_date ? (
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: isOverdue ? '#fee4e2' : '#f0fdf4',
                                    color: isOverdue ? '#b42318' : '#15803d',
                                    display: 'inline-block',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isOverdue ? '⚠️ Quá hạn: ' : '⏰ '}
                                  {new Date(item.due_date).toLocaleString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })}
                                </span>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Không giới hạn</span>
                              )}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                              {new Date(item.created_at).toLocaleDateString('vi-VN')}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn-signout"
                                style={{ padding: '4px 8px', fontSize: '11px', color: '#b42318', borderColor: '#fecdca' }}
                                title="Hủy giao bài tập này"
                                disabled={isDeletingAssignId === item.id}
                                onClick={() => handleDeleteAssignment(item.id)}
                              >
                                {isDeletingAssignId === item.id ? '...' : '🗑️ Hủy'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: BẢNG ĐIỂM TOÀN TRƯỜNG */}
      {activeTab === 'gradebook' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2>Bảng Điểm & Giám Sát Toàn Trường</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                Quyền Quản trị viên: Theo dõi trực tiếp kết quả, điểm lần 1 và trạng thái hoàn thành của mọi học sinh
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Realtime kết nối
              </span>
              <button
                type="button"
                className="btn-auth-link btn-auth-link--secondary"
                style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                disabled={isRefreshingGradebook}
                onClick={loadGradebookAttempts}
              >
                {isRefreshingGradebook ? '⏳ Đang tải...' : '🔄 Làm mới'}
              </button>
            </div>
          </div>

          {/* Bộ lọc bảng điểm */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px', background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="gb-class" style={{ fontSize: '13px', fontWeight: 700 }}>Lớp học:</label>
              <select
                id="gb-class"
                className="form-input"
                style={{ width: 'auto', minWidth: '180px', padding: '6px 10px', fontSize: '13px' }}
                value={gradebookClassFilter}
                onChange={(e) => setGradebookClassFilter(e.target.value)}
              >
                <option value="ALL">Toàn trường (Tất cả lớp)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="gb-status" style={{ fontSize: '13px', fontWeight: 700 }}>Trạng thái:</label>
              <select
                id="gb-status"
                className="form-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                value={gradebookStatusFilter}
                onChange={(e) => setGradebookStatusFilter(e.target.value as any)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="completed">Đã hoàn thành ✓</option>
                <option value="in_progress">Đang làm dở ⏳</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }}
                placeholder="Tìm tên học sinh, mã task (60113), email..."
                value={gradebookSearch}
                onChange={(e) => setGradebookSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Thẻ thống kê nhanh */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Tổng bài tập</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{filteredAttempts.length}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#16a34a' }}>Đã hoàn thành</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>{completedCount}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#d97706' }}>Đang làm dở</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>{inProgressCount}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Điểm trung bình</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>{avgScore}/100</div>
            </div>
          </div>

          {/* Bảng Dữ Liệu Bảng Điểm */}
          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Lớp học</th>
                  <th>Mã Task</th>
                  <th title="Điểm đạt được ở lần nộp/kiểm tra đầu tiên">Điểm lần 1</th>
                  <th title="Điểm hiện tại / cao nhất">Điểm hiện tại</th>
                  <th>Trạng thái</th>
                  <th>Lần làm</th>
                  <th>Thời gian cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '36px' }}>
                      {attempts.length === 0
                        ? 'Chưa có bài nộp nào từ học sinh.'
                        : 'Không tìm thấy kết quả nào phù hợp với bộ lọc hiện tại.'}
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.student_name}</strong>
                        {(a.student_username || a.student_email) && (
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                            {a.student_username || a.student_email}
                          </div>
                        )}
                      </td>
                      <td>
                        {a.class_name ? (
                          <div>
                            <span style={{ fontWeight: 600 }}>{a.class_name}</span>
                            {a.class_code && (
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Mã: {a.class_code}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>Tự do</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.08)', padding: '2px 6px', borderRadius: '4px', color: 'var(--color-primary)' }}>
                          {a.task_code}
                        </span>
                      </td>
                      <td>
                        {a.first_score !== null && a.first_score !== undefined ? (
                          <strong style={{ color: a.first_score >= 80 ? 'var(--color-success, #16a34a)' : '#6366f1' }}>
                            {a.first_score}/100
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--color-muted)' }}>-</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: a.score >= 80 ? 'var(--color-success, #16a34a)' : '#e11d48' }}>
                          {a.score}/{a.max_score}
                        </strong>
                      </td>
                      <td>
                        {a.status === 'completed' ? (
                          <span className="user-badge" style={{ backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ✓ Đã xong
                          </span>
                        ) : (
                          <span className="user-badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ⏳ Đang làm dở
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '13px' }}>Lần {a.attempt_count}</span>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {formatAttemptTime(a)}
                        {a.status === 'in_progress' && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#b45309' }}>Chưa nộp kết thúc</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: DANH SÁCH LỚP HỌC & GIÁO VIÊN */}
      {activeTab === 'classes' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2>Danh Sách Lớp Học Toàn Hệ Thống</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                Các lớp học đang được quản lý bởi các giáo viên trong trường
              </p>
            </div>
            <Link to="/teacher" className="btn-submit" style={{ textDecoration: 'none', padding: '9px 18px' }}>
              + Sang Cổng Giáo Viên để tạo lớp
            </Link>
          </div>

          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Tên lớp</th>
                  <th>Mã tham gia</th>
                  <th>Giáo viên phụ trách</th>
                  <th>Sĩ số học sinh</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
                      Chưa có lớp học nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  classes.map((c) => (
                    <tr key={c.id}>
                      <td><strong style={{ fontSize: '15px' }}>{c.name}</strong></td>
                      <td>
                        <code style={{ fontSize: '13px', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', borderRadius: '4px', color: 'var(--color-primary)' }}>
                          {c.code}
                        </code>
                      </td>
                      <td>
                        <strong>{c.teacher_name}</strong>
                        {c.teacher_email && <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{c.teacher_email}</div>}
                      </td>
                      <td>
                        <span className="user-badge user-badge--student" style={{ fontWeight: 600 }}>
                          {c.student_count} học sinh
                        </span>
                      </td>
                      <td>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL SOẠN BÀI TẬP MỚI */}
      {isAuthoringOpen && (
        <div className="portal-modal-overlay">
          <div className="portal-modal" style={{ width: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="portal-modal-header">
              <h2>Soạn Bài Tập Mới (Studio)</h2>
              <button
                type="button"
                className="portal-modal-close"
                onClick={() => setIsAuthoringOpen(false)}
              >
                ×
              </button>
            </div>

            {authoringStatus && (
              <div
                className={`auth-message ${authoringStatus.success ? 'auth-message--success' : 'auth-message--error'}`}
                style={{
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{authoringStatus.text}</span>
                {authoringStatus.success && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAuthoringOpen(false)
                      navigate(`/tasks/${taskCode.trim()}`)
                    }}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ▶ Mở xem ngay
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSaveNewTask} className="auth-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label htmlFor="modal-task-form">Dạng bài (Form Archetype):</label>
                  <select
                    id="modal-task-form"
                    className="form-input"
                    value={authoringFormType}
                    onChange={(e) => setAuthoringFormType(e.target.value)}
                  >
                    <option value="FORM_1_CHOICE">FORM 1: Trắc nghiệm (A/B/C hoặc T/F)</option>
                    <option value="FORM_2_FILL">FORM 2: Điền từ vào ô trống</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="modal-task-code">Mã bài tập (5 chữ số):</label>
                  <input
                    id="modal-task-code"
                    type="text"
                    className="form-input"
                    required
                    placeholder="ví dụ: 60171"
                    value={taskCode}
                    onChange={(e) => setTaskCode(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label htmlFor="modal-task-unit">Unit:</label>
                  <input
                    id="modal-task-unit"
                    type="number"
                    min={1}
                    className="form-input"
                    value={taskUnit}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    onBlur={() => {
                      if (!taskUnit || Number(taskUnit) < 1) {
                        handleUnitChange('1')
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-task-lesson">Lesson:</label>
                  <input
                    id="modal-task-lesson"
                    type="number"
                    min={1}
                    className="form-input"
                    value={taskLesson}
                    onChange={(e) => handleLessonChange(e.target.value)}
                    onBlur={() => {
                      if (!taskLesson || Number(taskLesson) < 1) {
                        handleLessonChange('1')
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-task-num">Số thứ tự bài:</label>
                  <input
                    id="modal-task-num"
                    type="number"
                    min={1}
                    className="form-input"
                    value={taskNumber}
                    onChange={(e) => handleTaskNumberChange(e.target.value)}
                    onBlur={() => {
                      if (!taskNumber || Number(taskNumber) < 1) {
                        handleTaskNumberChange('1')
                      }
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="modal-task-title">Tiêu đề bài học:</label>
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Tự động sinh theo Lesson & Task</span>
                </div>
                <input
                  id="modal-task-title"
                  type="text"
                  className="form-input"
                  required
                  placeholder="vd: AI Tutor • WS 1 - Task 7"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-task-subtitle">Chủ đề bài học (Subtitle):</label>
                <input
                  id="modal-task-subtitle"
                  type="text"
                  className="form-input"
                  placeholder="vd: Unit 1 · My New School"
                  value={taskSubtitle}
                  onChange={(e) => setTaskSubtitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-task-intro">Lời giới thiệu:</label>
                <input
                  id="modal-task-intro"
                  type="text"
                  className="form-input"
                  placeholder="vd: Check Task 1. Enter your A, B or C answers."
                  value={taskIntro}
                  onChange={(e) => setTaskIntro(e.target.value)}
                />
              </div>

              {/* TRƯỜNG TẢI FILE ÂM THANH (AUDIO CHO CẢ FORM 1 & FORM 2) */}
              <div className="form-group" style={{ borderTop: '1px solid var(--color-line)', paddingTop: '14px', marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="modal-task-audio-file" style={{ margin: 0, fontWeight: 600 }}>
                    File âm thanh (Audio bài nghe):
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                    (Tùy chọn - Dành cho bài tập Listening)
                  </span>
                </div>

                <div
                  style={{
                    padding: '14px',
                    border: '1.5px dashed var(--color-line, #d1d5db)',
                    borderRadius: '12px',
                    background: taskAudioUrl ? '#f0fdf4' : '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      id="modal-task-audio-file"
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={handleAudioFileUpload}
                    />
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      onClick={() => audioInputRef.current?.click()}
                      disabled={isUploadingAudio}
                    >
                      {isUploadingAudio ? '⏳ Đang tải file lên...' : taskAudioUrl ? '📁 Đổi file âm thanh khác' : '📁 Tải file âm thanh từ máy lên'}
                    </button>

                    {taskAudioUrl && (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: '1px solid #fca5a5',
                          borderRadius: '8px',
                          color: '#dc2626',
                          padding: '6px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                        onClick={handleRemoveAudio}
                      >
                        🗑️ Xóa file âm thanh
                      </button>
                    )}
                  </div>

                  {taskAudioName && (
                    <div style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🎵</span>
                      <strong>{taskAudioName}</strong>
                    </div>
                  )}

                  {taskAudioUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <audio controls src={taskAudioUrl} style={{ width: '100%', height: '36px' }} />
                      <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                        ✓ File âm thanh sẵn sàng. Khi học sinh làm bài, hệ thống sẽ yêu cầu nghe 2 lần trước khi mở khóa câu hỏi.
                      </div>
                    </div>
                  )}

                  {!taskAudioUrl && (
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                      💡 Nếu bài tập không có file âm thanh, giao diện loa nghe sẽ được tự động ẩn hoàn toàn.
                    </div>
                  )}
                </div>
              </div>

              {/* BUILDER CHO FORM 1: TRẮC NGHIỆM */}
              {authoringFormType === 'FORM_1_CHOICE' && (
                <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: '16px', marginTop: '10px' }}>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label htmlFor="modal-choice-opts">Các lựa chọn (phân cách bằng dấu phẩy):</label>
                    <input
                      id="modal-choice-opts"
                      type="text"
                      className="form-input"
                      value={choiceOptionsText}
                      onChange={(e) => setChoiceOptionsText(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>Danh sách câu hỏi & Đáp án bí mật:</strong>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      onClick={() =>
                        setChoiceItems((prev) => [
                          ...prev,
                          {
                            label: `Question ${prev.length + 1}`,
                            cue: `Look back at Question ${prev.length + 1}.`,
                            correct: 'A',
                            hints: ['', ''],
                          },
                        ])
                      }
                    >
                      + Thêm câu hỏi
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {choiceItems.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '14px',
                          background: 'var(--color-surface, #f9fafb)',
                          borderRadius: '8px',
                          border: '1px solid var(--color-line)',
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Nhãn câu (vd: Question 1)"
                            value={item.label}
                            onChange={(e) => {
                              const next = [...choiceItems]
                              next[index].label = e.target.value
                              setChoiceItems(next)
                            }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Đáp án đúng (vd: A)"
                            value={item.correct}
                            onChange={(e) => {
                              const next = [...choiceItems]
                              next[index].correct = e.target.value
                              setChoiceItems(next)
                            }}
                          />
                          {choiceItems.length > 1 && (
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-error, #dc2626)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                padding: '4px 8px',
                              }}
                              title="Xóa câu hỏi này"
                              onClick={() => {
                                setChoiceItems((prev) => prev.filter((_, i) => i !== index))
                              }}
                            >
                              Xóa câu
                            </button>
                          )}
                        </div>

                        {/* Danh sách gợi ý động (có thể thêm nhiều hint) */}
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-line)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)' }}>
                              Gợi ý giải bài (AI sẽ chọn ngẫu nhiên khi học sinh sai):
                            </span>
                            <button
                              type="button"
                              style={{
                                fontSize: '11px',
                                background: 'transparent',
                                border: '1px dashed var(--color-primary)',
                                color: 'var(--color-primary)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              onClick={() => {
                                const next = [...choiceItems]
                                next[index].hints = [...(next[index].hints || []), '']
                                setChoiceItems(next)
                              }}
                            >
                              + Thêm gợi ý
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(item.hints || []).map((hint, hIdx) => (
                              <div key={hIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
                                  placeholder={`Gợi ý ${hIdx + 1}`}
                                  value={hint}
                                  onChange={(e) => {
                                    const next = [...choiceItems]
                                    next[index].hints[hIdx] = e.target.value
                                    setChoiceItems(next)
                                  }}
                                />
                                {(item.hints || []).length > 1 && (
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--color-muted)',
                                      cursor: 'pointer',
                                      fontSize: '15px',
                                      padding: '2px 6px',
                                    }}
                                    title="Xóa gợi ý này"
                                    onClick={() => {
                                      const next = [...choiceItems]
                                      next[index].hints.splice(hIdx, 1)
                                      setChoiceItems(next)
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BUILDER CHO FORM 2: ĐIỀN TỪ */}
              {authoringFormType === 'FORM_2_FILL' && (
                <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: '16px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>Danh sách ô trống & Đáp án chấp nhận:</strong>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      onClick={() =>
                        setFillItems((prev) => [
                          ...prev,
                          {
                            label: String(prev.length + 1),
                            placeholder: 'Your answer',
                            correctAnswers: '',
                            hints: ['', ''],
                          },
                        ])
                      }
                    >
                      + Thêm ô trống
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {fillItems.map((item, index) => {
                      const itemHints = item.hints || ['', '']
                      return (
                        <div
                          key={index}
                          style={{
                            padding: '12px',
                            background: 'var(--color-surface, #f9fafb)',
                            borderRadius: '8px',
                            border: '1px solid var(--color-line)',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Số thứ tự (vd: 1)"
                              value={item.label}
                              onChange={(e) => {
                                const next = [...fillItems]
                                next[index].label = e.target.value
                                setFillItems(next)
                              }}
                            />
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Các đáp án đúng (cách nhau bằng dấu phẩy: school, a school)"
                              value={item.correctAnswers}
                              onChange={(e) => {
                                const next = [...fillItems]
                                next[index].correctAnswers = e.target.value
                                setFillItems(next)
                              }}
                            />
                            {fillItems.length > 1 && (
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-muted)',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  padding: '4px',
                                }}
                                title="Xóa ô trống này"
                                onClick={() => {
                                  const next = [...fillItems]
                                  next.splice(index, 1)
                                  setFillItems(next)
                                }}
                              >
                                🗑️
                              </button>
                            )}
                          </div>

                          {/* Quản lý danh sách Hint ngẫu nhiên cho ô trống */}
                          <div style={{ marginTop: '8px', borderTop: '1px dashed #e5e7eb', paddingTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)' }}>
                                Danh sách gợi ý (sẽ đưa ra ngẫu nhiên khi sai):
                              </span>
                              <button
                                type="button"
                                style={{
                                  fontSize: '11px',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                                onClick={() => {
                                  const next = [...fillItems]
                                  next[index].hints = [...itemHints, '']
                                  setFillItems(next)
                                }}
                              >
                                + Thêm gợi ý
                              </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {itemHints.map((hint, hIdx) => (
                                <div key={hIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
                                    placeholder={`Gợi ý ${hIdx + 1}`}
                                    value={hint}
                                    onChange={(e) => {
                                      const next = [...fillItems]
                                      const currentHints = [...(next[index].hints || ['', ''])]
                                      currentHints[hIdx] = e.target.value
                                      next[index].hints = currentHints
                                      setFillItems(next)
                                    }}
                                  />
                                  {itemHints.length > 1 && (
                                    <button
                                      type="button"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-muted)',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        padding: '2px 6px',
                                      }}
                                      title="Xóa gợi ý này"
                                      onClick={() => {
                                        const next = [...fillItems]
                                        const currentHints = [...(next[index].hints || ['', ''])]
                                        currentHints.splice(hIdx, 1)
                                        next[index].hints = currentHints
                                        setFillItems(next)
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-auth-link btn-auth-link--secondary"
                  style={{ flex: 1, border: 'none', cursor: 'pointer' }}
                  onClick={() => setIsAuthoringOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ flex: 1 }}
                  disabled={savingTask}
                >
                  {savingTask ? '⏳ Đang lưu bài...' : '💾 Lưu & Xuất Bản Bài Tập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </>
)
}
