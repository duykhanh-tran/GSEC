import { useState, type ReactNode } from 'react'

import { useRecordingSimulation } from '../../hooks/useRecordingSimulation'
import { ActionButton } from '../task/ActionButton'
import { TaskPanel } from '../task/TaskPanel'
import { RecordingTimer } from './RecordingTimer'
import { TranscriptConfirmation } from './TranscriptConfirmation'
import { Waveform } from './Waveform'

interface RecordingCardProps {
  label: string
  range: string
  stage: string
  transcript: string
  demoLabel?: string
  recordLabel?: string
  recordingDurationMs?: number
  conversionDurationMs?: number
  confirmationMode?: 'manual' | 'automatic'
  dataRetry?: boolean
  dataTurn?: number
  dataAttempt?: number
  dataSentence?: number
  confirmLabel?: string
  retryLabel?: string
  children?: ReactNode
  onTranscriptRetry?: () => void
  onConfirm: () => void
}

export function RecordingCard({ label, range, stage, transcript, demoLabel = 'Demo', recordLabel = '🎙 Record', recordingDurationMs, conversionDurationMs, confirmationMode = 'manual', dataRetry, dataTurn, dataAttempt, dataSentence, confirmLabel, retryLabel, children, onTranscriptRetry, onConfirm }: RecordingCardProps) {
  const [heard, setHeard] = useState(false)
  const recording = useRecordingSimulation(() => { if (confirmationMode === 'automatic') onConfirm(); else setHeard(true) }, { recordingDurationMs, conversionDurationMs })
  const run = () => { setHeard(false); recording.start() }

  return (
    <TaskPanel title={label} subtitle={range} data-stage={stage} data-retry={dataRetry === undefined ? undefined : String(dataRetry)} data-retry-mode={dataRetry === undefined ? undefined : String(dataRetry)} data-turn={dataTurn} data-attempt={dataAttempt} data-sentence={dataSentence}>
      {children}
      <Waveform active={recording.status === 'recording'} />
      <RecordingTimer elapsed={recording.elapsed} />
      {!heard ? (
        <div className="actions">
          <ActionButton variant="secondary" className="btn secondary" data-demo disabled={recording.status !== 'idle'} onClick={run}>{demoLabel}</ActionButton>
          <ActionButton className="btn primary" data-record disabled={recording.status !== 'idle'} onClick={run}>
            {recording.status === 'recording' ? '● Recording...' : recording.status === 'converting' ? 'Converting to text...' : recordLabel}
          </ActionButton>
        </div>
      ) : (
        <TranscriptConfirmation
          transcript={transcript}
          confirmLabel={confirmLabel}
          retryLabel={retryLabel}
          onRetry={() => { setHeard(false); recording.reset(); onTranscriptRetry?.() }}
          onConfirm={onConfirm}
        />
      )}
    </TaskPanel>
  )
}
