import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/auth.css'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // 1. Kiểm tra session hiện tại hoặc lắng nghe sự kiện PASSWORD_RECOVERY
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsRecoverySession(true)
      }
      setCheckingSession(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsRecoverySession(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (password.length < 6) {
      setErrorMessage('Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Xác nhận mật khẩu không khớp. Vui lòng nhập lại.')
      return
    }

    setLoading(true)

    try {
      const { error } = await updatePassword(password)
      setLoading(false)

      if (error) {
        setErrorMessage(`Lỗi cập nhật mật khẩu: ${error.message}`)
      } else {
        setSuccessMessage('Đặt lại mật khẩu thành công! Đang chuyển hướng về trang Đăng nhập...')
        setTimeout(() => {
          navigate('/login', {
            state: { message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.' },
          })
        }, 2000)
      }
    } catch (err: any) {
      setLoading(false)
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi cập nhật mật khẩu.')
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-container" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <p style={{ color: 'var(--color-muted)', fontSize: '15px' }}>Đang xác thực liên kết khôi phục...</p>
      </main>
    )
  }

  return (
    <main className="auth-container">
      <div className="auth-header">
        <h1>Đặt Lại Mật Khẩu Mới</h1>
        <p>Vui lòng nhập mật khẩu mới để bảo mật tài khoản của bạn.</p>
      </div>

      {errorMessage && (
        <div className="auth-message auth-message--error" style={{ marginBottom: '16px' }}>
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="auth-message auth-message--success" style={{ marginBottom: '16px' }}>
          {successMessage}
        </div>
      )}

      {!isRecoverySession && !successMessage && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#b45309',
            lineHeight: 1.5,
          }}
        >
          ⚠️ <strong>Lưu ý:</strong> Liên kết đặt lại mật khẩu của bạn có thể đã hết hạn hoặc chưa được mở từ email khôi phục. Nếu không cập nhật được, bạn hãy yêu cầu gửi lại liên kết mới.
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="new-password">Mật khẩu mới</label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366f1',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          <input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
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
          <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            required
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Đang cập nhật mật khẩu...' : 'Cập Nhật Mật Khẩu'}
        </button>
      </form>

      <div className="auth-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <Link to="/forgot-password" style={{ textDecoration: 'none', color: '#6366f1', fontWeight: 600, fontSize: '13.5px' }}>
          Gửi lại yêu cầu khôi phục
        </Link>
        <Link to="/login" style={{ textDecoration: 'none', color: '#6366f1', fontWeight: 600, fontSize: '13.5px' }}>
          ← Về trang Đăng nhập
        </Link>
      </div>
    </main>
  )
}
