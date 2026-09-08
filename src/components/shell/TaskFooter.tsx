interface TaskFooterProps {
  progress: number
  disabled?: boolean
  actionLabel?: string
  onAction?: () => void
}

export function TaskFooter({
  progress,
  disabled = false,
  actionLabel = 'Back to book',
  onAction,
}: TaskFooterProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))

  return (
    <footer className="footer">
      <div className="bar">
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Task progress</span>
            <span>{safeProgress}%</span>
          </div>
          <div
            className="track"
            role="progressbar"
            aria-label="Task progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safeProgress}
          >
            <div className="fill" style={{ width: `${safeProgress}%` }} />
          </div>
        </div>
        <button
          className="done-btn"
          type="button"
          disabled={disabled}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </footer>
  )
}
