import { useCallback, useState } from 'react'

export function useRetryQueue<ItemId extends string | number>() {
  const [queue, setQueue] = useState<readonly ItemId[]>([])
  const [attempt, setAttempt] = useState(1)

  const start = useCallback((items: readonly ItemId[]) => {
    setQueue([...items])
    setAttempt(1)
  }, [])

  const nextAttempt = useCallback(() => setAttempt((value) => value + 1), [])
  const resolveCurrent = useCallback(() => {
    setQueue((items) => items.slice(1))
    setAttempt(1)
  }, [])
  const reset = useCallback(() => {
    setQueue([])
    setAttempt(1)
  }, [])

  return { queue, current: queue[0] ?? null, attempt, start, nextAttempt, resolveCurrent, reset }
}
