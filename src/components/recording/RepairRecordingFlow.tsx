import { useState, type ReactNode } from 'react'

import { ActionButton } from '../task/ActionButton'
import { TaskPanel } from '../task/TaskPanel'
import { RecordingCard } from './RecordingCard'

interface RepairRecordingFlowProps {
  title: string
  subtitle: string
  stage: string
  retry: boolean
  dataTurn?: number
  dataAttempt?: number
  transcript: string
  correct: boolean
  beforeRecording?: ReactNode
  successMessage: ReactNode
  repairCue: ReactNode
  model: string
  nextLabel: string
  completeAction?: 'use' | 'next'
  modelLabel?: string
  modelGuidedNote?: ReactNode
  onTranscriptRetry?: () => void
  onModelShown?: () => void
  onRepair: () => void
  onComplete: () => void
}

export function RepairRecordingFlow({ title, subtitle, stage, retry, dataTurn, dataAttempt, transcript, correct, beforeRecording, successMessage, repairCue, model, nextLabel, completeAction = 'next', modelLabel = 'Need a model', modelGuidedNote, onTranscriptRetry, onModelShown, onRepair, onComplete }: RepairRecordingFlowProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [modelVisible, setModelVisible] = useState(false)

  if (!confirmed) {
    return <RecordingCard label={title} range={subtitle} stage={stage} dataRetry={retry} dataTurn={dataTurn} dataAttempt={dataAttempt} transcript={transcript} confirmLabel="Yes, check it" onTranscriptRetry={onTranscriptRetry} onConfirm={() => setConfirmed(true)}>{beforeRecording}</RecordingCard>
  }

  return (
    <TaskPanel title={title} subtitle={subtitle} data-stage={stage} data-retry={String(retry)} data-turn={dataTurn} data-attempt={dataAttempt}>
      <div className="transcript"><strong>What I heard</strong>{transcript}</div>
      {correct ? (
        <>
          <div className="gate ok">{successMessage}</div>
          <div className="actions">
            <ActionButton variant="secondary" className="btn secondary" data-again onClick={() => setConfirmed(false)}>Record again</ActionButton>
            <ActionButton variant="success" className="btn success" data-use={completeAction === 'use' || undefined} data-next={completeAction === 'next' || undefined} onClick={onComplete}>{nextLabel}</ActionButton>
          </div>
        </>
      ) : (
        <>
          <div className="gate warn">{repairCue}</div>
          {modelVisible ? <div className="model"><strong>Example:</strong><br />{model}{modelGuidedNote ? <div className="model__guided-note">{modelGuidedNote}</div> : null}</div> : null}
          <div className="actions">
            <ActionButton variant="secondary" className="btn secondary" data-model disabled={modelVisible} onClick={() => { setModelVisible(true); onModelShown?.() }}>{modelLabel}</ActionButton>
            <ActionButton className="btn primary" data-retry onClick={onRepair}>Try again</ActionButton>
          </div>
        </>
      )}
    </TaskPanel>
  )
}
