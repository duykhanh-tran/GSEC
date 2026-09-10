import { useCallback, useEffect, useRef, type RefObject } from 'react'

export function useAutoScroll(changeKey: unknown): {
  chatRef: RefObject<HTMLElement | null>
  scrollToLatest: (element?: Element | null) => void
} {
  const chatRef = useRef<HTMLElement>(null)
  const timerRef = useRef<number | null>(null)
  const secondaryTimerRef = useRef<number | null>(null)

  const scrollToLatest = useCallback((element?: Element | null) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (secondaryTimerRef.current !== null) window.clearTimeout(secondaryTimerRef.current)

    const doScroll = () => {
      const container = chatRef.current

      // 1. Cuộn toàn bộ Window / Document xuống sát đáy cùng
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
        container ? container.scrollHeight : 0
      )
      window.scrollTo({
        top: docHeight + 300,
        behavior: 'smooth',
      })

      // 2. Cuộn container nếu nó có thanh cuộn riêng
      if (container && container.scrollHeight > container.clientHeight) {
        container.scrollTo({
          top: container.scrollHeight + 300,
          behavior: 'smooth',
        })
      }

      // 3. Tìm phần tử neo đáy hoặc phần tử mới nhất để cuộn vào tầm nhìn
      const anchor = container?.querySelector('#chat-bottom-anchor')
      if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
      } else {
        const target =
          element ??
          container?.querySelector('.retry') ??
          container?.querySelector('.task-flow > :last-child') ??
          container?.lastElementChild

        if (target && typeof target.scrollIntoView === 'function') {
          // Dùng block: 'center' thay vì 'end' để nội dung nằm gọn ở giữa tầm mắt, không bị footer cố định che
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        }
      }
    }

    // Tick 1: Sau 50ms (DOM cập nhật)
    timerRef.current = window.setTimeout(doScroll, 50)
    // Tick 2: Sau 180ms (khi thẻ animation mở ra hoàn tất)
    secondaryTimerRef.current = window.setTimeout(doScroll, 180)
    // Tick 3: Sau 350ms (bảo đảm 100% khi có ảnh/âm thanh phình layout)
    window.setTimeout(doScroll, 350)
  }, [])

  // Tự động cuộn khi changeKey thay đổi
  useEffect(() => {
    scrollToLatest()
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (secondaryTimerRef.current !== null) window.clearTimeout(secondaryTimerRef.current)
      timerRef.current = null
      secondaryTimerRef.current = null
    }
  }, [changeKey, scrollToLatest])

  // Lắng nghe thay đổi DOM (MutationObserver) để tự động bám theo tin mới nhất khi có tin trả ra
  useEffect(() => {
    const container = chatRef.current
    if (!container) return

    let debounceTimeout: number | null = null
    const observer = new MutationObserver(() => {
      if (debounceTimeout !== null) window.clearTimeout(debounceTimeout)
      debounceTimeout = window.setTimeout(() => {
        scrollToLatest()
      }, 50)
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
