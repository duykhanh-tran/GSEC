import { useCallback, useEffect, useRef, type RefObject } from 'react'

export function useAutoScroll(changeKey: unknown): {
  chatRef: RefObject<HTMLElement | null>
  scrollToLatest: (element?: Element | null) => void
} {
  const chatRef = useRef<HTMLElement>(null)
  const timerRef = useRef<number | null>(null)

  const scrollToLatest = useCallback((element?: Element | null) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    const target = element ?? chatRef.current?.lastElementChild
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (typeof target?.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }, 60)
  }, [])

  useEffect(() => {
    scrollToLatest()
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [changeKey, scrollToLatest])

  return { chatRef, scrollToLatest }
}
