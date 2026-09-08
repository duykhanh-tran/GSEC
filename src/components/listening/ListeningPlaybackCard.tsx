import { useState, type ReactNode } from 'react'

import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { ActionButton } from '../task/ActionButton'
import { TaskPanel } from '../task/TaskPanel'

interface ListeningPlaybackCardProps {
  title: string
  subtitle: string
  text: string
  prompt: ReactNode
  note?: ReactNode
  lang?: string
  rate?: number
  playLabel?: string
  replayLabel?: string
  statusText?: ReactNode
  onComplete?: () => void
}

export function ListeningPlaybackCard({ title, subtitle, text, prompt, note, lang = 'en-AU', rate = 0.9, playLabel = 'Play', replayLabel = 'Play again', statusText, onComplete }: ListeningPlaybackCardProps) {
  const [status, setStatus] = useState<'idle' | 'playing' | 'complete'>('idle')
  const speak = useSpeechSynthesis()

  const play = () => {
    if (status === 'playing') return
    setStatus('playing')
    const finishPlayback = () => {
      setStatus('complete')
      onComplete?.()
    }
    speak(text, {
      lang,
      rate,
      onEnd: finishPlayback,
      onError: finishPlayback,
    })
  }

  return (
    <TaskPanel className="listening-playback-card" title={title} subtitle={subtitle} data-stage="playback" data-playback-complete={status === 'complete' ? 'true' : 'false'}>
      <div className="listening-player">
        <div className="listening-player__top">
          <ActionButton className="listening-player__play" aria-label={status === 'playing' ? 'Playing' : status === 'complete' ? replayLabel : playLabel} disabled={status === 'playing'} onClick={play}>{status === 'playing' ? '■' : status === 'complete' ? '✓' : '▶'}</ActionButton>
          <div className="listening-player__meta"><strong>{prompt}</strong><span>{statusText ?? (status === 'playing' ? 'Playing…' : status === 'complete' ? 'Complete' : 'Ready')}</span></div>
        </div>
        <div className="listening-player__track" role="progressbar" aria-label="Listening progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status === 'idle' ? 0 : status === 'playing' ? 40 : 100}><i className={`listening-player__fill listening-player__fill--${status}`} /></div>
        {note ? <div className="listening-player__note">{note}</div> : null}
      </div>
    </TaskPanel>
  )
}
