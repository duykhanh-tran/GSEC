import { useState } from 'react'
import type { TaskComponentProps } from '../../app/task-types'
import { AnswerChoiceMatrix } from '../../components/answers/AnswerChoiceMatrix'
import { ChoiceGroup } from '../../components/answers/ChoiceGroup'
import { Celebration } from '../../components/effects/Celebration'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { useTaskTimers } from '../../hooks/useTaskTimers'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { ITEMS_60121, TRANSFER_60121, VERBS_60121 } from './data'

export function Task60121({ task }: TaskComponentProps) {
  const empty = Object.fromEntries(ITEMS_60121.map((item) => [item.id, ''])) as Record<number, string>
  const [answers, setAnswers] = useState(empty)
  const [phase, setPhase] = useState<'entry' | 'retry' | 'transfer' | 'complete'>('entry')
  const [wrong, setWrong] = useState<number[]>([])
  const [attempt, setAttempt] = useState(1)
  const [feedback, setFeedback] = useState('')
  const [notices, setNotices] = useState<string[]>([])
  const schedule = useTaskTimers()
  const item = ITEMS_60121.find((candidate) => candidate.id === wrong[0])
  const transfer = TRANSFER_60121[item?.family ?? 'do']

  const check = () => {
    if (ITEMS_60121.some((candidate) => !answers[candidate.id])) { setNotices((value) => [...value, 'Choose all 8 answers first.']); return }
    const errors = ITEMS_60121.filter((candidate) => answers[candidate.id] !== candidate.key).map((candidate) => candidate.id)
    setWrong(errors)
    if (!errors.length) setPhase('complete')
    else { setPhase('retry'); setNotices((value) => [...value, `Questions ${errors.join(', ')} need a quick fix.`]) }
  }
  const choose = (value: string) => {
    if (!item || feedback) return
    if (value === item.key) {
      setFeedback('Correct ✓')
      schedule(() => { const next = wrong.slice(1); setWrong(next); setAttempt(1); setFeedback(''); if (!next.length) setPhase('transfer') }, 550)
    } else { setFeedback(attempt === 1 ? 'Not yet.' : 'Try once more.'); schedule(() => { setAttempt(2); setFeedback('') }, 550) }
  }
  const chooseTransfer = (value: string) => {
    if (feedback) return
    if (value === transfer.key) { setFeedback('Got it ✓'); schedule(() => setPhase('complete'), 550) }
    else { setFeedback(transfer.hint); schedule(() => setFeedback(''), 500) }
  }

  const results: TaskFlowBlock = { id: 'results', type: 'panel', title: phase === 'complete' ? 'Task 1 complete ✓' : 'Task 1 check', subtitle: phase === 'complete' ? 'All 8 collocations are correct.' : 'We’ll fix only the answers that need another look.', content: <>{ITEMS_60121.map((candidate) => <div className="result" key={candidate.id}><span>Question {candidate.id}</span><StatusTag tone={phase === 'complete' || !wrong.includes(candidate.id) ? 'success' : 'error'}>{phase === 'complete' || !wrong.includes(candidate.id) ? 'Correct ✓' : 'Try again'}</StatusTag></div>)}</> }
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Check Task 1.</strong><br />Enter the collocation verbs from your worksheet.</> },
    ...notices.map((notice, index): TaskFlowBlock => ({ id: `notice-${index}`, type: 'tutor-message', content: notice })),
    ...(phase === 'entry' ? [{ id: 'entry', type: 'panel' as const, title: 'Your worksheet answers', subtitle: '8 items', stage: 'entry', content: <><AnswerChoiceMatrix layout="table" rows={ITEMS_60121.map((candidate) => ({ id: candidate.id, prompt: candidate.id, options: VERBS_60121.map((verb) => ({ value: verb, label: verb })) }))} values={answers} onChange={(id, value) => setAnswers((current) => ({ ...current, [Number(id)]: value }))} /><div className="actions"><ActionButton id="demo" variant="secondary" onClick={() => setAnswers({ 1: 'study', 2: 'have', 3: 'play', 4: 'study', 5: 'play', 6: 'play', 7: 'have', 8: 'have' })}>Demo</ActionButton><ActionButton id="check" onClick={check}>Check</ActionButton></div></> }] : [results]),
    ...(phase === 'retry' && item ? [{ id: `retry-${item.id}-${attempt}`, type: 'custom' as const, content: <section className="retry" data-stage="retry" data-question={item.id} data-attempt={attempt}><div className="retry-head"><strong>Question {item.id}</strong><StatusTag tone="warning">Try again</StatusTag></div><div className="sentence">{item.text}</div><div className="hint">{attempt === 1 ? item.h1 : item.h2}</div><ChoiceGroup ariaLabel={`Question ${item.id}`} options={VERBS_60121.map((verb) => ({ value: verb, label: verb }))} onChange={choose} /><div className="micro">{feedback}</div></section> }] : []),
    ...(phase === 'transfer' ? [{ id: 'transfer-message', type: 'tutor-message' as const, content: 'One quick check with a new sentence.' }, { id: 'transfer', type: 'custom' as const, content: <section className="retry" data-stage="transfer"><div className="retry-head"><strong>Quick check</strong><StatusTag tone="warning">New item</StatusTag></div><div className="sentence">{transfer.q}</div><div className="note">New sentence, same collocation pattern you just repaired.</div><ChoiceGroup ariaLabel="Transfer answer" options={VERBS_60121.map((verb) => ({ value: verb, label: verb }))} onChange={chooseTransfer} /><div className="micro">{feedback}</div></section> }] : []),
    ...(phase === 'complete' ? [{ id: 'complete-message', type: 'tutor-message' as const, content: <><strong>All correct ✓</strong><br />Great work. Back to your book.</> }, { id: 'celebration', type: 'custom' as const, content: <Celebration active /> }] : []),
  ]
  return <TaskRenderer task={task} className="task-60121 guided-choice-task" footer={<StatusFooter title={phase === 'complete' ? 'Task 1 complete' : 'Task 1'} status={phase === 'complete' ? 'Continue to Task 2.' : 'Check 8 answers.'} actionLabel="Back to book" actionId="backBook" disabled={phase !== 'complete'} onAction={() => setNotices((value) => [...value, 'Keep going. I’ll be here when you need me.'])} />} blocks={blocks} />
}
