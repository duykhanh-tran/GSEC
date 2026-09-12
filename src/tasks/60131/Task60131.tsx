import { useReducer, useState, type ReactNode } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { ChoiceGroup } from '../../components/answers/ChoiceGroup'
import { Celebration } from '../../components/effects/Celebration'
import { RetryPanel } from '../../components/retry/RetryPanel'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { TaskPanel } from '../../components/task/TaskPanel'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { useTaskTimers } from '../../hooks/useTaskTimers'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { DEMO_ANSWERS, GRAMMAR_ITEMS, ITEM_IDS, TRANSFER_ITEMS, itemIsCorrect, normalizeAnswer, type GrammarTag } from './data'
import { initialState60131, reducer60131, type TutorNotice } from './reducer'
import './task.css'

export function Task60131({ task }: TaskComponentProps) {
  const [state, dispatch] = useReducer(reducer60131, initialState60131)
  const [showConfetti, setShowConfetti] = useState(false)
  const schedule = useTaskTimers()
  const activeQuestion = state.wrongQueue[0]
  const activeTransfer = state.transferQueue[0]
  const { chatRef } = useAutoScroll(`${state.notices.length}-${state.retryAttempt}-${state.complete}`)

  const startRetry = (id: number) => {
    dispatch({ type: 'notice', notice: { kind: 'question', question: id } })
    dispatch({ type: 'start-retry', values: GRAMMAR_ITEMS[id].key.map(() => '') })
  }

  const startTransfers = () => {
    dispatch({ type: 'notice', notice: { kind: 'transfer-intro' } })
    dispatch({ type: 'start-transfer' })
  }

  const finish = () => {
    dispatch({ type: 'finish' })
    setShowConfetti(true)
  }

  const advanceRetry = (id: number, values: string[]) => {
    const nextQuestion = state.wrongQueue[1]
    dispatch({ type: 'resolve-retry', id, values })
    if (nextQuestion) schedule(() => startRetry(nextQuestion), 0)
    else schedule(() => state.weakTags.length ? startTransfers() : finish(), 0)
  }

  const checkAll = () => {
    if (ITEM_IDS.some((id) => state.answers[id].some((value) => !value.trim()))) {
      dispatch({ type: 'notice', notice: { kind: 'complete-first' } })
      return
    }
    const wrong = ITEM_IDS.filter((id) => !itemIsCorrect(state.answers, id))
    const tags = [...new Set(wrong.map((id) => GRAMMAR_ITEMS[id].tag))]
    dispatch({ type: 'checked', wrong, tags })
    if (!wrong.length) { finish(); return }
    dispatch({ type: 'notice', notice: { kind: 'wrong-list', ids: wrong } })
    schedule(() => startRetry(wrong[0]), 220)
  }

  const checkRetry = () => {
    const item = GRAMMAR_ITEMS[activeQuestion]
    const correct = item.key.every((value, part) => normalizeAnswer(state.retryValues[part]) === normalizeAnswer(value))
    if (correct) {
      dispatch({ type: 'retry-feedback', value: 'Correct ✓' })
      schedule(() => advanceRetry(activeQuestion, state.retryValues), 600)
    } else if (state.retryAttempt === 1) {
      dispatch({ type: 'retry-feedback', value: 'Not yet.' })
      schedule(() => dispatch({ type: 'retry-second', values: item.key.map(() => '') }), 600)
    } else {
      dispatch({ type: 'retry-feedback', value: `Correct form: ${item.key.join(' … ')}.` })
      schedule(() => advanceRetry(activeQuestion, [...item.key]), 1000)
    }
  }

  const chooseTransfer = (value: string) => {
    const transfer = TRANSFER_ITEMS[activeTransfer]
    if (value === transfer.key) {
      dispatch({ type: 'transfer-feedback', value: 'Got it ✓' })
      schedule(() => {
        if (state.transferQueue.length === 1) finish()
        else dispatch({ type: 'resolve-transfer' })
      }, 600)
    } else {
      dispatch({ type: 'transfer-feedback', value: 'Not yet. Use the same rule you just reviewed.', wrong: value })
      schedule(() => dispatch({ type: 'transfer-feedback', value: '' }), 700)
    }
  }

  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Check Task 1.</strong><br />Use your worksheet. Enter only the words you wrote in the blanks.</> },
    ...(state.entryVisible ? [{ id: 'entry', type: 'custom' as const, content: <EntryCard state={state} dispatch={dispatch} onCheck={checkAll} /> }] : []),
    ...(state.resultWrong ? [{ id: 'results', type: 'custom' as const, content: <ResultsCard wrong={state.resultWrong} /> }] : []),
    ...state.notices.map((notice): TaskFlowBlock => ({ id: `notice-${notice.id}`, type: 'tutor-message', content: noticeContent(notice) })),
    ...(!state.complete && activeQuestion && state.retryValues.length ? [{ id: `retry-${activeQuestion}`, type: 'custom' as const, content: <RetryCard state={state} question={activeQuestion} dispatch={dispatch} onCheck={checkRetry} /> }] : []),
    ...(!state.complete && !activeQuestion && activeTransfer ? [{ id: `transfer-${activeTransfer}`, type: 'custom' as const, content: <TransferCard tag={activeTransfer} feedback={state.transferFeedback} wrong={state.transferWrong} onChoose={chooseTransfer} /> }] : []),
    ...(state.complete ? [{ id: 'complete', type: 'custom' as const, content: <CompleteSummary /> }] : []),
    ...(showConfetti ? [{ id: 'celebration', type: 'custom' as const, content: <Celebration active={showConfetti} onComplete={() => setShowConfetti(false)} /> }] : []),
  ]

  return (
    <TaskRenderer
      task={task}
      className="task-60131"
      chatRef={chatRef}
      footer={<StatusFooter title={state.complete ? 'Task 1 complete' : 'Task 1'} status={state.complete ? 'Continue to Task 2.' : 'Check 8 answers.'} actionLabel="Back to book" actionId="backBook" disabled={!state.complete} onAction={() => dispatch({ type: 'notice', notice: { kind: 'back' } })} />}
      blocks={blocks}
    />
  )
}

function EntryCard({ state, dispatch, onCheck }: { state: typeof initialState60131; dispatch: React.Dispatch<Parameters<typeof reducer60131>[1]>; onCheck: () => void }) {
  return <TaskPanel title="Your answers" subtitle="8 items" data-stage="entry"><div className="answer-list" data-answer-list>{ITEM_IDS.map((id) => <div className="answer-row" key={id}><div className="num">{id}</div><div className={GRAMMAR_ITEMS[id].key.length > 1 ? 'double' : ''}>{GRAMMAR_ITEMS[id].key.map((_, part) => <input className="entry" type="text" autoComplete="off" data-answer-index={id} data-answer-part={part} placeholder={GRAMMAR_ITEMS[id].key.length === 1 ? 'Your answer' : part === 0 ? 'Auxiliary' : 'Verb'} value={state.answers[id][part]} onChange={(event) => dispatch({ type: 'answer', id, part, value: event.target.value })} key={part} />)}</div></div>)}</div><div className="actions"><ActionButton variant="secondary" className="btn secondary" data-demo onClick={() => dispatch({ type: 'demo', answers: DEMO_ANSWERS })}>Demo</ActionButton><ActionButton className="btn primary" data-check onClick={onCheck}>Check</ActionButton></div><div className="note">Enter only the verb form(s), not the full sentence.</div></TaskPanel>
}

function ResultsCard({ wrong }: { wrong: number[] }) {
  return <TaskPanel title="Task 1 check" subtitle={`${8 - wrong.length}/8 correct`} data-stage="results">{ITEM_IDS.map((id) => <div className="result" key={id}><span>Question {id}</span><StatusTag tone={wrong.includes(id) ? 'error' : 'success'}>{wrong.includes(id) ? 'Try again' : 'Correct ✓'}</StatusTag></div>)}</TaskPanel>
}

function noticeContent(notice: TutorNotice): ReactNode {
  let content: ReactNode
  if (notice.kind === 'complete-first') content = <>Complete all 8 answers first.</>
  else if (notice.kind === 'wrong-list') content = <>Questions <strong>{notice.ids.join(', ')}</strong> need a quick fix.</>
  else if (notice.kind === 'question') content = <><strong>Question {notice.question}</strong><br />{GRAMMAR_ITEMS[notice.question].h1}</>
  else if (notice.kind === 'transfer-intro') content = <>Now one quick new item for each grammar point that needed extra help.</>
  else if (notice.kind === 'done') content = <><strong>All correct ✓</strong><br />Great work. Back to your book for Task 2.</>
  else content = <>Keep going. I’ll be here when you need me.</>
  return content
}

function RetryCard({ state, question, dispatch, onCheck }: { state: typeof initialState60131; question: number; dispatch: React.Dispatch<Parameters<typeof reducer60131>[1]>; onCheck: () => void }) {
  const item = GRAMMAR_ITEMS[question]
  return <RetryPanel title={`Question ${question}`} tag={item.tag} prompt={item.prompt} hint={state.retryAttempt === 1 ? item.h1 : item.h2} rule={state.retryAttempt > 1 ? item.rule : undefined} attempt={state.retryAttempt} question={question} fields={item.key.map((_, part) => ({ id: part, placeholder: item.key.length === 1 ? 'Try again' : part === 0 ? 'Auxiliary' : 'Base verb', value: state.retryValues[part] ?? '' }))} feedback={state.retryFeedback} onFieldChange={(part, value) => dispatch({ type: 'retry-value', part: Number(part), value })} onCheck={onCheck} />
}

function TransferCard({ tag, feedback, wrong, onChoose }: { tag: GrammarTag; feedback: string; wrong: string; onChoose: (value: string) => void }) {
  const item = TRANSFER_ITEMS[tag]
  return <section className="transfer" data-stage="transfer" data-tag={tag}><div className="retry-head"><strong>Quick check</strong><StatusTag tone="warning">New item</StatusTag></div><div className="sentence">{item.text}</div><ChoiceGroup ariaLabel="Quick transfer check" options={item.options.map((value) => ({ value, label: value }))} value={feedback === 'Got it ✓' ? item.key : undefined} wrongValue={wrong} disabled={feedback === 'Got it ✓'} onChange={onChoose} /><div className={`micro ${feedback === 'Got it ✓' ? 'ok' : feedback ? 'bad' : ''}`}>{feedback}</div></section>
}

function CompleteSummary() {
  return <TaskPanel title="Task 1 complete ✓" subtitle="Present Simple" variant="summary" data-stage="complete">{ITEM_IDS.map((id) => <div className="result" key={id}><span>Question {id}</span><StatusTag tone="success">Correct ✓</StatusTag></div>)}<div className="note">First-attempt errors and retry history are stored separately, even though every answer is correct at the end.</div></TaskPanel>
}
