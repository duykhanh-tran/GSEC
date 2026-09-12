import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * Tìm phần tử tin nhắn, thẻ bài tập, câu hỏi gợi ý hoặc thẻ hoàn thành mới nhất trong khung chat
 */
export function getLatestMessageElement(container: HTMLElement | null): HTMLElement | null {
  if (!container) return null

  // 1. Ưu tiên thẻ hoàn thành bài tập (completion actions card / summary card)
  const completionEl = container.querySelector<HTMLElement>(
    '.completion-actions-card, .task-panel.summary, [data-stage="task-completed-actions"]'
  )
  if (completionEl && (completionEl.offsetHeight > 0 || completionEl.getBoundingClientRect().height > 0)) {
    return completionEl
  }

  // 2. Ưu tiên thẻ sửa sai đang hoạt động (guided retry card)
  const activeRetry = container.querySelector<HTMLElement>(
    '.retry.is-active-guided, .guided-sentence-repair-card.is-active-guided, .retry[data-stage="retry"]'
  )
  if (activeRetry && (activeRetry.offsetHeight > 0 || activeRetry.getBoundingClientRect().height > 0)) {
    return activeRetry
  }

  // 3. Tìm các phần tử tin nhắn / câu hỏi / kết quả mới nhất theo thứ tự DOM
  const candidateSelectors = [
    '.completion-actions-card',
    '.task-panel.summary',
    '.guided-sentence-repair-card',
    '.retry',
    '.chat-row',
    '.tutor-bubble',
    '.chat-bubble',
    '.task-panel',
    '.result',
  ].join(', ')

  const allCandidates = container.querySelectorAll<HTMLElement>(candidateSelectors)
  for (let i = allCandidates.length - 1; i >= 0; i--) {
    const el = allCandidates[i]
    if (el.id?.includes('anchor') || el.classList?.contains('celebration-overlay')) continue
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
    if (el.offsetHeight > 10 || (rect && rect.height > 10)) {
      return el
    }
  }

  // 4. Nếu không có selector trên, duyệt từ dưới lên các con của .task-flow
  const flow = container.querySelector('.task-flow') || container
  const children = flow.children
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i] as HTMLElement
    if (
      child.id?.includes('anchor') ||
      child.classList?.contains('celebration-overlay') ||
      child.tagName === 'SCRIPT' ||
      child.tagName === 'STYLE'
    ) {
      continue
    }
    const rect = typeof child.getBoundingClientRect === 'function' ? child.getBoundingClientRect() : null
    if (child.offsetHeight > 10 || (rect && rect.height > 10)) {
      return child
    }
  }

  return null
}

/**
 * Cuộn khung chat hoặc window theo khoảng cách delta pixel mượt mà, không giật lắc
 */
function scrollByDelta(container: HTMLElement | null, delta: number) {
  if (Math.abs(delta) < 6) return

  const canContainerScroll = !!(container && (container.scrollHeight - container.clientHeight > 2))
  const canWindowScroll =
    typeof document !== 'undefined' &&
    ((document.documentElement?.scrollHeight || 0) - (window.innerHeight || 0) > 2 ||
      (document.body?.scrollHeight || 0) - (window.innerHeight || 0) > 2)

  if (canContainerScroll && container) {
    const maxScroll = container.scrollHeight - container.clientHeight
    const canScrollMore = delta > 0 ? container.scrollTop < maxScroll - 1 : container.scrollTop > 1
    if (canScrollMore && typeof container.scrollBy === 'function') {
      container.scrollBy({ top: delta, behavior: 'smooth' })
      return
    }
  }

  if (canWindowScroll && typeof window.scrollBy === 'function') {
    window.scrollBy({ top: delta, behavior: 'smooth' })
  }
}

export function useAutoScroll(changeKey: unknown): {
  chatRef: RefObject<HTMLElement | null>
  scrollToLatest: (element?: Element | null) => void
} {
  const chatRef = useRef<HTMLElement>(null)
  const timerRef = useRef<number | null>(null)
  const secondaryTimerRef = useRef<number | null>(null)

  const scrollToLatest = useCallback((element?: Element | null) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (secondaryTimerRef.current !== null) {
      window.clearTimeout(secondaryTimerRef.current)
      secondaryTimerRef.current = null
    }

    const doScroll = () => {
      const container = chatRef.current
      if (!container && !element) return

      // Xác định phần tử mục tiêu (tin nhắn / thẻ mới nhất)
      const target = (element as HTMLElement) || getLatestMessageElement(container)

      if (target && typeof target.getBoundingClientRect === 'function') {
        const targetRect = target.getBoundingClientRect()
        const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 800

        // Nếu trong môi trường thực tế có kích thước layout (height > 0 hoặc bottom > 0)
        if (targetRect.height > 0 || targetRect.bottom > 0) {
          // Đo chiều cao và vị trí của fixed footer ở đáy màn hình
          const footerEl = (document.querySelector('.status-footer') || document.querySelector('.footer')) as HTMLElement | null
          const footerRect = footerEl ? footerEl.getBoundingClientRect() : null
          const footerTop = footerRect && footerRect.top > 0 ? footerRect.top : (viewportHeight - 65)

          // Đo chiều cao của header ở đỉnh màn hình
          const headerEl = (document.querySelector('.topbar') || document.querySelector('header')) as HTMLElement | null
          const headerRect = headerEl ? headerEl.getBoundingClientRect() : null
          const headerBottom = headerRect && headerRect.bottom > 0 ? headerRect.bottom : 55

          // Khoảng cách lý tưởng từ mép dưới thẻ đến mép trên footer (~55px như hình minh hoạ người dùng cung cấp)
          const idealGapAboveFooter = 55
          const desiredBottom = footerTop - idealGapAboveFooter
          const desiredTop = headerBottom + 16

          let delta = 0
          if (targetRect.height > (desiredBottom - desiredTop)) {
            // Thẻ quá dài so with màn hình -> căn đỉnh thẻ dưới header để học sinh đọc từ trên xuống
            delta = targetRect.top - desiredTop
          } else {
            // Thẻ vừa vặn -> căn đáy thẻ cách mép trên footer đúng khoảng cách lý tưởng (~55px)
            delta = targetRect.bottom - desiredBottom
          }

          scrollByDelta(container, delta)
          return
        }

        // Môi trường test JSDOM hoặc khi chưa có kích thước layout
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'end' })
          return
        }
      }

      // Dự phòng: Tìm neo đáy (bottom anchor) của khung chat
      const anchor =
        container?.querySelector('#chat-bottom-anchor') ||
        container?.querySelector('#app-shell-bottom-anchor')

      if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
        return
      }

      // Dự phòng cuối: Cuộn toàn bộ container và document xuống sát đáy
      const docHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0,
        container ? container.scrollHeight : 0
      )

      if (typeof window.scrollTo === 'function') {
        window.scrollTo({
          top: docHeight + 300,
          behavior: 'smooth',
        })
      }
      if (container && container.scrollHeight > container.clientHeight && typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: container.scrollHeight + 300,
          behavior: 'smooth',
        })
      }
    }

    // Debounce ngắn 40ms để DOM vẽ xong tin nhắn mới trước khi trượt xuống
    timerRef.current = window.setTimeout(doScroll, 40)
    // Tinh chỉnh bổ sung sau 180ms để đảm bảo hình ảnh hoặc font đã nạp xong (chỉ cuộn nếu delta >= 6px)
    secondaryTimerRef.current = window.setTimeout(doScroll, 180)
  }, [])

  // Hook 5: Tự động cuộn khi changeKey thay đổi (chuyển câu hỏi, đổi giai đoạn, hoàn thành)
  useEffect(() => {
    scrollToLatest()
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (secondaryTimerRef.current !== null) {
        window.clearTimeout(secondaryTimerRef.current)
        secondaryTimerRef.current = null
      }
    }
  }, [changeKey, scrollToLatest])

  // Hook 6: Lắng nghe DOM (MutationObserver) để tự động trượt xuống tin nhắn/thông báo mới nhất mà không cần người dùng dùng tay lướt
  useEffect(() => {
    const container = chatRef.current
    if (!container) return

    let debounceTimeout: number | null = null
    const observer = new MutationObserver((mutations) => {
      // Chỉ kích hoạt cuộn khi có nội dung tin nhắn/thẻ mới được thêm vào DOM
      const hasNewMessage = mutations.some((m) => {
        if (!m.addedNodes || m.addedNodes.length === 0) return false
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i]
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            if (
              el.classList?.contains('chat-bubble') ||
              el.classList?.contains('tutor-bubble') ||
              el.classList?.contains('chat-row') ||
              el.classList?.contains('retry') ||
              el.classList?.contains('task-panel') ||
              el.classList?.contains('completion-actions-card') ||
              el.classList?.contains('result') ||
              el.querySelector?.(
                '.chat-bubble, .tutor-bubble, .chat-row, .retry, .task-panel, .completion-actions-card'
              )
            ) {
              return true
            }
          }
        }
        return false
      })

      if (hasNewMessage) {
        if (debounceTimeout !== null) window.clearTimeout(debounceTimeout)
        debounceTimeout = window.setTimeout(() => {
          scrollToLatest()
        }, 50)
      }
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
    })

    return () => {
      if (debounceTimeout !== null) window.clearTimeout(debounceTimeout)
      observer.disconnect()
    }
  }, [scrollToLatest])

  return { chatRef, scrollToLatest }
}
