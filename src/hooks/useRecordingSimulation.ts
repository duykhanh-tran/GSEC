import { useCallback, useEffect, useRef, useState } from 'react'

type RecordingStatus = 'idle' | 'recording' | 'converting' | 'done'

interface RecordingSimulationOptions {
  recordingDurationMs?: number
  conversionDurationMs?: number
  tickMs?: number
}

export function useRecordingSimulation(onDone: () => void, options: RecordingSimulationOptions = {}) {
  const recordingDurationMs = options.recordingDurationMs ?? 1200
  const conversionDurationMs = options.conversionDurationMs ?? 500
  const tickMs = options.tickMs ?? 100
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<number | null>(null)
  const timeoutsRef = useRef<Set<number>>(new Set())
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    intervalRef.current = null
    timeoutsRef.current.forEach(window.clearTimeout)
    timeoutsRef.current.clear()
  }, [])

  const start = useCallback(() => {
    cleanup()
    setElapsed(0)
    setStatus('recording')
    intervalRef.current = window.setInterval(() => setElapsed((value) => value + tickMs / 1000), tickMs)
    const stopTimer = window.setTimeout(() => {
      timeoutsRef.current.delete(stopTimer)
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
      intervalRef.current = null
      setStatus('converting')
      const convertTimer = window.setTimeout(() => {
        timeoutsRef.current.delete(convertTimer)
        setStatus('done')
        onDoneRef.current()
      }, conversionDurationMs)
      timeoutsRef.current.add(convertTimer)
    }, recordingDurationMs)
    timeoutsRef.current.add(stopTimer)
  }, [cleanup, conversionDurationMs, recordingDurationMs, tickMs])

  const reset = useCallback(() => {
    cleanup()
    setElapsed(0)
    setStatus('idle')
  }, [cleanup])

  useEffect(() => cleanup, [cleanup])
  return { status, elapsed, start, reset }
}
