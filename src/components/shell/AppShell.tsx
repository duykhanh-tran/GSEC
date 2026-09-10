import { useEffect, useRef, useCallback, type ReactNode, type RefObject } from 'react'

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
  chatRef: externalChatRef,
}: AppShellProps) {
  const internalChatRef = useRef<HTMLElement>(null)
  const bottomAnchorRef = useRef<HTMLDivElement>(null)
  const mainRef = externalChatRef || internalChatRef

  const scrollToBottom = useCallback(() => {
    const container = mainRef.current

    // 1. Cuộn toàn bộ cửa sổ Window / Document chạm đáy trang
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.offsetHeight,
      document.body.offsetHeight,
      container ? container.scrollHeight : 0
    )
    window.scrollTo({
      top: docHeight + 350,
      behavior: 'smooth',
    })

    // 2. Cuộn container nếu nó có thanh cuộn riêng
    if (container && container.scrollHeight > container.clientHeight) {
      container.scrollTo({
        top: container.scrollHeight + 350,
        behavior: 'smooth',
      })
    }

    // 3. Cuộn phần tử neo đáy vào tầm nhìn
    if (bottomAnchorRef.current && typeof bottomAnchorRef.current.scrollIntoView === 'function') {
      bottomAnchorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }
  }, [mainRef])

  // Tự động cuộn khi children thay đổi (mở bài tập, đổi phase...)
  useEffect(() => {
    scrollToBottom()
    const t1 = setTimeout(scrollToBottom, 50)
    const t2 = setTimeout(scrollToBottom, 180)
    const t3 = setTimeout(scrollToBottom, 350)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [children, scrollToBottom])

  // Lắng nghe MutationObserver trên container chat của TẤT CẢ các bài tập:
  // Bất cứ khi nào có tin nhắn mới, hint mới, thẻ retry hoặc kết quả mới xuất hiện:
  // Tự động cuộn xuống dưới cùng để trải nghiệm hội thoại tự nhiên như 2 người chat!
  useEffect(() => {
    const container = mainRef.current
    if (!container) return

    let debounceTimeout: number | null = null
    const observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
      if (!hasAddedNodes) return

      if (debounceTimeout !== null) window.clearTimeout(debounceTimeout)
      debounceTimeout = window.setTimeout(() => {
        scrollToBottom()
        window.setTimeout(scrollToBottom, 150)
        window.setTimeout(scrollToBottom, 350)
      }, 30)
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
    })

    return () => {
      if (debounceTimeout !== null) window.clearTimeout(debounceTimeout)
      observer.disconnect()
    }
  }, [mainRef, scrollToBottom])

  return (
    <section
      className={`task task-foundation ${className}`.trim()}
      data-react-foundation="foundation-1"
      data-task={taskCode}
      data-module-ready={moduleReady ? 'true' : undefined}
    >
      <div className="app">
        {header}
        <main ref={mainRef} className="chat" id="chat">
          {children}
          {/* Neo đáy chung cho tất cả các bài tập để luôn cuộn chuẩn xác */}
          <div ref={bottomAnchorRef} id="app-shell-bottom-anchor" style={{ height: '1px', width: '100%', pointerEvents: 'none' }} />
        </main>
        {footer}
      </div>
    </section>
  )
}
