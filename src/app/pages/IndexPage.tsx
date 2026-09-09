import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { getTaskPath, normalizeTaskCode } from '../registry'
import { useAuth } from '../auth'
import { InlineCodeKeypad } from '../../components/keypad/InlineCodeKeypad'
import '../../styles/auth.css'

export function IndexPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const requestedCode = normalizeTaskCode(searchParams.get('page'))
  const requestedPath = requestedCode ? getTaskPath(requestedCode) : null

  useEffect(() => {
    document.title = 'AI Tutor · WS 1'
  }, [])

  if (requestedPath) {
    return <Navigate replace to={requestedPath} />
  }

  const roleLabel = profile?.role === 'ADMIN' ? 'Admin' : profile?.role === 'TEACHER' ? 'Giáo viên' : 'Học sinh'
  const roleClass = profile?.role === 'ADMIN' ? 'user-badge--admin' : profile?.role === 'TEACHER' ? 'user-badge--teacher' : 'user-badge--student'
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Người dùng'

  return (
    <>
      <header className="user-bar">
        {user ? (
          <>
            <div className="user-bar-profile">
              <div className="user-avatar-small">
                {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                  <img src={profile?.avatar_url || user.user_metadata?.avatar_url} alt={displayName} />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="user-meta-name">{displayName}</div>
                <span className={`user-badge ${roleClass}`}>{roleLabel}</span>
              </div>
            </div>
            <button type="button" className="btn-signout" onClick={signOut}>
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600 }}>
              Khách chưa đăng nhập
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/login" className="btn-auth-link btn-auth-link--primary">
                Đăng nhập
              </Link>
              <Link to="/register" className="btn-auth-link btn-auth-link--secondary">
                Đăng ký
              </Link>
            </div>
          </>
        )}
      </header>

      <main className="launcher-shell" style={{ marginTop: '24px' }}>
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
    </>
  )
}
