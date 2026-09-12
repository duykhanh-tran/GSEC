import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { supabase } from '../../lib/supabaseClient'
import { TASKS } from '../registry'
import { AppHeader } from '../../components/shell/AppHeader'
import { InlineCodeKeypad } from '../../components/keypad/InlineCodeKeypad'
import '../../styles/auth.css'
import '../../styles/portal.css'

interface ClassItem {
  id: string
  name: string
  code: string
  created_at: string
  student_count?: number
}

interface StudentItem {
  id: string
  full_name: string
  email: string
  username?: string | null
  is_managed?: boolean
  joined_at: string
}

interface TeacherAssignmentItem {
  id: string
  class_id: string
  task_code: string
  due_date: string | null
  created_at: string
  classes?: { name: string; code: string }
  tasks?: { title: string; subtitle?: string; form_type?: string }
}

interface TaskOption {
  code: string
  title: string
  subtitle: string
  form_type: string
}

interface AttemptItem {
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
  support_mode?: 'INDEPENDENT' | 'GUIDED'
  attempt_count: number
  completed_at?: string | null
  updated_at?: string | null
  created_at: string
}

export function TeacherPortalPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'classes' | 'assignments' | 'students' | 'progress' | 'keypad'>('classes')

  // Classes state
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Assignments state
  const [assignments, setAssignments] = useState<TeacherAssignmentItem[]>([])
  const [assignClassId, setAssignClassId] = useState<string>('')
  const [assignTaskCode, setAssignTaskCode] = useState<string>('')
  const [assignDueDate, setAssignDueDate] = useState<string>('')
  const [assignMessage, setAssignMessage] = useState<{ success: boolean; text: string } | null>(null)
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false)
  const [isDeletingAssignId, setIsDeletingAssignId] = useState<string | null>(null)
  const [taskList, setTaskList] = useState<TaskOption[]>([])

  // Students state
  const [students, setStudents] = useState<StudentItem[]>([])

  // Progress / Gradebook state & filters
  const [attempts, setAttempts] = useState<AttemptItem[]>([])
  const [gradebookClassId, setGradebookClassId] = useState<string>('ALL')
  const [gradebookStatus, setGradebookStatus] = useState<'ALL' | 'completed' | 'in_progress'>('ALL')
  const [gradebookSearch, setGradebookSearch] = useState<string>('')
  const [isRefreshingAttempts, setIsRefreshingAttempts] = useState(false)
  const [loading, setLoading] = useState(false)

  // Kiểm tra quyền: Chỉ Teacher và Admin mới có quyền truy cập
  const isAuthorized = profile?.role === 'TEACHER' || profile?.role === 'ADMIN'


  // 2. Tải tiến độ làm bài (Attempts) và ánh xạ lớp học
  const loadAttempts = useCallback(async () => {
    setIsRefreshingAttempts(true)
    try {
      // 2.1. Lấy kết quả làm bài theo quyền RLS (Giáo viên chỉ thấy lớp mình, Admin thấy toàn trường)
      const { data: attemptData, error: attemptError } = await supabase
        .from('student_attempts')
        .select('*, profiles(id, full_name, email, username)')
        .order('updated_at', { ascending: false })
        .limit(100)

      if (attemptError || !attemptData) return

      // 2.2. Lấy thông tin lớp học của các học sinh này
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

      // 2.3. Định dạng dữ liệu với first_score, status và lớp học
      const formatted: AttemptItem[] = attemptData.map((row: any) => {
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
          support_mode: row.support_mode || 'INDEPENDENT',
          attempt_count: row.attempt_count || 1,
          completed_at: row.completed_at,
          updated_at: row.updated_at,
          created_at: row.created_at,
        }
      })

      setAttempts(formatted)
    } finally {
      setIsRefreshingAttempts(false)
    }
  }, [])

  // 3. Tải danh mục Task (Mặc định ẩn 32 bài mẫu, chỉ nạp bài tập thực tế từ Supabase)
  const loadTasks = useCallback(async () => {
    const showStandard = localStorage.getItem('gsec_show_standard_tasks') === 'true'
    const { data: dbTasks } = await supabase
      .from('tasks')
      .select('code, worksheet, task_number, title, subtitle, form_type')
      .order('code')

    const dbMap = new Map<string, any>()
    if (dbTasks) {
      dbTasks.forEach((t) => dbMap.set(t.code, t))
    }

    const merged: TaskOption[] = []

    if (showStandard) {
      TASKS.forEach((t) => {
        const dbItem = dbMap.get(t.code)
        merged.push({
          code: t.code,
          title: dbItem?.title || t.title,
          subtitle: dbItem?.subtitle || t.subtitle,
          form_type: dbItem?.form_type || 'FORM_1_CHOICE',
        })
      })
    }

    if (dbTasks) {
      dbTasks.forEach((dbT) => {
        if (!merged.some((m) => m.code === dbT.code)) {
          merged.push({
            code: dbT.code,
            title: dbT.title,
            subtitle: dbT.subtitle || '',
            form_type: dbT.form_type || 'FORM_1_CHOICE',
          })
        }
      })
    }
    const deletedCodes: string[] = JSON.parse(localStorage.getItem('gsec_deleted_tasks') || '[]')
    setTaskList(merged.filter((m) => !deletedCodes.includes(m.code)))
  }, [])

  // 4. Tải danh sách bài tập đã giao cho các lớp của giáo viên
  const loadAssignments = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, class_id, task_code, due_date, created_at, classes(name, code), tasks(title, subtitle, form_type)')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setAssignments(data as any)
      } else {
        const { data: plainData } = await supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false })
        if (plainData) {
          setAssignments(plainData as any)
        }
      }
    } catch (err) {
      console.error('Lỗi loadAssignments:', err)
    }
  }, [user])

  // 5. Xử lý giáo viên giao bài tập cho lớp
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignClassId || !assignTaskCode || !user) return

    setIsSubmittingAssign(true)
    setAssignMessage(null)

    const { error } = await supabase.from('assignments').insert({
      class_id: assignClassId,
      task_code: assignTaskCode,
      assigned_by: user.id,
      due_date: assignDueDate ? new Date(assignDueDate).toISOString() : null,
    })

    setIsSubmittingAssign(false)
    if (error) {
      setAssignMessage({ success: false, text: `Lỗi khi giao bài: ${error.message}` })
    } else {
      setAssignMessage({ success: true, text: `Đã giao bài tập ${assignTaskCode} cho lớp thành công!` })
      setAssignTaskCode('')
      setAssignDueDate('')
      await loadAssignments()
    }
  }

  // 6. Xử lý giáo viên hủy / xóa bài tập đã giao
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

  useEffect(() => {
    let ignore = false
    if (!isAuthorized || !user) return

    setLoading(true)
    Promise.all([
      supabase.from('classes').select('*').order('created_at', { ascending: false }),
      loadAttempts(),
      loadTasks(),
      loadAssignments(),
    ]).then(([classRes]) => {
      if (ignore) return
      setLoading(false)
      if (classRes.data) {
        setClasses(classRes.data as ClassItem[])
        if (classRes.data.length > 0) {
          setSelectedClassId((prev) => prev || classRes.data[0].id)
          setAssignClassId((prev) => prev || classRes.data[0].id)
        }
      }
    })

    return () => {
      ignore = true
    }
  }, [isAuthorized, user, loadAttempts, loadTasks, loadAssignments])

  const loadStudentsForClass = useCallback(async (classId: string) => {
    if (!classId) return
    const { data, error } = await supabase
      .from('class_students')
      .select('joined_at, profiles(id, full_name, email, username, is_managed)')
      .eq('class_id', classId)

    if (!error && data) {
      const formatted = data.map((row: any) => ({
        id: row.profiles?.id,
        full_name: row.profiles?.full_name || 'Học sinh',
        email: row.profiles?.email,
        username: row.profiles?.username,
        is_managed: row.profiles?.is_managed,
        joined_at: row.joined_at,
      }))
      setStudents(formatted)
    }
  }, [])

  useEffect(() => {
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId)
    }
  }, [selectedClassId, loadStudentsForClass])

  // 4. Lắng nghe Realtime khi học sinh nộp bài
  useEffect(() => {
    if (!isAuthorized) return

    const channel = supabase
      .channel('teacher-live-attempts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_attempts' },
        () => {
          loadAttempts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAuthorized, loadAttempts])


  // Sao chép mã lớp vào bộ nhớ tạm
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }



  if (!isAuthorized) {
    return (
      <main className="auth-container" style={{ textAlign: 'center', margin: '15vh auto' }}>
        <span className="launcher-avatar" aria-hidden="true" style={{ margin: '0 auto 16px' }}>
          !
        </span>
        <h2>Khu vực dành cho Giáo viên</h2>
        <p style={{ color: 'var(--color-muted)', fontSize: '14px', margin: '12px 0 24px' }}>
          Tài khoản của bạn hiện mang vai trò <strong>{profile?.role === 'STUDENT' ? 'Học sinh' : 'Chưa phân quyền'}</strong>.
          Vui lòng liên hệ Quản trị viên để được cấp quyền Giáo viên.
        </p>
        <Link to="/" className="btn-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
          ← Quay lại trang bài tập
        </Link>
      </main>
    )
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId)

  // Helper định dạng thời gian an toàn, không bao giờ rơi vào 1970
  const formatAttemptTime = (a: AttemptItem) => {
    const raw = a.completed_at || a.updated_at || a.created_at
    if (!raw) return '-'
    const d = new Date(raw)
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) {
      return 'Vừa cập nhật'
    }
    return d.toLocaleString('vi-VN')
  }

  // Lọc danh sách tiến độ theo Lớp học, Trạng thái và Tìm kiếm
  const filteredAttempts = attempts.filter((a) => {
    if (gradebookClassId !== 'ALL') {
      if (a.class_id !== gradebookClassId) return false
    }
    if (gradebookStatus !== 'ALL') {
      if (a.status !== gradebookStatus) return false
    }
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

  const completedCount = filteredAttempts.filter((a) => a.status === 'completed').length
  const inProgressCount = filteredAttempts.filter((a) => a.status === 'in_progress').length
  const avgScore = filteredAttempts.length > 0
    ? Math.round(filteredAttempts.reduce((acc, a) => acc + a.score, 0) / filteredAttempts.length)
    : 0

  return (
    <>
      <AppHeader currentPortal="teacher" />
      <div className="portal-shell">
        <header className="portal-header">
          <div className="portal-title-group">
            <h1>Cổng Giáo Viên — GSEC 6</h1>
            <p>Quản lý lớp học, cấp mã tham gia và theo dõi kết quả học sinh</p>
          </div>
        </header>

      {/* Tabs */}
      <nav className="portal-tabs">
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'classes' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          🏫 Lớp học của tôi ({classes.length})
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'assignments' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          📝 Giao bài tập ({assignments.length})
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'students' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👨‍🎓 Quản lý Học sinh
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'progress' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          📊 Bảng điểm Realtime ({filteredAttempts.length})
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === 'keypad' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('keypad')}
        >
          ⌨️ Nhập Mã Code
        </button>
      </nav>

      {/* TAB 1: LỚP HỌC */}
      {activeTab === 'classes' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Danh sách Lớp học phụ trách</h2>
          </div>

          {loading ? (
            <div className="class-card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--color-muted)' }}>Đang tải danh sách lớp học...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="class-card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--color-muted)' }}>Bạn chưa được phân công lớp học nào. Vui lòng liên hệ Quản trị viên (Admin) để tạo lớp học và phân công giảng dạy.</p>
            </div>
          ) : (
            <div className="class-grid">
              {classes.map((c) => (
                <article className="class-card" key={c.id}>
                  <div>
                    <div className="class-card-header">
                      <div>
                        <h3 className="class-card-title">{c.name}</h3>
                        <span className="class-card-meta">
                          Tạo ngày: {new Date(c.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>

                    <div className="class-code-badge">
                      <span>Mã vào lớp:</span>
                      <strong className="class-code-value">{c.code}</strong>
                      <button
                        type="button"
                        className="btn-copy-code"
                        onClick={() => handleCopyCode(c.code)}
                      >
                        {copiedCode === c.code ? 'Đã chép ✓' : 'Sao chép'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--primary"
                      style={{ flex: 1, textAlign: 'center', border: 'none', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedClassId(c.id)
                        setActiveTab('students')
                      }}
                    >
                      Xem học sinh
                    </button>
                    <button
                      type="button"
                      className="btn-auth-link btn-auth-link--secondary"
                      style={{ flex: 1, textAlign: 'center', border: 'none', cursor: 'pointer' }}
                      onClick={() => {
                        setAssignClassId(c.id)
                        setActiveTab('assignments')
                      }}
                    >
                      📝 Giao bài
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB GIAO BÀI TẬP */}
      {activeTab === 'assignments' && (
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {/* FORM GIAO BÀI MỚI */}
            <div className="class-card">
              <h2 style={{ fontSize: '18px', margin: '0 0 8px' }}>➕ Giao Bài Tập Mới</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: '0 0 16px' }}>
                Chọn lớp học và bài tập từ ngân hàng đề để giao cho học sinh của bạn.
              </p>

              {assignMessage && (
                <div
                  className={`auth-message ${assignMessage.success ? 'auth-message--success' : 'auth-message--error'}`}
                  style={{ marginBottom: '16px' }}
                >
                  {assignMessage.text}
                </div>
              )}

              {classes.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '14px' }}>
                    Bạn cần tạo ít nhất 1 lớp học trước khi có thể giao bài tập.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleAssignTask} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="teacher-assign-class">Lớp học nhận bài:</label>
                    <select
                      id="teacher-assign-class"
                      className="form-input"
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      required
                    >
                      <option value="">-- Chọn lớp nhận bài tập --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Mã lớp: {c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="teacher-assign-task">Chọn bài tập giao:</label>
                    <select
                      id="teacher-assign-task"
                      className="form-input"
                      value={assignTaskCode}
                      onChange={(e) => setAssignTaskCode(e.target.value)}
                      required
                    >
                      <option value="">-- Chọn bài tập trong kho ({taskList.length} bài) --</option>
                      {taskList.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.code} - {t.title} ({t.form_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="teacher-assign-due">Hạn nộp bài (Tùy chọn):</label>
                    <input
                      id="teacher-assign-due"
                      type="datetime-local"
                      className="form-input"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-submit"
                    style={{ marginTop: '8px', width: '100%' }}
                    disabled={isSubmittingAssign}
                  >
                    {isSubmittingAssign ? '⏳ Đang giao bài...' : '🚀 Giao bài tập ngay'}
                  </button>
                </form>
              )}
            </div>

            {/* DANH SÁCH BÀI ĐÃ GIAO */}
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
                          Chưa có bài tập nào được giao cho các lớp của bạn.
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
                              <div style={{ fontSize: '12px', color: 'var(--color-text)', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* TAB 2: QUẢN LÝ HỌC SINH */}
      {activeTab === 'students' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label htmlFor="class-select" style={{ fontWeight: 700 }}>Chọn lớp:</label>
              <select
                id="class-select"
                className="form-input"
                style={{ width: 'auto', minWidth: '200px' }}
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Mã: {c.code})
                  </option>
                ))}
              </select>
            </div>

            {selectedClass && (
              <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                Mã tham gia lớp: <strong style={{ color: 'var(--color-primary)', letterSpacing: '1px' }}>{selectedClass.code}</strong>
                <button
                  type="button"
                  className="btn-copy-code"
                  style={{ marginLeft: '8px' }}
                  onClick={() => handleCopyCode(selectedClass.code)}
                >
                  {copiedCode === selectedClass.code ? '✓ Đã chép' : 'Sao chép mã'}
                </button>
              </div>
            )}
          </div>

          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Email / Username</th>
                  <th>Loại học sinh</th>
                  <th>Ngày vào lớp</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '32px' }}>
                      Chưa có học sinh nào trong lớp. Học sinh có thể dùng mã <strong>{selectedClass?.code}</strong> để tự tham gia lớp học.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.full_name}</strong></td>
                      <td>{s.username || s.email}</td>
                      <td>
                        <span className={`user-badge ${s.is_managed ? 'user-badge--admin' : 'user-badge--student'}`}>
                          {s.is_managed ? 'Trung tâm cấp' : 'Tự tham gia'}
                        </span>
                      </td>
                      <td>{new Date(s.joined_at).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: TIẾN ĐỘ REALTIME */}
      {activeTab === 'progress' && (
        <section>
          {/* Header với trạng thái Realtime & Nút Refresh */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2>Bảng Theo Dõi & Điểm Số Realtime</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                {profile?.role === 'ADMIN'
                  ? 'Quản trị viên: Toàn quyền theo dõi mọi học sinh và lớp học trên hệ thống'
                  : 'Giáo viên: Theo dõi tiến độ các học sinh thuộc lớp bạn phụ trách'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Đang nhận bài trực tiếp
              </span>
              <button
                type="button"
                className="btn-auth-link btn-auth-link--secondary"
                style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                disabled={isRefreshingAttempts}
                onClick={loadAttempts}
              >
                {isRefreshingAttempts ? '⏳ Đang tải...' : '🔄 Làm mới'}
              </button>
            </div>
          </div>

          {/* Hàng Bộ Lọc & Tìm Kiếm */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px', background: 'var(--color-card, #fff)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-line, #e2e8f0)' }}>
            {/* Lọc theo lớp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="gb-class-filter" style={{ fontSize: '13px', fontWeight: 700 }}>Lớp học:</label>
              <select
                id="gb-class-filter"
                className="form-input"
                style={{ width: 'auto', minWidth: '180px', padding: '6px 10px', fontSize: '13px' }}
                value={gradebookClassId}
                onChange={(e) => setGradebookClassId(e.target.value)}
              >
                <option value="ALL">
                  {profile?.role === 'ADMIN' ? 'Toàn trường (Tất cả lớp)' : 'Tất cả lớp của tôi'}
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc theo trạng thái */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="gb-status-filter" style={{ fontSize: '13px', fontWeight: 700 }}>Trạng thái:</label>
              <select
                id="gb-status-filter"
                className="form-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                value={gradebookStatus}
                onChange={(e) => setGradebookStatus(e.target.value as any)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="completed">Đã hoàn thành ✓</option>
                <option value="in_progress">Đang làm dở ⏳</option>
              </select>
            </div>

            {/* Ô tìm kiếm */}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line, #e2e8f0)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 500 }}>📚 Tổng bài nộp</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '6px', color: 'var(--color-text)' }}>{filteredAttempts.length}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line, #e2e8f0)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: '13px', color: '#059669', fontWeight: 500 }}>✅ Đã hoàn thành</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>{completedCount}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line, #e2e8f0)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: '13px', color: '#d97706', fontWeight: 500 }}>⏳ Đang làm dở</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>{inProgressCount}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--color-line, #e2e8f0)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-primary, #4f46e5)', fontWeight: 500 }}>🎯 Điểm trung bình</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary, #4f46e5)', marginTop: '6px' }}>{avgScore}/100</div>
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

      {/* TAB 5: BÀN PHÍM GÕ MÃ CODE (ĐỒNG NHẤT VỚI TẤT CẢ CÁC ROLE) */}
      {activeTab === 'keypad' && (
        <main className="student-centered-hero" id="teacher-keypad">
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

    </div>
  </>
)
}
