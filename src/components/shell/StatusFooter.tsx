interface StatusFooterProps {
  title: string
  status: string
  statusId?: string
  actionLabel: string
  disabled?: boolean
  actionId?: string
  onAction?: () => void
}

export function StatusFooter({
  title,
  status,
  statusId,
  actionLabel,
  disabled = false,
  actionId,
  onAction,
}: StatusFooterProps) {
  return (
    <footer className="footer status-footer">
      <div className="barf">
        <div className="fl">
          <strong id="ft">{title}</strong>
          <span id={statusId ?? 'fs'}>{status}</span>
        </div>
        <button id={actionId} type="button" disabled={disabled} onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </footer>
  )
}
