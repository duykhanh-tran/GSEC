import type { HTMLAttributes, ReactNode } from 'react'

interface StatusTagProps extends HTMLAttributes<HTMLSpanElement> {
  tone: 'success' | 'error' | 'warning'
  children: ReactNode
}

const toneClass = {
  success: 'ok',
  error: 'bad',
  warning: 'warn',
} as const

export function StatusTag({ tone, className = '', children, ...props }: StatusTagProps) {
  return <span className={`tag ${toneClass[tone]} ${className}`.trim()} {...props}>{children}</span>
}
