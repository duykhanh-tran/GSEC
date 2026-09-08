import { useCallback, useEffect, useRef } from 'react'

export function useTaskTimers() {
  const timers = useRef<Set<number>>(new Set())

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      callback()
    }, delay)
    timers.current.add(timer)
    return timer
  }, [])

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout)
    timers.current.clear()
  }, [])

  return schedule
}
