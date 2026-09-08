import { CodeKeypad } from './CodeKeypad'

interface InlineCodeKeypadProps {
  onNavigate: (code: string) => void
}

export function InlineCodeKeypad({ onNavigate }: InlineCodeKeypadProps) {
  return <CodeKeypad mode="inline" onNavigate={onNavigate} />
}
