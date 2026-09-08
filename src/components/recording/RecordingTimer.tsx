interface RecordingTimerProps {
  elapsed: number
}

export function RecordingTimer({ elapsed }: RecordingTimerProps) {
  return <div className="recording-timer timer" aria-live="off">{elapsed.toFixed(1)} sec</div>
}
