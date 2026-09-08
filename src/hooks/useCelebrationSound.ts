import { useEffect, useRef } from 'react'

type AudioContextConstructor = new () => AudioContext

const NOTES = [
  { frequency: 523.25, start: 0, duration: 0.18 },
  { frequency: 659.25, start: 0.16, duration: 0.18 },
  { frequency: 783.99, start: 0.32, duration: 0.34 },
] as const

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  const audioWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return window.AudioContext ?? audioWindow.webkitAudioContext
}

export function useCelebrationSound(active: boolean) {
  const wasActive = useRef(false)

  useEffect(() => {
    const shouldPlay = active && !wasActive.current
    wasActive.current = active
    if (!shouldPlay) return

    const AudioContextClass = getAudioContextConstructor()
    if (!AudioContextClass) return

    let context: AudioContext
    try {
      context = new AudioContextClass()
    } catch {
      return
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }

    const startAt = context.currentTime + 0.03
    try {
      NOTES.forEach((note) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const noteStart = startAt + note.start
        const noteEnd = noteStart + note.duration

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(note.frequency, noteStart)
        gain.gain.setValueAtTime(0.0001, noteStart)
        gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(noteStart)
        oscillator.stop(noteEnd)
      })
    } catch {
      void context.close().catch(() => undefined)
      return
    }

    const closeTimer = window.setTimeout(() => {
      void context.close().catch(() => undefined)
    }, 900)

    return () => {
      window.clearTimeout(closeTimer)
      void context.close().catch(() => undefined)
    }
  }, [active])
}
