import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabaseClient'
import { TASKS } from '../../app/registry'
import '../../styles/app-header.css'

export interface AppHeaderAssignmentItem {
  id: string
  task_code: string
  title: string
  class_name?: string
  due_date?: string | null
  status?: 'not_started' | 'in_progress' | 'completed'
  score?: number | null
}

export interface AppHeaderProps {
  currentPortal?: 'student' | 'teacher' | 'admin'
  isTestingStudentMode?: boolean
  studentAssignments?: AppHeaderAssignmentItem[]
}

export function AppHeader({ currentPortal = 'student', isTestingStudentMode, studentAssignments }: AppHeaderProps) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Internal assignments state if not passed from parent
  const [internalAssignments, setInternalAssignments] = useState<AppHeaderAssignmentItem[]>([])
  const [loadingInternal, setLoadingInternal] = useState(false)

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Người dùng'

  const roleName =
    profile?.role === 'ADMIN'
      ? 'Admin'
      : profile?.role === 'TEACHER'
      ? 'Giáo viên'
      : 'Học sinh'

  const roleBadgeClass =
    profile?.role === 'ADMIN'
      ? 'app-role-badge--admin'
      : profile?.role === 'TEACHER'
      ? 'app-role-badge--teacher'
      : 'app-role-badge--student'

  const isTeacherOrAdmin = profile?.role === 'ADMIN' || profile?.role === 'TEACHER'

  // Fetch assignments if user is student and assignments not passed
  const fetchStudentHomework = useCallback(async () => {
    if (!user || profile?.role !== 'STUDENT') return
    if (studentAssignments && studentAssignments.length > 0) return

    setLoadingInternal(true)
    try {
      // 1. Get class IDs
      const { data: classLinks } = await supabase
        .from('class_students')
        .select('class_id')
        .eq('student_id', user.id)

      if (!classLinks || classLinks.length === 0) {
        setInternalAssignments([])
        return
      }

      const classIds = classLinks.map((c: any) => c.class_id)

      // 2. Get class names
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds)

      const classMap = new Map<string, string>()
      if (classesData) {
        classesData.forEach((c: any) => classMap.set(c.id, c.name))
      }

      // 3. Get assignments
      const { data: rawAssign } = await supabase
        .from('assignments')
        .select('id, class_id, task_code, due_date, created_at')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })

      if (!rawAssign || rawAssign.length === 0) {
        setInternalAssignments([])
        return
      }

      // 4. Get student attempts to determine status
      const { data: attemptsData } = await supabase
        .from('student_attempts')
        .select('task_code, score, status')
        .eq('student_id', user.id)

      const attemptMap = new Map<string, any>()
      if (attemptsData) {
        attemptsData.forEach((att: any) => attemptMap.set(att.task_code, att))
      }

      const catalogMap = new Map(TASKS.map((t) => [t.code, t]))

      const formatted: AppHeaderAssignmentItem[] = rawAssign.map((a: any) => {
        const attempt = attemptMap.get(a.task_code)
        const cat = catalogMap.get(a.task_code)
        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
        if (attempt) {
          status = attempt.status === 'completed' ? 'completed' : 'in_progress'
        }

        return {
          id: a.id,
          task_code: a.task_code,
          title: cat?.title || `Bài tập ${a.task_code}`,
          class_name: classMap.get(a.class_id) || 'Lớp học',
          due_date: a.due_date,
          status,
          score: attempt?.score ?? null,
        }
      })

      setInternalAssignments(formatted)
    } catch (err) {
      console.error('Lỗi tải bài tập trong Header:', err)
    } finally {
      setLoadingInternal(false)
    }
  }, [user, profile?.role, studentAssignments])

  useEffect(() => {
    fetchStudentHomework()
  }, [fetchStudentHomework])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleReturnFromPreview = () => {
    if (profile?.role === 'ADMIN') {
      navigate('/admin')
    } else if (profile?.role === 'TEACHER') {
      navigate('/teacher')
    }
  }

  const activeAssignments = studentAssignments || internalAssignments
  const pendingCount = activeAssignments.filter((a) => a.status !== 'completed').length
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url

  return (
    <>
      <header className="app-nav-header">
        <div className="app-nav-container">
          {/* 1. THƯƠNG HIỆU & BỐI CẢNH */}
          <div className="app-nav-brand">
            <Link to="/" className="app-brand-link">
              <div className="app-brand-logo" aria-hidden="true">
                <span>🎓</span>
              </div>
              <div className="app-brand-text">
                <span className="app-brand-title">GSEC AI Tutor</span>
                <span className="app-brand-badge">Hệ Thống Luyện Tập Tiếng Anh</span>
              </div>
            </Link>

            {isTestingStudentMode && isTeacherOrAdmin && (
              <div className="app-preview-tag" title="Bạn đang dùng thử bàn phím bài tập với tư cách người quản lý">
                <span className="app-preview-dot" />
                <span>Xem thử Học sinh</span>
              </div>
            )}
          </div>

          {/* 2. CỤM CHUYỂN ĐỔI PHÂN HỆ (CHỈ DÀNH CHO ADMIN) */}
          {user && profile?.role === 'ADMIN' && (
            <nav className="app-nav-portals" aria-label="Chuyển đổi phân hệ">
              <Link
                to="/admin"
                className={`app-portal-tab ${currentPortal === 'admin' ? 'is-active' : ''}`}
              >
                <span className="tab-icon">🛠️</span>
                <span>Quản Trị Admin</span>
              </Link>

              <Link
                to="/teacher"
                className={`app-portal-tab ${currentPortal === 'teacher' ? 'is-active' : ''}`}
              >
                <span className="tab-icon">🏫</span>
                <span>Cổng Giáo Viên</span>
              </Link>

              <Link
                to="/?mode=student"
                className={`app-portal-tab ${currentPortal === 'student' ? 'is-active' : ''}`}
              >
                <span className="tab-icon">🎒</span>
                <span>Bàn Phím Học Sinh</span>
              </Link>
            </nav>
          )}

          {/* 3. THẺ TÊN TÍCH HỢP DROPDOWN & NÚT ĐĂNG XUẤT CHO MỌI ROLE */}
          <div className="app-nav-user">
            {user ? (
              <div
                className="app-user-dropdown-wrapper"
                ref={menuRef}
                onMouseEnter={() => setIsMenuOpen(true)}
                onMouseLeave={() => setIsMenuOpen(false)}
              >
                <button
                  type="button"
                  className={`app-user-card-btn ${isMenuOpen ? 'is-active' : ''}`}
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="true"
                  title="Nhấn hoặc di chuột để xem thông tin & bài tập"
                >
                  <div className="app-user-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                    {profile?.role === 'STUDENT' && pendingCount > 0 && (
                      <span className="app-user-badge-pip" title={`Bạn có ${pendingCount} bài tập cần làm`}>
                        {pendingCount}
                      </span>
                    )}
                  </div>
                  <div className="app-user-meta">
                    <span className="app-user-name" title={displayName}>
                      {displayName}
                    </span>
                    <span className={`app-role-badge ${roleBadgeClass}`}>
                      {roleName}
                    </span>
                  </div>
                  <span className={`app-user-caret ${isMenuOpen ? 'is-open' : ''}`}>▾</span>
                </button>

                {/* DROPDOWN MENU */}
                {isMenuOpen && (
                  <div className="app-user-dropdown-menu">
                    {/* Header: Thông tin chi tiết người dùng */}
                    <div className="app-dropdown-user-header">
                      <div className="app-dropdown-user-avatar">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="app-dropdown-user-info">
                        <strong className="app-dropdown-user-name">{displayName}</strong>
                        <span className="app-dropdown-user-email">
                          {user.email || user.user_metadata?.username || ''}
                        </span>
                        <div style={{ marginTop: '4px' }}>
                          <span className={`app-role-badge ${roleBadgeClass}`}>
                            {roleName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* DÀNH CHO HỌC SINH: THÔNG BÁO BÀI TẬP VÀ DANH SÁCH BÀI ĐƯỢC GIAO */}
                    {profile?.role === 'STUDENT' && (
                      <div className="app-dropdown-section">
                        <div className="app-dropdown-section-title">
                          <span>📚 Bài tập được giao</span>
                          {pendingCount > 0 ? (
                            <span className="app-dropdown-chip app-dropdown-chip--warn">
                              {pendingCount} cần làm
                            </span>
                          ) : (
                            <span className="app-dropdown-chip app-dropdown-chip--success">
                              Đã xong hết
                            </span>
                          )}
                        </div>

                        <div className="app-dropdown-tasks-scroll">
                          {loadingInternal ? (
                            <div className="app-dropdown-empty">Đang tải bài tập...</div>
                          ) : activeAssignments.length === 0 ? (
                            <div className="app-dropdown-empty">
                              <span>🎉 Chưa có bài tập nào được giao!</span>
                            </div>
                          ) : (
                            activeAssignments.map((item) => (
                              <Link
                                key={item.id}
                                to={`/tasks/${item.task_code}`}
                                className="app-dropdown-task-item"
                                onClick={() => setIsMenuOpen(false)}
                              >
                                <div className="app-dropdown-task-main">
                                  <div className="app-dropdown-task-code-row">
                                    <span className="app-dropdown-task-code">#{item.task_code}</span>
                                    <span className="app-dropdown-task-class">{item.class_name}</span>
                                  </div>
                                  <div className="app-dropdown-task-title">{item.title}</div>
                                  {item.due_date && (
                                    <div className="app-dropdown-task-due">
                                      ⏰ Hạn: {new Date(item.due_date).toLocaleDateString('vi-VN')}
                                    </div>
                                  )}
                                </div>
                                <div className="app-dropdown-task-status">
                                  {item.status === 'completed' ? (
                                    <span className="app-task-status-badge app-task-status-badge--done">
                                      {item.score !== null ? `${item.score}đ` : 'Đã xong'}
                                    </span>
                                  ) : (
                                    <span className="app-task-status-badge app-task-status-badge--todo">
                                      Làm ngay
                                    </span>
                                  )}
                                </div>
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* DÀNH CHO ADMIN: LỐI TẮT NHANH */}
                    {profile?.role === 'ADMIN' && (
                      <div className="app-dropdown-section">
                        <div className="app-dropdown-section-title">🛠️ Lối tắt Quản trị</div>
                        <Link
                          to="/admin"
                          className="app-dropdown-action-link"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span>📊</span>
                          <span>Trung Tâm Điều Hành Admin</span>
                        </Link>
                        <Link
                          to="/admin/studio"
                          className="app-dropdown-action-link"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span>✨</span>
                          <span>Soạn Bài Tập Mới (Studio)</span>
                        </Link>
                        <Link
                          to="/teacher"
                          className="app-dropdown-action-link"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span>🏫</span>
                          <span>Xem Cổng Giáo Viên</span>
                        </Link>
                      </div>
                    )}

                    {/* DÀNH CHO GIÁO VIÊN: LỐI TẮT NHANH */}
                    {profile?.role === 'TEACHER' && (
                      <div className="app-dropdown-section">
                        <div className="app-dropdown-section-title">🏫 Lối tắt Giáo viên</div>
                        <Link
                          to="/teacher"
                          className="app-dropdown-action-link"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span>📋</span>
                          <span>Cổng Giáo Viên & Bảng Điểm</span>
                        </Link>
                      </div>
                    )}

                    {/* FOOTER: ĐỔI MẬT KHẨU & NÚT ĐĂNG XUẤT CHO TẤT CẢ CÁC ROLE */}
                    <div className="app-dropdown-footer">
                      <Link
                        to="/forgot-password"
                        className="app-dropdown-footer-link"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        🔑 Đổi / Quên mật khẩu
                      </Link>

                      <button
                        type="button"
                        className="app-dropdown-logout-btn"
                        onClick={signOut}
                        title="Đăng xuất khỏi tài khoản"
                      >
                        <svg
                          className="logout-icon"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="app-nav-auth-buttons">
                <Link to="/login" className="app-btn-login">
                  Đăng nhập
                </Link>
                <Link to="/register" className="app-btn-register">
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* BANNER THÔNG BÁO CHẾ ĐỘ XEM THỬ NẾU LÀ ADMIN */}
      {isTestingStudentMode && profile?.role === 'ADMIN' && (
        <div className="app-banner-preview">
          <span>
            💡 Bạn đang xem thử giao diện <strong>Bàn Phím Học Sinh</strong> với vai trò{' '}
            <strong>Admin</strong>. Bạn có thể nhập mã 5 chữ số bất kỳ để trải nghiệm làm bài.
          </span>
          <button
            type="button"
            className="app-banner-preview-link"
            onClick={handleReturnFromPreview}
          >
            ← Quay lại Trung Tâm Admin
          </button>
        </div>
      )}
    </>
  )
}

