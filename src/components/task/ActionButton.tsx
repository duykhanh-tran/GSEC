import type { ButtonHTMLAttributes } from 'react'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success'
}

export function ActionButton({
  variant = 'primary',
  className = '',
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={`action-button action-button--${variant} ${className}`.trim()}
      type="button"
      {...props}
    />
  )
}
