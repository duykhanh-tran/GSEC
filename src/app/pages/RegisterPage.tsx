import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../auth'
import '../../styles/auth.css'

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
  const { signInWithGoogle, signInWithFacebook, signUpWithEmail, user } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('STUDENT')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Nếu đã đăng nhập, chuyển về trang đích hoặc trang chủ
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
  }, [user, navigate, from])

  const handleEmailRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    setLoading(true)
    const { error, needsEmailConfirmation } = await signUpWithEmail(email, password, fullName, role)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (needsEmailConfirmation) {
      setSuccess('Đăng ký thành công! Vui lòng kiểm tra hộp thư email để kích hoạt tài khoản.')
    } else {
      navigate(from, { replace: true })
    }
  }

  const handleGoogleSignup = async () => {
    setError('')
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleFacebookSignup = async () => {
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
        <h1>Tạo tài khoản mới</h1>
        <p>Tham gia hệ thống AI Tutor GSEC 6</p>
      </div>

      {error ? (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="auth-message auth-message--success" role="status">
          {success}
        </div>
      ) : null}

      <div className="auth-social-group">
        <button
          type="button"
          className="btn-social btn-social--google"
          onClick={handleGoogleSignup}
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
          Đăng ký nhanh với Google
        </button>

        <button
          type="button"
          className="btn-social btn-social--facebook"
          onClick={handleFacebookSignup}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Đăng ký nhanh với Facebook
        </button>
      </div>

      <div className="auth-divider">
        <span>HOẶC ĐIỀN FORM</span>
      </div>

      <form className="auth-form" onSubmit={handleEmailRegister}>
        <div className="form-group">
          <label htmlFor="reg-name">Họ và tên</label>
          <input
            id="reg-name"
            type="text"
            className="form-input"
            required
            placeholder="vd: Nguyễn Văn A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-email">Địa chỉ Email</label>
          <input
            id="reg-email"
            type="email"
            className="form-input"
            required
            autoComplete="email"
            placeholder="vd: hocsinh@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-password">Mật khẩu</label>
          <input
            id="reg-password"
            type="password"
            className="form-input"
            required
            autoComplete="new-password"
            placeholder="Tối thiểu 6 ký tự..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Vai trò của bạn</label>
          <div className="role-selector">
            <button
              type="button"
              className={`role-option ${role === 'STUDENT' ? 'is-selected' : ''}`}
              onClick={() => setRole('STUDENT')}
            >
              Học sinh
            </button>
            <button
              type="button"
              className={`role-option ${role === 'TEACHER' ? 'is-selected' : ''}`}
              onClick={() => setRole('TEACHER')}
            >
              Giáo viên
            </button>
          </div>
        </div>

        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>

      </div>
    </main>
  )
}
