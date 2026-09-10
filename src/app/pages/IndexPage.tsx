import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { getTaskPath, normalizeTaskCode, TASKS } from '../registry'
import { useAuth } from '../auth'
import { supabase } from '../../lib/supabaseClient'
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
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  useEffect(() => {
    document.title = 'AI Tutor · WS 1'
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
      setLoadingAssignments(false)
      return
    }

    setLoadingAssignments(true)
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
    } catch (err) {
      console.error('Lỗi loadStudentAssignments:', err)
    } finally {
      setLoadingAssignments(false)
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

  // Điều hướng tự động theo vai trò: Admin -> /admin, Teacher -> /teacher
  // Cho phép Admin / Teacher mở mode=student để thử nghiệm bàn phím như học sinh
  const isTestingStudentMode = searchParams.get('mode') === 'student'
  if (user && profile && !isTestingStudentMode) {
    if (profile.role === 'ADMIN') {
      return <Navigate replace to="/admin" />
    }
    if (profile.role === 'TEACHER') {
      return <Navigate replace to="/teacher" />
    }
  }

  const isStudentView = Boolean(user && (profile?.role === 'STUDENT' || isTestingStudentMode))
  const uncompletedCount = studentAssignments.filter((a) => a.status !== 'completed').length

  return (
    <>
      <AppHeader currentPortal="student" isTestingStudentMode={isTestingStudentMode} />

      {/* KHU VỰC THÔNG BÁO BÀI TẬP & LỚP HỌC CHO HỌC SINH */}
      {isStudentView && (
        <div style={{ width: 'min(580px, calc(100% - 32px))', margin: '16px auto 0' }}>
          {/* Card Quản lý Lớp & Tham gia */}
          <aside className="student-classes-card" style={{ width: '100%', margin: '0 0 12px' }}>
            <div className="student-classes-head">
              <div>
                <strong>
                  {enrolledClasses.length > 0 ? `📚 Lớp đang học (${enrolledClasses.length})` : '🎒 Học tập tự do'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                  {enrolledClasses.length > 0 ? 'Bạn đang là thành viên của các lớp học dưới đây' : 'Chưa tham gia lớp nào của giáo viên'}
                </div>
              </div>
              <button
                type="button"
                className="btn-join-class"
                onClick={() => setIsJoinModalOpen(true)}
              >
                + Nhập mã vào lớp
              </button>
            </div>

            {enrolledClasses.length === 0 ? (
              <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', marginTop: '8px' }}>
                <p style={{ fontSize: '12.5px', color: '#92400e', margin: 0, lineHeight: 1.4 }}>
                  💡 <strong>Bạn chưa nhận được bài tập?</strong> Hãy bấm nút <strong>"+ Nhập mã vào lớp"</strong> ở trên và nhập mã lớp do thầy cô cung cấp (ví dụ: <strong>GSEC3EMS</strong>) để nhận bài tập được giao!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {enrolledClasses.map((cl) => (
                  <span
                    key={cl.id}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: '#f1f5f9',
                      color: '#1e293b',
                      fontWeight: 650,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    📚 {cl.name} · <span style={{ color: 'var(--color-muted)' }}>{cl.teacher_name}</span> (Mã: <code>{cl.code}</code>)
                  </span>
                ))}
              </div>
            )}
          </aside>

          {/* Card Bài Tập Được Giao & Hạn Nộp */}
          <section className="student-assignments-card" style={{ width: '100%', margin: 0 }}>
            <div className="student-assignments-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--color-text)' }}>
                  📝 BÀI TẬP ĐƯỢC GIAO CẦN LÀM
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  Nhiệm vụ học tập và hạn nộp bài từ giáo viên
                </span>
              </div>
              {loadingAssignments ? (
                <span className="assignment-badge" style={{ background: '#f1f5f9', color: 'var(--color-muted)' }}>
                  ⏳ Đang kiểm tra...
                </span>
              ) : studentAssignments.length > 0 && uncompletedCount > 0 ? (
                <span className="assignment-badge assignment-badge--pending">
                  🔔 Còn {uncompletedCount} bài cần làm
                </span>
              ) : studentAssignments.length > 0 ? (
                <span className="assignment-badge assignment-badge--completed">
                  🎉 Đã hoàn thành tất cả
                </span>
              ) : (
                <span className="assignment-badge" style={{ background: '#f8fafc', color: 'var(--color-muted)', border: '1px solid #e2e8f0' }}>
                  0 bài tập
                </span>
              )}
            </div>

            {loadingAssignments ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: '13px' }}>
                ⏳ Đang kiểm tra bài tập mới nhất...
              </div>
            ) : studentAssignments.length > 0 ? (
              <>
                {uncompletedCount > 0 && (
                  <div style={{ padding: '8px 12px', background: '#fff4ed', borderRadius: '8px', border: '1px solid #fedf89', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>⏰</span>
                    <span style={{ fontSize: '12.5px', color: '#c4320a', fontWeight: 650 }}>
                      Bạn có {uncompletedCount} bài tập chưa nộp. Hãy chú ý hạn chót bên dưới để hoàn thành đúng hạn nhé!
                    </span>
                  </div>
                )}

                <div className="student-assignments-list">
                  {studentAssignments.map((item) => {
                    const isDone = item.status === 'completed'
                    const isOngoing = item.status === 'in_progress'

                    return (
                      <div
                        key={item.id}
                        className={`student-assignment-row ${isDone ? 'is-completed' : ''} ${item.is_overdue ? 'is-overdue' : ''}`}
                      >
                        <div className="student-assignment-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span className="task-code-pill">{item.task_code}</span>
                            <span className="assignment-class-tag">📚 {item.class_name} ({item.teacher_name})</span>
                          </div>
                          <h4 className="assignment-task-title">{item.title}</h4>
                          {item.subtitle ? <p className="assignment-task-subtitle">{item.subtitle}</p> : null}

                          <div className="assignment-meta-row">
                            {item.due_date ? (
                              <span className={`assignment-due-tag ${item.is_overdue ? 'is-overdue' : ''}`}>
                                ⏰ Hạn: {new Date(item.due_date).toLocaleDateString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                                {item.is_overdue ? ' ⚠️ Quá hạn' : ''}
                              </span>
                            ) : (
                              <span className="assignment-due-tag">⏰ Không có hạn nộp</span>
                            )}

                            {isDone && (
                              <span className="assignment-score-tag">
                                ⭐ Đạt: {item.score ?? 0}đ {item.first_score != null && item.first_score !== item.score ? `(Lần 1: ${item.first_score}đ)` : ''}
                              </span>
                            )}
                            {isOngoing && (
                              <span className="assignment-due-tag" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                ⏳ Đang làm dở
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="student-assignment-action">
                          {isDone ? (
                            <button
                              type="button"
                              className="btn-task-action btn-task-action--review"
                              onClick={() => navigate(`/tasks/${item.task_code}`)}
                            >
                              👁️ Xem lại
                            </button>
                          ) : isOngoing ? (
                            <button
                              type="button"
                              className="btn-task-action btn-task-action--continue"
                              onClick={() => navigate(`/tasks/${item.task_code}`)}
                            >
                              ✏️ Tiếp tục
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-task-action btn-task-action--start"
                              onClick={() => navigate(`/tasks/${item.task_code}`)}
                            >
                              🚀 Làm bài ngay
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : enrolledClasses.length > 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-muted)' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🎉</div>
                <div style={{ fontSize: '13px', fontWeight: 650, color: '#334155' }}>Hiện tại chưa có bài tập nào được giao cho các lớp của bạn.</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Bạn có thể thoải mái nhập mã 5 chữ số ở bàn phím bên dưới để tự luyện tập!</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--color-muted)' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>📬</div>
                <div style={{ fontSize: '13px', fontWeight: 650, color: '#334155' }}>Khu vực thông báo bài tập đang trống</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Khi bạn tham gia vào lớp học của giáo viên, toàn bộ bài tập và hạn nộp sẽ hiển thị tại đây!
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <main id="code-keypad" className="launcher-shell" style={{ marginTop: '20px' }}>
        <span className="launcher-avatar" aria-hidden="true">
          AI
        </span>
        <h1>AI Tutor · WS 1</h1>
        <InlineCodeKeypad onNavigate={(code) => navigate(`/tasks/${code}`)} />
        {requestedCode ? (
          <p className="launcher-error" role="alert">
            Không tìm thấy task có mã {requestedCode}.
          </p>
        ) : null}
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
