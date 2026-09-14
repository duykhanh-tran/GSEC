import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../auth'
import { TASKS } from '../registry'
import { AppHeader } from '../../components/shell/AppHeader'
import { InlineCodeKeypad } from '../../components/keypad/InlineCodeKeypad'
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

interface TeacherOption {
  id: string
  full_name: string
  email: string
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

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'classes' | 'assignments' | 'gradebook' | 'keypad'>('overview')

  // Tasks state
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [showStandardTasks, setShowStandardTasks] = useState<boolean>(() => {
    return localStorage.getItem('gsec_show_standard_tasks') === 'true' // Mặc định: false (ẩn 32 bài mẫu)
  })
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

  // Studio & Edit task states
  const [editingTaskCode, setEditingTaskCode] = useState<string | null>(null)
  const [isLoadingEditTask] = useState(false)

  // Cấp tài khoản học sinh hàng loạt (Chuyển quyền toàn bộ cho Admin)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchClassId, setBatchClassId] = useState<string>('')
  const [batchNamesText, setBatchNamesText] = useState('')
  const [createdBatch, setCreatedBatch] = useState<Array<{ username: string; name: string; pass: string }>>([])
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)
  const [batchResult, setBatchResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleOpenBatchModal = (classId?: string) => {
    const targetId = classId || selectedClassId || (classes.length > 0 ? classes[0].id : '')
    setBatchClassId(targetId)
    setBatchNamesText('')
    setCreatedBatch([])
    setBatchResult(null)
    setIsBatchModalOpen(true)
  }

  const handleGenerateBatchPreview = () => {
    const lines = batchNamesText.split('\n').map((l) => l.trim()).filter(Boolean)
    const currentClass = classes.find((c) => c.id === batchClassId)
    const classPrefix = currentClass ? currentClass.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) : 'gsec'

    const generated = lines.map((name, index) => {
      const parts = name.split(' ')
      const lastName = parts[parts.length - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      const username = `${classPrefix}.${lastName}${index + 1}`
      return {
        username,
        name,
        pass: '123456',
      }
    })

    setCreatedBatch(generated)
    setBatchResult(null)
  }

  const handleCommitBatchCreation = async () => {
    if (!batchClassId || createdBatch.length === 0) return
    setIsSubmittingBatch(true)
    setBatchResult(null)

    try {
      const { data, error } = await supabase.rpc('create_managed_students_batch', {
        p_class_id: batchClassId,
        p_students: createdBatch,
      })

      if (error) {
        setBatchResult({ success: false, message: error.message })
      } else if (data && !data.success) {
        setBatchResult({ success: false, message: data.message })
      } else {
        setBatchResult({
          success: true,
          message: data?.message || `Đã cấp thành công ${createdBatch.length} tài khoản vào lớp!`,
        })
        await loadClassesAndAssignments()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo tài khoản.'
      setBatchResult({ success: false, message: msg })
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  // Quản lý tạo & xóa lớp học trực tiếp cho Admin
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassTeacherId, setNewClassTeacherId] = useState('')
  const [isSubmittingClass, setIsSubmittingClass] = useState(false)
  const [createClassError, setCreateClassError] = useState('')

  const handleAdminCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName.trim() || !user) return
    setIsSubmittingClass(true)
    setCreateClassError('')

    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
    const generatedCode = `GSEC${randomChars}`

    try {
      const { error } = await supabase.from('classes').insert({
        teacher_id: newClassTeacherId || user.id,
        name: newClassName.trim(),
        code: generatedCode,
      })

      if (error) {
        setCreateClassError(error.message)
      } else {
        setIsCreateClassModalOpen(false)
        setNewClassName('')
        setNewClassTeacherId('')
        setCreateClassError('')
        await loadClassesAndAssignments()
      }
    } catch (err: unknown) {
      setCreateClassError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo lớp.')
    } finally {
      setIsSubmittingClass(false)
    }
  }

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}" không? Toàn bộ phân công của lớp này cũng sẽ bị gỡ.`)) return
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId)
      if (error) {
        alert(`Không thể xóa lớp: ${error.message}`)
      } else {
        await loadClassesAndAssignments()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa lớp')
    }
  }

  const openAuthoringModal = () => {
    navigate('/admin/studio')
  }

  // Chỉnh sửa bài tập: Điều hướng sang trang Studio toàn màn hình
  const handleOpenEditTask = async (taskItem: TaskListItem) => {
    setEditingTaskCode(taskItem.code)
    navigate(`/admin/studio?edit=${taskItem.code}`)
  }


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

    const catalogList: TaskListItem[] = []

    // 1. Nếu Admin bật hiển thị bài mẫu tiêu chuẩn (32 bài)
    if (showStandardTasks) {
      TASKS.forEach((t) => {
        const dbItem = dbMap.get(t.code)
        if (dbItem) {
          const itemLesson = dbItem.worksheet || 1
          const unitMatch = (dbItem.subtitle || '').match(/Unit\s*(\d+)/i)
          const itemUnit = unitMatch ? parseInt(unitMatch[1], 10) : 1
          catalogList.push({
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
          })
        } else {
          let formType = 'FORM_1_CHOICE'
          if (t.archetypes.includes('answer-entry')) formType = 'FORM_2_FILL'
          else if (t.archetypes.includes('writing-repair')) formType = 'FORM_4_SENTENCE_REPAIR'
          else if (t.archetypes.includes('sequence-ordering')) formType = 'FORM_5_SEQUENCE'

          catalogList.push({
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
          })
        }
      })
    }

    // 2. Thêm toàn bộ các bài tập thực tế từ Supabase CSDL
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
  }, [showStandardTasks])

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

      // 2.4. Lấy danh sách giáo viên để Admin phân công khi tạo lớp
      const { data: teacherList } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'TEACHER')
        .order('full_name')

      if (teacherList) {
        setTeachers(teacherList)
      }
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
        const { error: attErr } = await supabase.from('student_attempts').delete().eq('task_code', taskItem.code)
        if (attErr && attErr.code !== 'PGRST116') {
          console.warn('Xóa student_attempts:', attErr)
        }

        // Xóa các lượt giao bài cho lớp
        const { error: asgErr } = await supabase.from('assignments').delete().eq('task_code', taskItem.code)
        if (asgErr && asgErr.code !== 'PGRST116') {
          console.warn('Xóa assignments:', asgErr)
        }

        // Xóa chính sách chấm điểm
        const { error: polErr } = await supabase.from('task_assessment_policies').delete().eq('task_code', taskItem.code)
        if (polErr && polErr.code !== 'PGRST116') {
          console.warn('Xóa task_assessment_policies:', polErr)
        }

        // Xóa bài tập trong bảng tasks
        const { error: delError } = await supabase.from('tasks').delete().eq('code', taskItem.code)
        if (delError && delError.code !== 'PGRST116') {
          throw new Error(`CSDL Supabase từ chối xóa bài tập trong bảng 'tasks': ${delError.message}`)
        }

        // Kiểm tra xác thực xem bản ghi còn tồn tại trong DB không
        const { data: checkRemain } = await supabase
          .from('tasks')
          .select('code')
          .eq('code', taskItem.code)
          .maybeSingle()

        if (checkRemain) {
          throw new Error(
            `Bài tập ${taskItem.code} vẫn còn trong CSDL Supabase do ràng buộc bảo mật (RLS) hoặc ràng buộc khóa ngoại (Foreign Key) chưa cho phép xóa. ` +
            `Vui lòng thực thi migration RPC 'delete_task_by_admin' trong Supabase SQL Editor.`
          )
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
        text: `Đã xóa bài tập ${taskItem.code} (${taskItem.title}) khỏi hệ thống và CSDL Supabase thành công.`,
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
      <div className="admin-dashboard-container">
        {/* HEADER QUẢN TRỊ ADMIN */}
        <header className="portal-header" style={{ marginBottom: '24px' }}>
          <div className="portal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🛠️</span>
              <h1>Trung Tâm Điều Hành Quản Trị </h1>
            </div>
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

        {/* BỐ CỤC 2 CỘT: CỘT TRÁI (SIDEBAR) + CỘT PHẢI (NỘI DUNG) */}
        <div className="admin-layout-grid">
          {/* CỘT TRÁI: SIDEBAR ĐIỀU HƯỚNG */}
          <aside className="admin-sidebar">
            <div className="admin-sidebar-header">
              <div className="admin-sidebar-title">
                <span>⚡</span>
                <span>Bảng Điều Khiển</span>
              </div>
            </div>

            <nav className="admin-sidebar-nav">
              <button
                type="button"
                className={`admin-nav-item-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <div className="admin-nav-item-content">
                  <span style={{ fontSize: '16px' }}>📊</span>
                  <span>Thống Kê Số Liệu</span>
                </div>
              </button>

              <button
                type="button"
                className={`admin-nav-item-btn ${activeTab === 'tasks' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <div className="admin-nav-item-content">
                  <span style={{ fontSize: '16px' }}>📚</span>
                  <span>Ngân Hàng Bài Tập</span>
                </div>
                <span className="admin-nav-item-badge">{tasks.length}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item-btn ${activeTab === 'classes' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('classes')}
              >
                <div className="admin-nav-item-content">
                  <span style={{ fontSize: '16px' }}>🏫</span>
                  <span>Lớp Học & Cấp TK</span>
                </div>
                <span className="admin-nav-item-badge">{classes.length}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item-btn ${activeTab === 'assignments' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                <div className="admin-nav-item-content">
                  <span style={{ fontSize: '16px' }}>📝</span>
                  <span>Giao Bài Theo Lớp</span>
                </div>
                <span className="admin-nav-item-badge">{assignments.length}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item-btn ${activeTab === 'gradebook' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('gradebook')}
              >
                <div className="admin-nav-item-content">
                  <span style={{ fontSize: '16px' }}>📈</span>
                  <span>Bảng Điểm Toàn Trường</span>
                </div>
                <span className="admin-nav-item-badge">{attempts.length}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item-btn ${activeTab === 'keypad' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('keypad')}
              >
                <div className="admin-nav-item-content">
                  <span style={{ fontSize: '16px' }}>⌨️</span>
                  <span>Nhập Mã Code</span>
                </div>
              </button>

            </nav>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="btn-submit"
                style={{ width: '100%', margin: 0, padding: '10px 14px', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                onClick={openAuthoringModal}
              >
                <span>✨</span>
                <span>Soạn Bài Mới</span>
              </button>
            </div>
          </aside>

          {/* CỘT PHẢI: VÙNG NỘI DUNG CHÍNH */}
          <main className="admin-content-area">
            {/* TAB MỤC MỚI: 📊 THỐNG KÊ SỐ LIỆU TOÀN TRANG */}
            {activeTab === 'overview' && (
              <section>
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ margin: 0 }}>Thống Kê Số Liệu Toàn Hệ Thống</h2>

                </div>

                {/* 5 THẺ KPI TỔNG QUAN */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>📚 Ngân hàng Bài tập</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: 'var(--color-primary)' }}>
                      {tasks.length} bài
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      {showStandardTasks ? 'Bao gồm 32 bài mẫu' : 'Bài do Admin quản lý'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>🏫 Lớp học hoạt động</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: '#0284c7' }}>
                      {classes.length} lớp
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Đang có giáo viên phụ trách
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>📝 Lượt bài đã giao</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: '#7c3aed' }}>
                      {assignments.length} lượt
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Theo các lớp học
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>📊 Bài nộp học sinh</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: '#16a34a' }}>
                      {attempts.length} bài
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Đã hoàn thành: {completedCount} ({attempts.length > 0 ? Math.round((completedCount / attempts.length) * 100) : 0}%)
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid var(--color-line)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>🎯 Điểm trung bình</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: '#ea580c' }}>
                      {avgScore}/100
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Toàn bộ bài tập đã làm
                    </div>
                  </div>
                </div>

                {/* 2 KHỐI CHI TIẾT: PHÂN BỐ DẠNG BÀI & PHÂN BỐ KẾT QUẢ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  {/* PHÂN BỐ DẠNG BÀI */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      📋 Phân Bố Ngân Hàng Bài Tập Theo Thể Loại
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>🔘 Form 1: Trắc nghiệm (A/B/C/D)</span>
                        <strong>{tasks.filter(t => t.form_type === 'FORM_1_CHOICE').length} bài</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>✏️ Form 2: Điền từ khuyết (Fill-in)</span>
                        <strong>{tasks.filter(t => t.form_type === 'FORM_2_FILL').length} bài</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>✍️ Form 3: Luyện viết câu (AI Coach)</span>
                        <strong>{tasks.filter(t => t.form_type === 'FORM_3_WRITING').length} bài</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>🎙️ Form 4: Speaking & Phát âm</span>
                        <strong>{tasks.filter(t => t.form_type === 'FORM_4_SPEAKING').length} bài</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>🎧 Form 5: Nghe & Lặp lại câu</span>
                        <strong>{tasks.filter(t => t.form_type === 'FORM_5_LISTEN_REPEAT').length} bài</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>👥 Form 6: Phỏng vấn & Hồ sơ nhân vật</span>
                        <strong>{tasks.filter(t => t.form_type?.startsWith('FORM_6')).length} bài</strong>
                      </div>
                    </div>
                  </div>

                  {/* PHÂN BỐ KẾT QUẢ ĐIỂM SỐ */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      ⭐ Phân Bố Điểm Số Của Học Sinh
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: '#059669', fontWeight: 600 }}>🟢 Xuất sắc (85 - 100 điểm)</span>
                        <strong>{attempts.filter(a => a.score >= 85).length} lượt</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: '#d97706', fontWeight: 600 }}>🟡 Đạt yêu cầu (50 - 84 điểm)</span>
                        <strong>{attempts.filter(a => a.score >= 50 && a.score < 85).length} lượt</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>🔴 Cần rèn luyện thêm (&lt; 50 điểm)</span>
                        <strong>{attempts.filter(a => a.score < 50).length} lượt</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                        <span>⏳ Đang làm dở chưa nộp</span>
                        <strong>{inProgressCount} lượt</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BẢNG 5 BÀI NỘP GẦN ĐÂY NHẤT */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                      ⚡ Hoạt Động Làm Bài Mới Nhất
                    </h3>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                      onClick={() => setActiveTab('gradebook')}
                    >
                      Xem toàn bộ bảng điểm →
                    </button>
                  </div>

                  <div className="portal-table-container">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Lớp</th>
                          <th>Mã Task</th>
                          <th>Điểm</th>
                          <th>Trạng thái</th>
                          <th>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attempts.slice(0, 5).map((a) => (
                          <tr key={a.id}>
                            <td><strong>{a.student_name}</strong></td>
                            <td>{a.class_name}</td>
                            <td><code>#{a.task_code}</code></td>
                            <td>
                              <strong style={{ color: a.score >= 80 ? '#059669' : a.score >= 50 ? '#d97706' : '#dc2626' }}>
                                {a.score}/{a.max_score}
                              </strong>
                            </td>
                            <td>
                              <span className={`user-badge ${a.status === 'completed' ? 'user-badge--teacher' : 'user-badge--admin'}`}>
                                {a.status === 'completed' ? 'Hoàn thành' : 'Đang làm'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px' }}>{formatAttemptTime(a)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 1: NGÂN HÀNG BÀI TẬP & SOẠN ĐỀ */}
            {activeTab === 'tasks' && (
              <section>
                {/* Header công cụ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Ngân Hàng Bài Tập Hệ Thống</h2>

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
                      <option value="FORM_1_CHOICE">Form 1: Trắc nghiệm (A/B/C hoặc T/F)</option>
                      <option value="FORM_2_FILL">Form 2: Điền từ vào ô trống</option>
                      <option value="FORM_3_WRITING">Form 3: Viết câu & Đoạn văn (AI Grammar)</option>
                      <option value="FORM_4_SPEAKING">Form 4: Luyện nói & Chấm phát âm (AssemblyAI)</option>
                      <option value="FORM_5_LISTEN_REPEAT">Form 5: Nghe & Ghi âm lặp lại (AssemblyAI &gt; 80%)</option>
                      <option value="FORM_6_2_INTERVIEW_PROFILE">Form 6.2: Phỏng vấn giọng nói (Interview Dialogue)</option>
                      <option value="FORM_7_TOPIC_SPEAKING">Form 7: Chọn chủ đề & Nói (Topic Speaking)</option>
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

                  <button
                    type="button"
                    style={{
                      padding: '7px 14px',
                      fontSize: '12.5px',
                      fontWeight: 650,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: showStandardTasks ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                      background: showStandardTasks ? '#fef3c7' : '#f8fafc',
                      color: showStandardTasks ? '#b45309' : '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      const next = !showStandardTasks
                      setShowStandardTasks(next)
                      localStorage.setItem('gsec_show_standard_tasks', String(next))
                    }}
                    title={showStandardTasks ? 'Bấm để ẩn 32 bài mẫu cũ' : 'Bấm để hiện lại 32 bài tập mẫu cũ của hệ thống'}
                  >
                    {showStandardTasks ? '🙈 Ẩn 32 bài mẫu cũ' : '👁️ Hiện 32 bài mẫu cũ'}
                  </button>
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
                          <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', background: '#fafafa' }}>
                            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📝</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                              {tasks.length === 0
                                ? 'Ngân hàng bài tập hiện chưa có bài tập nào'
                                : 'Không tìm thấy bài tập nào khớp với bộ lọc'}
                            </div>
                            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '460px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                              {tasks.length === 0
                                ? '32 bài tập mẫu cũ đã được ẩn đi. Bạn hãy bấm nút "+ Soạn Bài Tập Mới" để bắt đầu tạo các bài tập thực tế mới cho học sinh!'
                                : 'Hãy thử chọn lại Lesson hoặc Dạng bài ở thanh công cụ phía trên.'}
                            </p>
                            {tasks.length === 0 && (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn-submit"
                                  style={{ width: 'auto', padding: '9px 18px', fontWeight: 700 }}
                                  onClick={openAuthoringModal}
                                >
                                  + Soạn Bài Tập Mới Ngay
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    padding: '9px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    color: '#475569',
                                  }}
                                  onClick={() => {
                                    setShowStandardTasks(true)
                                    localStorage.setItem('gsec_show_standard_tasks', 'true')
                                  }}
                                >
                                  👁️ Xem lại 32 bài mẫu cũ
                                </button>
                              </div>
                            )}
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
                                  className="btn-edit-task"
                                  style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    width: 'auto',
                                    borderRadius: '6px',
                                    cursor: isLoadingEditTask && editingTaskCode === t.code ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #93c5fd',
                                    fontWeight: 600,
                                    transition: 'all 0.15s ease',
                                  }}
                                  disabled={isLoadingEditTask && editingTaskCode === t.code}
                                  onClick={() => handleOpenEditTask(t)}
                                  title={`Chỉnh sửa nội dung, câu hỏi và cấu hình bài tập ${t.code}`}
                                >
                                  {isLoadingEditTask && editingTaskCode === t.code ? 'Đang tải...' : '✏️ Sửa'}
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

            {/* TAB 3: DANH SÁCH LỚP HỌC & CẤP TÀI KHOẢN HỌC SINH */}
            {activeTab === 'classes' && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Danh Sách Lớp Học & Cấp Tài Khoản</h2>

                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleOpenBatchModal()}
                    >
                      <span>👥</span>
                      <span>+ Cấp Tài Khoản Hàng Loạt</span>
                    </button>
                    <button
                      type="button"
                      className="btn-submit"
                      style={{ padding: '8px 16px', margin: 0, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        setNewClassName('')
                        setNewClassTeacherId(teachers.length > 0 ? teachers[0].id : '')
                        setCreateClassError('')
                        setIsCreateClassModalOpen(true)
                      }}
                    >
                      <span>🏫</span>
                      <span>+ Tạo Lớp Học Mới</span>
                    </button>
                  </div>
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
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
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
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-auth-link btn-auth-link--secondary"
                                  style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                                  onClick={() => handleOpenBatchModal(c.id)}
                                  title="Cấp tài khoản học sinh hàng loạt cho lớp này"
                                >
                                  👥 Cấp TK
                                </button>
                                <button
                                  type="button"
                                  className="btn-auth-link"
                                  style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#dc2626', borderColor: '#fecaca', background: '#fff1f2' }}
                                  onClick={() => handleDeleteClass(c.id, c.name)}
                                  title="Xóa lớp học này"
                                >
                                  🗑️ Xóa
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

            {/* TAB: BÀN PHÍM GÕ MÃ CODE (ĐỒNG NHẤT MỌI ROLE) */}
            {activeTab === 'keypad' && (
              <main className="student-centered-hero" id="admin-keypad" style={{ margin: '32px auto' }}>
                <div className="student-centered-card">
                  <div className="student-centered-badge">
                    <span>✨</span>
                    <span>Hệ Thống Luyện Tập Tiếng Anh Thông Minh</span>
                  </div>

                  <h1 className="student-centered-title">Nhập Mã Bài Tập</h1>
                  <p className="student-centered-subtitle">
                    Nhập mã 5 chữ số từ giáo viên hoặc sách bài tập (ví dụ: <code>60111</code>) để bắt đầu luyện tập cùng AI Tutor.
                  </p>

                  {/* BÀN PHÍM SỐ Ở CHÍNH GIỮA */}
                  <div className="student-keypad-box">
                    <InlineCodeKeypad onNavigate={(code) => navigate(`/tasks/${code}`)} />
                  </div>
                </div>
              </main>
            )}

          </main>
        </div>
      </div>

      {/* MODAL CẤP TÀI KHOẢN HỌC SINH HÀNG LOẠT (DÀNH CHO ADMIN) */}
      {isBatchModalOpen && (
        <div className="portal-modal-overlay">
          <div className="portal-modal" style={{ maxWidth: '680px' }}>
            <div className="portal-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>👥 Cấp Tài Khoản Học Sinh Hàng Loạt</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                  Hệ thống tự động sinh tên đăng nhập & mật khẩu mặc định (123456)
                </p>
              </div>
              <button
                type="button"
                className="portal-modal-close"
                onClick={() => setIsBatchModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="portal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Chọn lớp học cần cấp */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Lớp học tiếp nhận:
                </label>
                <select
                  className="form-input"
                  value={batchClassId}
                  onChange={(e) => setBatchClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - GV: {c.teacher_name || 'Chưa phân công'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ô nhập danh sách học sinh */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Danh sách họ và tên học sinh (Mỗi bạn 1 dòng):
                </label>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder={`Nguyễn Văn An\nTrần Thị Bình\nLê Hoàng Nam\n...`}
                  value={batchNamesText}
                  onChange={(e) => setBatchNamesText(e.target.value)}
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-auth-link btn-auth-link--secondary"
                  style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
                  onClick={handleGenerateBatchPreview}
                  disabled={!batchNamesText.trim()}
                >
                  👁️ Xem trước tài khoản ({batchNamesText.split('\n').filter((l) => l.trim()).length})
                </button>
              </div>

              {/* Bảng xem trước danh sách tài khoản được sinh */}
              {createdBatch.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px' }}>Danh sách tài khoản dự kiến tạo ({createdBatch.length}):</strong>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      style={{ fontSize: '12px', padding: '4px 8px', cursor: 'pointer' }}
                      onClick={() => {
                        const tsv = createdBatch.map((s) => `${s.name}\t${s.username}\t${s.pass}`).join('\n')
                        navigator.clipboard.writeText(`Họ và Tên\tTên đăng nhập\tMật khẩu\n${tsv}`)
                        alert('Đã copy danh sách tài khoản dạng bảng vào bộ nhớ tạm!')
                      }}
                    >
                      📋 Copy toàn bộ danh sách
                    </button>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-line)', borderRadius: '8px' }}>
                    <table className="portal-table" style={{ margin: 0, fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Họ và Tên</th>
                          <th>Tên Đăng Nhập</th>
                          <th>Mật Khẩu Mặc Định</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdBatch.map((s, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td><strong>{s.name}</strong></td>
                            <td><code>{s.username}</code></td>
                            <td><code>{s.pass}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Thông báo kết quả */}
              {batchResult && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: batchResult.success ? '#f0fdf4' : '#fee2e2',
                    color: batchResult.success ? '#15803d' : '#991b1b',
                    border: `1px solid ${batchResult.success ? '#bbf7d0' : '#fecaca'}`,
                  }}
                >
                  {batchResult.message}
                </div>
              )}
            </div>

            <div className="portal-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-auth-link btn-auth-link--secondary"
                style={{ padding: '8px 16px', cursor: 'pointer' }}
                onClick={() => setIsBatchModalOpen(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn-submit"
                style={{ width: 'auto', margin: 0, padding: '8px 20px' }}
                disabled={createdBatch.length === 0 || isSubmittingBatch}
                onClick={handleCommitBatchCreation}
              >
                {isSubmittingBatch ? '⏳ Đang khởi tạo...' : `Xác nhận tạo ${createdBatch.length} tài khoản`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO LỚP HỌC MỚI (DÀNH CHO ADMIN) */}
      {isCreateClassModalOpen && (
        <div className="portal-modal-overlay">
          <div className="portal-modal" style={{ maxWidth: '520px' }}>
            <div className="portal-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>🏫 Tạo Lớp Học Mới</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                  Hệ thống tự động sinh mã tham gia ngẫu nhiên gồm 6 ký tự
                </p>
              </div>
              <button
                type="button"
                className="portal-modal-close"
                onClick={() => setIsCreateClassModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {createClassError && (
              <div
                style={{
                  margin: '12px 0',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                }}
              >
                {createClassError}
              </div>
            )}

            <form onSubmit={handleAdminCreateClass} className="auth-form" style={{ marginTop: '14px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="admin-class-name" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Tên lớp học:
                </label>
                <input
                  id="admin-class-name"
                  type="text"
                  className="form-input"
                  required
                  placeholder="vd: Lớp 6A1 - Tiếng Anh GSEC"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="admin-class-teacher" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Phân công Giáo viên phụ trách:
                </label>
                <select
                  id="admin-class-teacher"
                  className="form-input"
                  value={newClassTeacherId}
                  onChange={(e) => setNewClassTeacherId(e.target.value)}
                >
                  <option value="">-- Chính Admin phụ trách --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.email})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>
                  Giáo viên được chọn sẽ có quyền theo dõi bảng điểm và giao bài tập cho lớp này.
                </div>
              </div>

              <div className="note" style={{ margin: '10px 0 16px', fontSize: '12.5px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                Mã lớp học sẽ được sinh tự động (ví dụ: <code>GSEC6A</code>) để học sinh nhập mã tham gia.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-auth-link btn-auth-link--secondary"
                  style={{ padding: '8px 16px', cursor: 'pointer' }}
                  onClick={() => setIsCreateClassModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ width: 'auto', margin: 0, padding: '8px 20px' }}
                  disabled={!newClassName.trim() || isSubmittingClass}
                >
                  {isSubmittingClass ? '⏳ Đang tạo...' : '✓ Xác nhận Tạo Lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}