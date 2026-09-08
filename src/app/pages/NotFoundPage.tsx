import { Link } from 'react-router-dom'

interface NotFoundPageProps {
  requestedCode?: string
}

export function NotFoundPage({ requestedCode }: NotFoundPageProps) {
  return (
    <main className="app-error">
      <h1>Không tìm thấy trang</h1>
      {requestedCode ? <p>Không tìm thấy task có mã {requestedCode}.</p> : null}
      <Link to="/">Quay về trang đầu</Link>
    </main>
  )
}
