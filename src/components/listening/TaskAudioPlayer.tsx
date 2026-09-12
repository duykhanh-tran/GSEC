import React, { useState, useRef, useEffect, useMemo } from 'react'
import { StatusTag } from '../task/StatusTag'
import { getOptimizedAudioSrc } from '../../lib/taskCacheService'

interface TaskAudioPlayerProps {
  src: string
  title?: string
  requiredListens?: number
  listenCount: number
  onListenComplete: (newCount: number) => void
  disabled?: boolean
  hasStartedWorksheet?: boolean
  onStartWorksheet?: () => void
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function TaskAudioPlayer({
  src,
  title = 'Listening Track',
  requiredListens = 1,
  listenCount,
  onListenComplete,
  hasStartedWorksheet = false,
  onStartWorksheet,
}: TaskAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const optimizedSrc = useMemo(() => getOptimizedAudioSrc(src), [src])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hasError, setHasError] = useState(false)

  const isUnlocked = listenCount >= requiredListens

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setHasError(false)
    }
    const handleEnded = () => {
      setIsPlaying(false)
      onListenComplete(listenCount + 1)
    }
    const handleError = () => {
      setHasError(true)
      setIsPlaying(false)
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [listenCount, onListenComplete])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch((err) => {
        console.warn('Audio play prevented:', err)
      })
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pos * duration
  }

  const handleReplay = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => undefined)
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="task-audio-player card"
      style={{
        padding: '16px 18px',
        background: isUnlocked
          ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)'
          : 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
        border: `1.5px solid ${isUnlocked ? '#bbf7d0' : '#fed7aa'}`,
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <audio ref={audioRef} src={optimizedSrc} preload="metadata" />

      {/* Header: Title & Listen Count Tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: isUnlocked ? '#dcfce7' : '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            {isPlaying ? '🔊' : '🎧'}
          </div>
          <div>
            <strong style={{ fontSize: '14px', color: '#1f2937' }}>{title}</strong>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {isUnlocked
                ? '✓ Listen requirement met. Replay anytime.'
                : requiredListens === 1
                ? 'Listen to the audio once to start the task'
                : `Listen ${requiredListens} times to unlock questions (${Math.max(0, requiredListens - listenCount)} left)`}
            </div>
          </div>
        </div>

        <StatusTag tone={isUnlocked ? 'success' : 'warning'}>
          {isUnlocked
            ? `✓ Heard: ${listenCount} ${listenCount === 1 ? 'time' : 'times'}`
            : `Heard: ${listenCount}/${requiredListens} ${requiredListens === 1 ? 'time' : 'times'}`}
        </StatusTag>
      </div>

      {hasError ? (
        <div style={{ color: 'var(--color-error)', fontSize: '13px' }}>
          Could not load audio file. Please verify the audio source.
        </div>
      ) : (
        <>
          {/* Main Controls Row: Play/Pause, Progress Scrubber, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              style={{
                width: '42px',
                height: '42px',
                flexShrink: 0,
                borderRadius: '50%',
                border: 'none',
                background: isPlaying
                  ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                boxShadow: '0 4px 10px rgba(109, 40, 217, 0.25)',
                transition: 'transform 0.15s ease',
              }}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>

            {/* Progress Scrubber Bar */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                onClick={handleSeek}
                style={{
                  width: '100%',
                  height: '8px',
                  background: '#e5e7eb',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: isUnlocked ? 'var(--color-success, #16a34a)' : 'var(--color-primary, #8b5cf6)',
                    borderRadius: 'inherit',
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--color-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Replay button */}
            <button
              type="button"
              onClick={handleReplay}
              title="Replay from beginning"
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#4b5563',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ↺ Replay
            </button>
          </div>

          {/* Locked Notice or Unlocked Success Banner */}
          {!isUnlocked ? (
            <div
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                background: '#fff7ed',
                border: '1px solid #ffedd5',
                borderRadius: '8px',
                color: '#c2410c',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🔒</span>
              <span>
                Task questions are currently locked. Listen to the recording <strong>{requiredListens === 1 ? '1 time' : `${requiredListens} times`}</strong> to start answering.
              </span>
            </div>
          ) : (
            <div
              style={{
                fontSize: '12.5px',
                padding: '6px 12px',
                background: '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                borderRadius: '10px',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>✓</span>
                <span>
                  {!hasStartedWorksheet
                    ? 'Listening complete! Ready to answer.'
                    : 'Listening complete! You can replay the audio anytime.'}
                </span>
              </div>
              {!hasStartedWorksheet && onStartWorksheet && (
                <button
                  type="button"
                  id="btnStartWorksheetInAudio"
                  onClick={onStartWorksheet}
                  style={{
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                    transition: 'all 0.1s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ▶ Làm bài (Start)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
