import type { ReactNode, RefObject } from 'react'

interface AppShellProps {
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  taskCode?: string
  moduleReady?: boolean
  chatRef?: RefObject<HTMLElement | null>
}

export function AppShell({
  header,
  footer,
  children,
  className = '',
  taskCode,
  moduleReady = false,
  chatRef,
}: AppShellProps) {
  return (
    <section
      className={`task task-foundation ${className}`.trim()}
      data-react-foundation="foundation-1"
      data-task={taskCode}
      data-module-ready={moduleReady ? 'true' : undefined}
    >
      <div className="app">
        {header}
        <main ref={chatRef} className="chat" id="chat">
          {children}
          {/* Neo đáy chung cho tất cả các bài tập để cuộn chuẩn xác khi cần */}
          <div id="app-shell-bottom-anchor" style={{ height: '1px', width: '100%', pointerEvents: 'none' }} />
        </main>
        {footer}
      </div>
    </section>
  )
}

