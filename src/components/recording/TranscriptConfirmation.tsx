import { ActionButton } from '../task/ActionButton'

interface TranscriptConfirmationProps {
  transcript: string
  title?: string
  retryLabel?: string
  confirmLabel?: string
  onRetry: () => void
  onConfirm: () => void
}

export function TranscriptConfirmation({ transcript, title = 'What I heard', retryLabel = 'No, record again', confirmLabel = 'Yes, use this', onRetry, onConfirm }: TranscriptConfirmationProps) {
  return (
    <div className="transcript-confirmation">
      <div className="transcript"><strong>{title}</strong>{transcript}</div>
      <div className="actions">
        <ActionButton variant="secondary" className="btn secondary" data-again data-no onClick={onRetry}>{retryLabel}</ActionButton>
        <ActionButton className="btn primary" data-confirm data-yes onClick={onConfirm}>{confirmLabel}</ActionButton>
      </div>
    </div>
  )
}
