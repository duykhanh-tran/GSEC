import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { getTaskPath, normalizeTaskCode, TASKS } from '../registry'
import { useAuth } from '../auth'
import { supabase } from '../../lib/supabaseClient'
import { taskCacheService } from '../../lib/taskCacheService'
import { InlineCodeKeypad } from '../../components/keypad/InlineCodeKeypad'
import { AppHeader } from '../../components/shell/AppHeader'
import '../../styles/auth.css'
import '../../styles/portal.css'

interface EnrolledClass {
  id: string
  name: string
  code: string
  teacher_name?: string
}

interface StudentAssignmentItem {
  id: string
  task_code: string
  due_date?: string | null
  created_at: string
  class_name: string
  teacher_name: string
  title: string
  subtitle: string
  form_type: string
  status: 'not_started' | 'in_progress' | 'completed'
  score?: number | null
  first_score?: number | null
  is_overdue: boolean
}

export function IndexPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const requestedCode = normalizeTaskCode(searchParams.get('page'))
  const requestedPath = requestedCode ? getTaskPath(requestedCode) : null

  // Student class enrollment state
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([])
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [classCodeInput, setClassCodeInput] = useState('')
  const [joinMessage, setJoinMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [joining, setJoining] = useState(false)

  // Student assigned homework state
  const [studentAssignments, setStudentAssignments] = useState<StudentAssignmentItem[]>([])

  useEffect(() => {
    document.title = 'GSEC-6'
    // Tải trước ngầm các bài tập phổ biến/bài tập có audio để học sinh nhập mã là mở ngay tức thì
    if (import.meta.env.MODE !== 'test') {
      const timer = setTimeout(() => {
        taskCacheService.preloadTasksBatch([
          '60111', '60112',
          '60123', '60124', '60125', '60126',
          '60145', '60146',
          '60161', '60162',
          '60182', '60183', '60184',
        ])
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('mode') === 'code' || window.location.hash === '#code-keypad') {
      const timer = setTimeout(() => {
        const el = document.getElementById('code-keypad')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // 1. Tải danh sách lớp mà học sinh đã tham gia (Tuyệt đối không dùng nested profiles join để chống lỗi PGRST201)
  const fetchStudentClasses = useCallback(async (studentId: string): Promise<EnrolledClass[]> => {
    try {
      // 1.1. Lấy danh sách class_id mà học sinh đã tham gia
      const { data: csRows, error: csErr } = await supabase
        .from('class_students')
        .select('class_id')
        .eq('student_id', studentId)

      if (csErr || !csRows || csRows.length === 0) {
        return []
      }

      const classIds = csRows.map((cs: any) => cs.class_id).filter(Boolean)
      if (classIds.length === 0) return []

      // 1.2. Lấy thông tin chi tiết lớp học
      const { data: classRows, error: cErr } = await supabase
        .from('classes')
        .select('id, name, code, teacher_id')
        .in('id', classIds)

      if (cErr || !classRows || classRows.length === 0) return []

      // 1.3. Lấy tên giáo viên phụ trách từ profiles
      const teacherIds = Array.from(new Set(classRows.map((c: any) => c.teacher_id).filter(Boolean)))
      const teacherMap = new Map<string, string>()
      if (teacherIds.length > 0) {
        const { data: pList } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teacherIds)
        if (pList) {
          pList.forEach((p: any) => teacherMap.set(p.id, p.full_name))
        }
      }

      return classRows.map((c: any) => ({
        id: c.id,
        name: c.name || 'Lớp học',
        code: c.code || '',
        teacher_name: teacherMap.get(c.teacher_id) || 'Giáo viên',
      }))
    } catch (err) {
      console.error('Lỗi fetchStudentClasses:', err)
      return []
    }
  }, [])

  // 2. Tải bài tập được giao cho các lớp của học sinh kèm trạng thái điểm
  const loadStudentAssignments = useCallback(async (classes: EnrolledClass[]) => {
    if (!user) {
      setStudentAssignments([])
      return
    }

    if (classes.length === 0) {
      setStudentAssignments([])
      return
    }

    try {
      const classIds = classes.map((c) => c.id).filter(Boolean)
      const classMap = new Map<string, EnrolledClass>()
      classes.forEach((c) => classMap.set(c.id, c))
      const catalogMap = new Map(TASKS.map((t) => [t.code, t]))

      // 2.1. Lấy danh sách bài tập đã giao theo class_id
      const { data: assignData, error: assignError } = await supabase
        .from('assignments')
        .select('id, class_id, task_code, due_date, created_at')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })

      if (assignError) {
        console.error('Lỗi lấy bài tập được giao:', assignError)
      }

      const rawAssignments = assignData || []

      // Bổ sung thông tin tiêu đề cho các bài tập động do Admin tạo (nếu không có trong catalog tĩnh)
      const customCodes = rawAssignments
        .map((a: any) => a.task_code)
        .filter((code: string) => !catalogMap.has(code))

      if (customCodes.length > 0) {
        const { data: customTasks } = await supabase
          .from('tasks')
          .select('code, title, subtitle')
          .in('code', customCodes)

        if (customTasks) {
          customTasks.forEach((ct: any) => {
            catalogMap.set(ct.code, { title: ct.title, subtitle: ct.subtitle } as any)
          })
        }
      }

      // 2.2. Lấy kết quả làm bài của học sinh để map trạng thái & điểm
      const { data: attemptData } = await supabase
        .from('student_attempts')
        .select('task_code, score, first_score, status, updated_at')
        .eq('student_id', user.id)

      const attemptMap = new Map<string, any>()
      if (attemptData) {
        attemptData.forEach((att: any) => {
          attemptMap.set(att.task_code, att)
        })
      }

      const nowMs = Date.now()
      const formatted: StudentAssignmentItem[] = rawAssignments.map((item: any) => {
        const attempt = attemptMap.get(item.task_code)
        const isCompleted = attempt?.status === 'completed'
        const isInProgress = attempt?.status === 'in_progress'

        let isOverdue = false
        if (item.due_date && !isCompleted) {
          const dueMs = new Date(item.due_date).getTime()
          if (!Number.isNaN(dueMs) && dueMs < nowMs) {
            isOverdue = true
          }
        }

        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
        if (isCompleted) status = 'completed'
        else if (isInProgress) status = 'in_progress'

        const cInfo = classMap.get(item.class_id)
        const catTask = catalogMap.get(item.task_code)

        return {
          id: item.id,
          task_code: item.task_code,
          due_date: item.due_date,
          created_at: item.created_at,
          class_name: cInfo?.name || 'Lớp học',
          teacher_name: cInfo?.teacher_name || 'Giáo viên',
          title: catTask?.title || `Bài tập ${item.task_code}`,
          subtitle: catTask?.subtitle || '',
          form_type: '',
          status,
          score: attempt?.score ?? null,
          first_score: attempt?.first_score ?? null,
          is_overdue: isOverdue,
        }
      })

      setStudentAssignments(formatted)
      if (import.meta.env.MODE !== 'test') {
        const assignedCodes = formatted.map((f) => f.task_code)
        taskCacheService.preloadTasksBatch(assignedCodes)
      }
    } catch (err) {
      console.error('Lỗi loadStudentAssignments:', err)
    } finally {
      // Done loading
    }
  }, [user])

  // Làm mới danh sách lớp và bài tập của học sinh
  const refreshEnrolledClasses = useCallback(async () => {
    if (!user) return
    const classes = await fetchStudentClasses(user.id)
    setEnrolledClasses(classes)
    await loadStudentAssignments(classes)
  }, [user, fetchStudentClasses, loadStudentAssignments])

  // Tải ban đầu khi mở trang hoặc khi đổi user/role
  useEffect(() => {
    let ignore = false
    const isStudent = profile?.role === 'STUDENT' || searchParams.get('mode') === 'student'
    if (user && isStudent) {
      fetchStudentClasses(user.id).then((classes) => {
        if (!ignore) {
          setEnrolledClasses(classes)
          loadStudentAssignments(classes)
        }
      })
    }
    return () => {
      ignore = true
    }
  }, [user, profile?.role, searchParams, fetchStudentClasses, loadStudentAssignments])

  // Xử lý tham gia lớp bằng mã Class Code
  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classCodeInput.trim()) return

    setJoining(true)
    setJoinMessage(null)

    try {
      // Gọi hàm RPC join_class_by_code
      const { data, error } = await supabase.rpc('join_class_by_code', {
        p_class_code: classCodeInput.trim().toUpperCase(),
      })

      setJoining(false)

      if (error) {
        setJoinMessage({ text: error.message, isError: true })
      } else if (data && !data.success) {
        setJoinMessage({ text: data.message, isError: true })
      } else {
        setJoinMessage({ text: data.message || 'Tham gia lớp thành công!', isError: false })
        setClassCodeInput('')
        await refreshEnrolledClasses()
        setTimeout(() => {
          setIsJoinModalOpen(false)
          setJoinMessage(null)
        }, 1800)
      }
    } catch (err: unknown) {
      setJoining(false)
      setJoinMessage({ text: err instanceof Error ? err.message : 'Có lỗi xảy ra khi tham gia lớp.', isError: true })
    }
  }

  if (requestedPath) {
    return <Navigate replace to={requestedPath} />
  }

  // Điều hướng tự động theo vai trò:
  // 1. Giáo viên TUYỆT ĐỐI KHÔNG xem giao diện học sinh -> luôn chuyển hướng về /teacher
  if (user && profile?.role === 'TEACHER') {
    return <Navigate replace to="/teacher" />
  }

  // 2. Admin chỉ chuyển hướng về /admin nếu không chủ động bật mode=student để kiểm thử
  const isTestingStudentMode = searchParams.get('mode') === 'student'
  if (user && profile?.role === 'ADMIN' && !isTestingStudentMode) {
    return <Navigate replace to="/admin" />
  }

  const uncompletedCount = studentAssignments.filter((a) => a.status !== 'completed').length

  return (
    <>
      <AppHeader
        currentPortal="student"
        isTestingStudentMode={isTestingStudentMode}
        studentAssignments={studentAssignments}
      />

      <main className="student-centered-hero" id="code-keypad">
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

          {requestedCode ? (
            <p className="launcher-error" role="alert" style={{ marginTop: '12px' }}>
              Không tìm thấy task có mã {requestedCode}.
            </p>
          ) : null}

          {/* HINT: THÔNG BÁO BÀI TẬP NẰM TRONG THẺ TÊN HEADER */}
          <div className="student-header-hint-card">
            <span className="student-header-hint-icon">💡</span>
            <div className="student-header-hint-content">
              {uncompletedCount > 0 ? (
                <span>
                  Em có <strong>{uncompletedCount} bài tập</strong> cô giáo giao chưa làm.{' '}
                  <strong>Di chuột hoặc chạm vào Thẻ tên</strong> ở góc trên bên phải thanh menu để xem danh sách bài và làm ngay!
                </span>
              ) : (
                <span>
                  <strong>Di chuột hoặc chạm vào Thẻ tên</strong> ở góc trên bên phải để xem thông báo, danh sách bài tập được giao và lớp học của em.
                </span>
              )}
              {enrolledClasses.length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                  📚 Lớp đang tham gia: <strong>{enrolledClasses.map((c) => c.name).join(', ')}</strong>
                </div>
              )}
            </div>
          </div>

          {/* NÚT THAM GIA LỚP HỌC MỚI */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              className="btn-auth-link btn-auth-link--secondary"
              style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '20px', cursor: 'pointer' }}
              onClick={() => setIsJoinModalOpen(true)}
            >
              + Nhập mã tham gia lớp học mới
            </button>
          </div>
        </div>
      </main>

      {/* MODAL NHẬP MÃ THAM GIA LỚP */}
      {isJoinModalOpen && (
        <div className="portal-modal-overlay">
          <div className="portal-modal" style={{ width: '420px' }}>
            <div className="portal-modal-header">
              <h2>Tham Gia Lớp Học</h2>
              <button
                type="button"
                className="portal-modal-close"
                onClick={() => {
                  setIsJoinModalOpen(false)
                  setJoinMessage(null)
                }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--color-muted)', margin: '0 0 16px' }}>
              Nhập mã lớp gồm 6 ký tự do giáo viên hoặc trung tâm cung cấp (ví dụ: <strong>GSEC6A</strong>):
            </p>

            {joinMessage && (
              <div
                className={`auth-message ${joinMessage.isError ? 'auth-message--error' : 'auth-message--success'}`}
                style={{ marginBottom: '16px' }}
              >
                {joinMessage.text}
              </div>
            )}

            <form onSubmit={handleJoinClass} className="auth-form">
              <div className="form-group">
                <label htmlFor="join-class-code">Mã lớp học</label>
                <input
                  id="join-class-code"
                  type="text"
                  className="form-input"
                  style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}
                  required
                  maxLength={10}
                  placeholder="vd: GSEC6A"
                  value={classCodeInput}
                  onChange={(e) => setClassCodeInput(e.target.value)}
                  disabled={joining}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn-auth-link btn-auth-link--secondary"
                  style={{ flex: 1, border: 'none', cursor: 'pointer' }}
                  onClick={() => setIsJoinModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-submit" style={{ flex: 1 }} disabled={joining}>
                  {joining ? 'Đang kiểm tra...' : 'Tham Gia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
