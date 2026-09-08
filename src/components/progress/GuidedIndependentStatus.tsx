import { StatusTag } from '../task/StatusTag'

interface GuidedIndependentStatusProps {
  mode: 'independent' | 'guided'
  answerShown?: boolean
}

export function GuidedIndependentStatus({ mode, answerShown = false }: GuidedIndependentStatusProps) {
  const guided = mode === 'guided' || answerShown
  return <StatusTag tone={guided ? 'warning' : 'success'} data-learning-mode={guided ? 'guided' : 'independent'}>{guided ? 'Guided' : 'Independent ✓'}</StatusTag>
}
