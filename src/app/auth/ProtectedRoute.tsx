import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="launcher-shell" style={{ textAlign: 'center', padding: '48px 24px', margin: '15vh auto' }}>
        <span className="launcher-avatar" aria-hidden="true">
          AI
        </span>
        <h2>Đang kiểm tra đăng nhập...</h2>
        <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginTop: '8px' }}>
          Vui lòng đợi trong giây lát...
        </p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
