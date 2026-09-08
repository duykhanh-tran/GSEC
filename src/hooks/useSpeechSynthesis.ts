import { useCallback, useEffect } from 'react'

interface SpeechOptions {
  lang?: string
  rate?: number
  onEnd?: () => void
  onError?: () => void
}

export function useSpeechSynthesis() {
  const speak = useCallback((text: string, options: SpeechOptions = {}) => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      options.onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = options.lang ?? 'en-US'
    utterance.rate = options.rate ?? 0.92
    if (options.onEnd) utterance.onend = options.onEnd
    if (options.onError) utterance.onerror = options.onError
    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  return speak
}
