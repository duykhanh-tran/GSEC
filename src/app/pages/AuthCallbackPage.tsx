import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/auth.css'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    // Supabase tự động xử lý hash token trong URL và thiết lập session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError(error.message)
      } else if (session) {
        // Đăng nhập thành công, điều hướng về trang chủ
        navigate('/', { replace: true })
      } else {
        // Lắng nghe auth state change phòng khi token đang được xử lý ngầm
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            subscription.unsubscribe()
            navigate('/', { replace: true })
          }
        })

        // Timeout dự phòng sau 5 giây nếu không nhận được session
        const timer = setTimeout(() => {
          subscription.unsubscribe()
          navigate('/login', { replace: true })
        }, 5000)

        return () => clearTimeout(timer)
      }
    })
  }, [navigate])

  return (
    <main className="auth-container" style={{ textAlign: 'center', padding: '48px 24px' }}>
      {error ? (
        <div className="auth-message auth-message--error" role="alert">
          Lỗi xác thực: {error}
        </div>
      ) : (
        <>
          <div className="launcher-avatar" style={{ margin: '0 auto 16px' }}>
            AI
          </div>
          <h2>Đang xử lý đăng nhập...</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginTop: '8px' }}>
            Vui lòng chờ trong giây lát, hệ thống đang đồng bộ tài khoản của bạn.
          </p>
        </>
      )}
    </main>
  )
}
