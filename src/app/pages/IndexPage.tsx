import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { getTaskPath, normalizeTaskCode } from '../registry'
import { InlineCodeKeypad } from '../../components/keypad/InlineCodeKeypad'

export function IndexPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedCode = normalizeTaskCode(searchParams.get('page'))
  const requestedPath = requestedCode ? getTaskPath(requestedCode) : null

  useEffect(() => {
    document.title = 'AI Tutor · WS 1'
  }, [])

  if (requestedPath) {
    return <Navigate replace to={requestedPath} />
  }

  return (
    <main className="launcher-shell">
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
  )
}
