import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/auth.css'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const rawFrom = (location.state as any)?.from
  const from = (typeof rawFrom === 'string' ? rawFrom : rawFrom?.pathname) || '/student'
  const { signInWithGoogle, signInWithFacebook, signInWithPassword, user, profile } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Nếu đã đăng nhập, chuyển về trang phù hợp với vai trò
  useEffect(() => {
    if (user && profile) {
      if (from && from !== '/' && from !== '/student') {
        navigate(from, { replace: true })
      } else if (profile.role === 'ADMIN') {
        navigate('/admin', { replace: true })
      } else if (profile.role === 'TEACHER') {
        navigate('/teacher', { replace: true })
      } else {
        navigate('/student', { replace: true })
      }
    }
  }, [user, profile, navigate, from])

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signInWithPassword(email, password)
    setLoading(false)

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email hoặc mật khẩu không chính xác.'
        : error.message)
    } else {
      // Chuyển ngay trang theo role người dùng
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle()

      if (from && from !== '/' && from !== '/student') {
        navigate(from, { replace: true })
      } else if (prof?.role === 'ADMIN') {
        navigate('/admin', { replace: true })
      } else if (prof?.role === 'TEACHER') {
        navigate('/teacher', { replace: true })
      } else {
        navigate('/student', { replace: true })
      }
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleFacebookLogin = async () => {
    setError('')
    setLoading(true)
    const { error } = await signInWithFacebook()
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <main className="auth-container">
      <div className="auth-header">
        <h1>Đăng nhập AI Tutor</h1>
        <p>Chọn phương thức đăng nhập để tiếp tục</p>
      </div>

      {error ? (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      ) : null}

      {(location.state as any)?.message && !error ? (
        <div className="auth-message auth-message--success" role="status">
          {(location.state as any).message}
        </div>
      ) : null}

      <div className="auth-social-group">
        <button
          type="button"
          className="btn-social btn-social--google"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Đăng nhập bằng Google
        </button>

        <button
          type="button"
          className="btn-social btn-social--facebook"
          onClick={handleFacebookLogin}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Đăng nhập bằng Facebook
        </button>
      </div>

      <div className="auth-divider">
        <span>HOẶC EMAIL</span>
      </div>

      <form className="auth-form" onSubmit={handleEmailLogin}>
        <div className="form-group">
          <label htmlFor="login-email">Email hoặc Tên đăng nhập</label>
          <input
            id="login-email"
            type="text"
            className="form-input"
            required
            autoComplete="username"
            placeholder="vd: an.6a1 hoặc hocsinh@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label htmlFor="login-password" style={{ margin: 0 }}>Mật khẩu</label>
            <Link
              to="/forgot-password"
              style={{
                fontSize: '12.5px',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Quên mật khẩu?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            className="form-input"
            required
            autoComplete="current-password"
            placeholder="Nhập mật khẩu..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>

      </div>
    </main>
  )
}
