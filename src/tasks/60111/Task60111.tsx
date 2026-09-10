import { useState } from 'react'
import type { TaskComponentProps } from '../../app/task-types'
import { Celebration } from '../../components/effects/Celebration'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { useCelebrationSound } from '../../hooks/useCelebrationSound'
import { useTaskTimers } from '../../hooks/useTaskTimers'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { saveTaskAttempt } from '../../lib/taskAttemptService'
import './task.css'

const things = [
  'ruler', 'compass', 'pencil sharpener', 'rubber', 'pencil case', 'calculator',
  'school bag', 'notebook', 'book', 'textbook', 'pen', 'pencil',
]

const fields = [
  { id: 'q1', label: '1', placeholder: 'Your answer', valid: (value: string) => ['school', 'a school'].includes(value), hint: 'Where are the students on their first day?', second: 'Find the place word in Getting Started.' },
  { id: 'q2', label: '2', placeholder: 'Your answer', valid: (value: string) => ['3', 'three'].includes(value), hint: 'Count the students who are speaking.', second: 'Count the speakers again.' },
  { id: 'q3', label: '3', placeholder: 'Your answer', valid: (value: string) => value === 'excited', hint: 'Find the feeling word about their first day.', second: 'Look for the feeling word in the lesson.' },
  { id: 'q4a', label: '4a', placeholder: 'Thing 1', valid: (value: string) => things.includes(value), hint: 'Choose one school thing from the lesson.', second: 'Use a school thing from the lesson.' },
  { id: 'q4b', label: '4b', placeholder: 'Thing 2', valid: (value: string) => things.includes(value), hint: 'Choose a different school thing.', second: 'Use another school thing.' },
] as const

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

export function Task60111({ task }: TaskComponentProps) {
  const [values, setValues] = useState<Record<string, string>>({ q1: '', q2: '', q3: '', q4a: '', q4b: '' })
  const [phase, setPhase] = useState<'entry' | 'retry' | 'complete'>('entry')
  const [wrong, setWrong] = useState<string[]>([])
  const [attempt, setAttempt] = useState(1)
  const [retryValue, setRetryValue] = useState('')
  const [notices, setNotices] = useState<string[]>([])
  const schedule = useTaskTimers()
  useCelebrationSound(phase === 'complete')
  const active = fields.find((field) => field.id === wrong[0])

  const isValid = (field: typeof fields[number], value: string) =>
    field.valid(normalize(value)) && (field.id !== 'q4b' || normalize(value) !== normalize(values.q4a))

  const updateValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }))
  }

  const check = () => {
    if (fields.some((field) => !normalize(values[field.id]))) {
      setNotices((current) => [...current, 'Enter all answers first.'])
      return
    }

    const errors = fields.filter((field) => !isValid(field, values[field.id])).map((field) => field.id)
    setWrong(errors)
    const firstScore = Math.round(((fields.length - errors.length) / fields.length) * 100)

    if (errors.length === 0) {
      saveTaskAttempt({
        taskCode: task.code,
        score: 100,
        firstScore: 100,
        status: 'completed',
        supportMode: 'INDEPENDENT',
        answersPayload: values,
      })
      setPhase('complete')
    } else {
      saveTaskAttempt({
        taskCode: task.code,
        score: firstScore,
        firstScore: firstScore,
        status: 'in_progress',
        supportMode: 'GUIDED',
        answersPayload: values,
      })
      setPhase('retry')
    }
  }

  const retry = () => {
    if (!active) return

    if (isValid(active, retryValue)) {
      setValues((current) => ({ ...current, [active.id]: retryValue }))
      const next = wrong.slice(1)
      setWrong(next)
      setRetryValue('')
      setAttempt(1)
      if (!next.length) {
        saveTaskAttempt({
          taskCode: task.code,
          score: 100,
          status: 'completed',
          supportMode: 'GUIDED',
          answersPayload: values,
        })
        setPhase('complete')
      }
      return
    }

    if (attempt === 1) {
      setAttempt(2)
      setRetryValue('')
      setNotices((current) => [...current, `Not yet. ${active.second}`])
    }
  }

  const progress = phase === 'entry' ? 0 : Math.round(((fields.length - wrong.length) / fields.length) * 100)
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Check Task 1.</strong><br />Enter your answers from the worksheet.</> },
    ...notices.map((notice, index): TaskFlowBlock => ({ id: `notice-${index}`, type: 'tutor-message', content: notice })),
    ...(phase === 'entry' ? [{
      id: 'entry',
      type: 'custom' as const,
      content: (
        <section className="inline-card" id="entryCard">
          <div className="card-head"><h2>Your answers</h2><p>Enter your answers below.</p></div>
          <form className="form" id="answerForm" onSubmit={(event) => { event.preventDefault(); check() }}>
            {fields.slice(0, 3).map((field) => (
              <label className="field" key={field.id}>
                <span className="field-num">{field.label}</span>
                <input id={field.id} autoComplete="off" inputMode={field.id === 'q2' ? 'numeric' : undefined} value={values[field.id]} placeholder={field.placeholder} onChange={(event) => updateValue(field.id, event.target.value)} />
              </label>
            ))}
            <div className="field">
              <span className="field-num">4</span>
              <div className="pair">
                {fields.slice(3).map((field) => (
                  <input id={field.id} key={field.id} autoComplete="off" aria-label={`Question 4, ${field.id === 'q4a' ? 'thing 1' : 'thing 2'}`} value={values[field.id]} placeholder={field.placeholder} onChange={(event) => updateValue(field.id, event.target.value)} />
                ))}
              </div>
            </div>
            <div className="actions">
              <ActionButton id="demoBtn" variant="secondary" type="button" onClick={() => setValues({ q1: 'classroom', q2: '3', q3: 'happy', q4a: 'ruler', q4b: 'calculator' })}>Demo</ActionButton>
              <ActionButton type="submit">Check</ActionButton>
            </div>
          </form>
        </section>
      ),
    }] : []),
    ...(phase !== 'entry' ? [{
      id: 'results',
      type: 'custom' as const,
      content: (
        <section className={phase === 'complete' ? 'final-card' : 'inline-card'} id="resultCard">
          <div className={phase === 'complete' ? 'final-head' : 'card-head'}>
            <h2>{phase === 'complete' ? 'Task 1 complete ✓' : 'Task 1 check'}</h2>
            <p>{phase === 'complete' ? 'All answers are correct.' : 'We’ll fix only the ones that need another look.'}</p>
          </div>
          <div className="result-list">
            {fields.map((field) => (
              <div className="result" key={field.id}>
                <span>Question {field.label}</span>
                <StatusTag tone={!wrong.includes(field.id) ? 'success' : 'error'}>{!wrong.includes(field.id) ? '✓' : 'Try again'}</StatusTag>
              </div>
            ))}
          </div>
        </section>
      ),
    }] : []),
    ...(phase === 'retry' && active ? [{
      id: `retry-${active.id}-${attempt}`,
      type: 'custom' as const,
      content: (
        <section className="retry-card" data-key={active.id}>
          <div className="retry-title"><strong>Question {active.label}</strong><StatusTag tone="warning">Try again</StatusTag></div>
          <div className="hint">{attempt === 1 ? active.hint : active.second}</div>
          <label className="sr-only" htmlFor={`retry-${active.id}`}>Retry answer</label>
          <input id={`retry-${active.id}`} autoFocus autoComplete="off" value={retryValue} placeholder="Type your new answer" onChange={(event) => setRetryValue(event.target.value)} />
          <div className="mini-actions"><ActionButton onClick={retry}>Check</ActionButton></div>
        </section>
      ),
    }] : []),
    ...(phase === 'complete' ? [
      { id: 'done', type: 'tutor-message' as const, content: <><strong>All ✓</strong><br />Great work. Back to your book.</> },
      { id: 'celebrate', type: 'custom' as const, content: <Celebration active /> },
    ] : []),
  ]

  return <TaskRenderer task={task} disableAutoSave={true} className="task-60111" footer={<StatusFooter title="Task 1" status={`${progress}%`} statusId="progressText" actionLabel="Back to book" actionId="backBookBtn" disabled={phase !== 'complete'} onAction={() => { setNotices((current) => [...current, 'Nice. Keep going.']); schedule(() => {}, 0) }} />} blocks={blocks} />
}
