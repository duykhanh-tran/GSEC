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
        </main>
        {footer}
      </div>
    </section>
  )
}
