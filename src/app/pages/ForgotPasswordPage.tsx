import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/auth.css'

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successInfo, setSuccessInfo] = useState<{
    type: 'email' | 'student_internal'
    email?: string
    studentName?: string
    username?: string
  } | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessInfo(null)

    const trimmed = input.trim()
    if (!trimmed) {
      setErrorMessage('Vui lòng nhập Email hoặc Tên đăng nhập của bạn.')
      return
    }

    setLoading(true)

    try {
      // TRƯỜNG HỢP 1: Người dùng nhập địa chỉ Email thật
      if (trimmed.includes('@')) {
        if (trimmed.toLowerCase().endsWith('@student.gsec.internal')) {
          const uName = trimmed.split('@')[0]
          setSuccessInfo({
            type: 'student_internal',
            username: uName,
          })
          setLoading(false)
          return
        }

        const { error } = await resetPasswordForEmail(trimmed)
        setLoading(false)

        if (error) {
          setErrorMessage(
            error.message.includes('rate limit')
              ? 'Bạn đã yêu cầu gửi email quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.'
              : `Lỗi gửi email: ${error.message}`
          )
        } else {
          setSuccessInfo({
            type: 'email',
            email: trimmed,
          })
        }
        return
      }

      // TRƯỜNG HỢP 2: Người dùng nhập Tên đăng nhập (Username)
      const cleanUsername = trimmed.toLowerCase()

      // Tra cứu profile trong CSDL
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('username', cleanUsername)
        .maybeSingle()

      if (pError || !profile) {
        // Fallback: Thử tra cứu bằng RPC get_email_by_username nếu có
        let fallbackFound = false
        try {
          const { data: foundEmail } = await supabase.rpc('get_email_by_username', {
            p_username: cleanUsername,
          })
          if (foundEmail && !foundEmail.endsWith('@student.gsec.internal')) {
            const { error: resetErr } = await resetPasswordForEmail(foundEmail)
            if (!resetErr) {
              setSuccessInfo({
                type: 'email',
                email: foundEmail,
              })
              fallbackFound = true
            }
          }
        } catch {
          // RPC không khả dụng
        }

        if (!fallbackFound) {
          // Giả định là tài khoản học sinh lớp học
          setSuccessInfo({
            type: 'student_internal',
            username: cleanUsername,
          })
        }
        setLoading(false)
        return
      }

      // Nếu tài khoản có email thật (Giáo viên, Admin hoặc Học sinh đăng ký bằng email thật)
      if (profile.email && !profile.email.endsWith('@student.gsec.internal')) {
        const { error: resetErr } = await resetPasswordForEmail(profile.email)
        setLoading(false)
        if (resetErr) {
          setErrorMessage(`Lỗi gửi email khôi phục: ${resetErr.message}`)
        } else {
          setSuccessInfo({
            type: 'email',
            email: profile.email,
          })
        }
      } else {
        // Tài khoản học sinh nội bộ
        setLoading(false)
        setSuccessInfo({
          type: 'student_internal',
          studentName: profile.full_name,
          username: cleanUsername,
        })
      }
    } catch (err: any) {
      setLoading(false)
      setErrorMessage(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại sau.')
    }
  }

  return (
    <main className="auth-container">
      <div className="auth-header">
        <h1>Khôi Phục Mật Khẩu</h1>
        <p>Nhập địa chỉ Email hoặc Tên đăng nhập để nhận hướng dẫn lấy lại mật khẩu.</p>
      </div>

      {errorMessage && (
        <div className="auth-message auth-message--error" style={{ marginBottom: '16px' }}>
          {errorMessage}
        </div>
      )}

      {successInfo?.type === 'email' && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📬</div>
          <h3 style={{ margin: '0 0 8px', color: '#065f46', fontSize: '18px' }}>
            Đã gửi liên kết khôi phục!
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#047857', lineHeight: 1.5 }}>
            Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến địa chỉ email:
            <br />
            <strong>{successInfo.email}</strong>
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#059669', fontStyle: 'italic' }}>
            Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam/Thư rác) và bấm vào liên kết để tạo mật khẩu mới.
          </p>
        </div>
      )}

      {successInfo?.type === 'student_internal' && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #93c5fd',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px' }}>🎓</span>
            <h3 style={{ margin: 0, color: '#1e40af', fontSize: '16px' }}>
              Tài Khoản Học Sinh Lớp Học Nội Bộ
            </h3>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#1e3a8a', lineHeight: 1.5 }}>
            Tài khoản{' '}
            <strong>
              {successInfo.studentName ? `${successInfo.studentName} (${successInfo.username})` : successInfo.username}
            </strong>{' '}
            là tài khoản nội bộ do Nhà trường và Giáo viên phụ trách lớp quản lý trực tiếp.
          </p>
          <div
            style={{
              background: '#ffffff',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              fontSize: '13px',
              color: '#334155',
            }}
          >
            <p style={{ margin: '0 0 6px' }}>
              🔑 <strong>Mật khẩu mặc định ban đầu:</strong> <code style={{ color: '#d97706', fontWeight: 700 }}>123456</code>
            </p>
            <p style={{ margin: 0 }}>
              📞 <strong>Nếu đã đổi mật khẩu và quên:</strong> Bạn hãy thông báo cho Giáo viên phụ trách lớp để được cấp lại mật khẩu mới.
            </p>
          </div>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="forgot-input">Email hoặc Tên đăng nhập</label>
          <input
            id="forgot-input"
            type="text"
            className="form-input"
            required
            autoComplete="username"
            placeholder="vd: hocsinh@gmail.com hoặc an.6a1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Đang kiểm tra & gửi yêu cầu...' : 'Gửi Yêu Cầu Khôi Phục'}
        </button>
      </form>

      <div className="auth-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <Link to="/login" style={{ textDecoration: 'none', color: '#6366f1', fontWeight: 600, fontSize: '13.5px' }}>
          ← Quay lại Đăng nhập
        </Link>
        <Link to="/register" style={{ textDecoration: 'none', color: '#6366f1', fontWeight: 600, fontSize: '13.5px' }}>
          Đăng ký tài khoản mới
        </Link>
      </div>
    </main>
  )
}
