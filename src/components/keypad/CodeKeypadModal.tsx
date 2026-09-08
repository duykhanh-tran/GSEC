import type { RefObject } from 'react'

import { CodeKeypad } from './CodeKeypad'

interface CodeKeypadModalProps {
  dialogId: string
  isOpen: boolean
  returnFocusRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onNavigate: (code: string) => void
}

export function CodeKeypadModal({
  dialogId,
  isOpen,
  returnFocusRef,
  onClose,
  onNavigate,
}: CodeKeypadModalProps) {
  if (!isOpen) return null

  return (
    <CodeKeypad
      mode="modal"
      dialogId={dialogId}
      returnFocusRef={returnFocusRef}
      onRequestClose={onClose}
      onNavigate={onNavigate}
    />
  )
}
