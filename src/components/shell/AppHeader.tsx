import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import '../../styles/app-header.css'

export interface AppHeaderProps {
  currentPortal?: 'student' | 'teacher' | 'admin'
  isTestingStudentMode?: boolean
}

export function AppHeader({ currentPortal = 'student', isTestingStudentMode }: AppHeaderProps) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

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

  const handleReturnFromPreview = () => {
    if (profile?.role === 'ADMIN') {
      navigate('/admin')
    } else if (profile?.role === 'TEACHER') {
      navigate('/teacher')
    }
  }

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

          {/* 2. CỤM CHUYỂN ĐỔI PHÂN HỆ (Segmented Control khoa học, chống vỡ dòng) */}
          {user && (
            <nav className="app-nav-portals" aria-label="Chuyển đổi phân hệ">
              {profile?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className={`app-portal-tab ${currentPortal === 'admin' ? 'is-active' : ''}`}
                >
                  <span className="tab-icon">🛠️</span>
                  <span>Quản Trị Admin</span>
                </Link>
              )}

              {isTeacherOrAdmin && (
                <Link
                  to="/teacher"
                  className={`app-portal-tab ${currentPortal === 'teacher' ? 'is-active' : ''}`}
                >
                  <span className="tab-icon">🏫</span>
                  <span>Cổng Giáo Viên</span>
                </Link>
              )}

              <Link
                to="/?mode=student"
                className={`app-portal-tab ${currentPortal === 'student' ? 'is-active' : ''}`}
              >
                <span className="tab-icon">🎒</span>
                <span>Bàn Phím Học Sinh</span>
              </Link>
            </nav>
          )}

          {/* 3. THÔNG TIN NGƯỜI DÙNG & THAO TÁC TÀI KHOẢN */}
          <div className="app-nav-user">
            {user ? (
              <>
                <div className="app-user-card">
                  <div className="app-user-avatar">
                    {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                      <img
                        src={profile?.avatar_url || user.user_metadata?.avatar_url}
                        alt={displayName}
                      />
                    ) : (
                      displayName.charAt(0).toUpperCase()
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
                </div>

                <button
                  type="button"
                  className="app-btn-logout"
                  onClick={signOut}
                  title="Đăng xuất khỏi tài khoản"
                >
                  <svg
                    className="logout-icon"
                    width="14"
                    height="14"
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
              </>
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

      {/* BANNER THÔNG BÁO CHẾ ĐỘ XEM THỬ NẾU LÀ ADMIN / GIÁO VIÊN */}
      {isTestingStudentMode && isTeacherOrAdmin && (
        <div className="app-banner-preview">
          <span>
            💡 Bạn đang xem thử giao diện <strong>Bàn Phím Học Sinh</strong> với vai trò{' '}
            <strong>{roleName}</strong>. Bạn có thể nhập mã 5 chữ số bất kỳ để trải nghiệm làm bài.
          </span>
          <button
            type="button"
            className="app-banner-preview-link"
            onClick={handleReturnFromPreview}
          >
            ← Quay lại {profile?.role === 'ADMIN' ? 'Trung Tâm Admin' : 'Cổng Giáo Viên'}
          </button>
        </div>
      )}
    </>
  )
}
