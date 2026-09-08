import type { ButtonHTMLAttributes } from 'react'

import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'

interface ListenButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  text: string
  label?: string
}

export function ListenButton({ text, label = '🔊 Listen', className = '', ...props }: ListenButtonProps) {
  const speak = useSpeechSynthesis()
  return <button className={`listen-button speaker ${className}`.trim()} type="button" data-listen onClick={() => speak(text)} {...props}>{label}</button>
}
