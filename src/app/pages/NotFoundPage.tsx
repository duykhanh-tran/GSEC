import { Link, useLocation, Navigate } from 'react-router-dom'

interface NotFoundPageProps {
  requestedCode?: string
}

export function NotFoundPage({ requestedCode }: NotFoundPageProps) {
  const location = useLocation()
  const pathPart = location.pathname.replace(/^\/+/, '').trim()

  // Tự động chuyển hướng nếu người dùng truy cập trực tiếp /60175 thay vì /tasks/60175
  if (/^\d{4,6}$/.test(pathPart)) {
    return <Navigate to={`/tasks/${pathPart}`} replace />
  }

  return (
    <main className="app-error">
      <h1>Không tìm thấy trang</h1>
      {requestedCode ? <p>Không tìm thấy task có mã {requestedCode}.</p> : null}
      <Link to="/">Quay về trang đầu</Link>
    </main>
  )
}
