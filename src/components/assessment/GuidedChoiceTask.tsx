import { useState, type ReactNode } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { useTaskTimers } from '../../hooks/useTaskTimers'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { AnswerChoiceMatrix } from '../answers/AnswerChoiceMatrix'
import { ChoiceGroup } from '../answers/ChoiceGroup'
import { Celebration } from '../effects/Celebration'
import { ListenButton } from '../listening/ListenButton'
import { ListeningPlaybackCard } from '../listening/ListeningPlaybackCard'
import { GuidedIndependentStatus } from '../progress/GuidedIndependentStatus'
import { StatusFooter } from '../shell/StatusFooter'
import { ActionButton } from '../task/ActionButton'
import { StatusTag } from '../task/StatusTag'
import './guided-choice-task.css'

export interface GuidedChoiceItem {
  id: number
  key: string
  firstHint: string
  secondHint: string
  retryTag: string
  bookCue: ReactNode
  summaryLabel: string
  retryContent?: ReactNode
  correctedNotice?: string
  summaryValue?: string
  speechText?: string
}

export interface GuidedChoicePlaybackConfig {
  title: string
  subtitle: string
  text: string
  prompt: ReactNode
  note?: ReactNode
  completedMessage: ReactNode
  requiredMessage?: ReactNode
  lang?: string
  rate?: number
  statusText?: ReactNode
}

export interface GuidedChoiceTaskConfig {
  className: string
  intro: ReactNode
  entrySubtitle: string
  entryNote: string
  options: readonly string[]
  items: readonly GuidedChoiceItem[]
  demoAnswers: Readonly<Record<number, string>>
  incompleteMessage: string
  itemSingular: string
  itemPlural: string
  retryDataAttribute: 'school' | 'question' | 'blank' | 'sentence'
  resultsTitle: string
  summaryTitle: string
  summarySubtitle: string
  evidenceTag: string
  evidenceNote: ReactNode
  footerIdle: string
  footerComplete: string
  continueLabel: string
  completeIndependent: string
  completeGuided: string
  backMessage: string
  entryTitle?: string
  maxAttempts?: 2 | 3
  guidedAtLimit?: boolean
  repeatFeedback?: string
  summaryMode?: 'guided' | 'answers'
  wrongSuffix?: string
  celebration?: boolean
  playback?: GuidedChoicePlaybackConfig
}

interface Notice { id: number; content: ReactNode }

export function GuidedChoiceTask({ task, config }: TaskComponentProps & { config: GuidedChoiceTaskConfig }) {
  const emptyAnswers = Object.fromEntries(config.items.map((item) => [item.id, ''])) as Record<number, string>
  const [answers, setAnswers] = useState<Record<number, string>>(emptyAnswers)
  const [playbackComplete, setPlaybackComplete] = useState(!config.playback)
  const [entryVisible, setEntryVisible] = useState(true)
  const [resultWrong, setResultWrong] = useState<number[] | null>(null)
  const [queue, setQueue] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [feedback, setFeedback] = useState('')
  const [wrongValue, setWrongValue] = useState('')
  const [guided, setGuided] = useState<Record<number, boolean>>({})
  const [answerShown, setAnswerShown] = useState(false)
  const [showFinalActions, setShowFinalActions] = useState(true)
  const [complete, setComplete] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const schedule = useTaskTimers()
  const { chatRef } = useAutoScroll(`${entryVisible}-${resultWrong?.join(',')}-${activeId}-${attempt}-${feedback}-${complete}-${notices.length}`)

  const addNotice = (content: ReactNode) => setNotices((current) => [...current, { id: current.length + 1, content }])
  const itemById = (id: number) => config.items.find((item) => item.id === id)!
  const noun = (id: number) => `${config.itemSingular} ${id}`

  const finish = (guidedState = guided) => {
    setActiveId(null)
    setComplete(true)
    setShowCelebration(Boolean(config.celebration))
    const independent = config.items.filter((item) => !guidedState[item.id]).length
    addNotice(<><strong>{config.summaryTitle.replace(' ✓', '')}.</strong><br />{independent === config.items.length ? config.completeIndependent : config.completeGuided}</>)
  }

  const beginRetry = (id: number) => {
    const item = itemById(id)
    setActiveId(id)
    setAttempt(1)
    setFeedback('')
    setWrongValue('')
    setAnswerShown(false)
    setShowFinalActions(true)
    addNotice(<><strong>{noun(id)}</strong><br />{item.firstHint}</>)
  }

  const checkAll = () => {
    if (!playbackComplete) {
      addNotice(config.playback?.requiredMessage ?? 'Listen first.')
      return
    }
    if (config.items.some((item) => !answers[item.id])) {
      addNotice(config.incompleteMessage)
      return
    }
    const wrong = config.items.filter((item) => answers[item.id] !== item.key).map((item) => item.id)
    setEntryVisible(false)
    setResultWrong(wrong)
    setQueue(wrong)
    if (!wrong.length) { finish(); return }
    addNotice(<>{config.itemPlural} <strong>{wrong.join(', ')}</strong> need another look.{config.wrongSuffix ?? ' Keep your worksheet open.'}</>)
    schedule(() => beginRetry(wrong[0]), 220)
  }

  const advance = (resolvedQueue: number[], guidedState = guided) => {
    const next = resolvedQueue.slice(1)
    setQueue(next)
    setFeedback('')
    setWrongValue('')
    setAnswerShown(false)
    setShowFinalActions(true)
    if (next.length) beginRetry(next[0])
    else finish(guidedState)
  }

  const chooseRetry = (value: string) => {
    if (activeId === null || feedback) return
    const item = itemById(activeId)
    if (value === item.key) {
      setFeedback('Correct ✓')
      setAnswers((current) => ({ ...current, [activeId]: value }))
      schedule(() => {
        if (attempt > 1 && item.correctedNotice) addNotice(item.correctedNotice)
        advance(queue)
      }, 650)
      return
    }
    const maxAttempts = config.maxAttempts ?? 3
    setFeedback(attempt >= maxAttempts && !config.guidedAtLimit ? config.repeatFeedback ?? 'Not yet.' : 'Not yet.')
    setWrongValue(value)
    schedule(() => {
      if (attempt >= maxAttempts) {
        setFeedback('')
        setWrongValue('')
        return
      }
      const nextAttempt = Math.min(maxAttempts, attempt + 1)
      setAttempt(nextAttempt)
      setFeedback('')
      setWrongValue('')
      setShowFinalActions(true)
      addNotice(<><strong>{noun(activeId)}</strong><br />{nextAttempt === 2 ? 'Now use one more specific clue from the worksheet.' : `Try once more. If you need the answer, this ${config.itemSingular.toLowerCase()} will be marked Guided.`}</>)
    }, 650)
  }

  const showAnswer = () => {
    if (activeId === null) return
    const item = itemById(activeId)
    const nextGuided = { ...guided, [activeId]: true }
    setGuided(nextGuided)
    setAnswers((current) => ({ ...current, [activeId]: item.key }))
    setAnswerShown(true)
    setShowFinalActions(false)
    schedule(() => advance(queue, nextGuided), 1200)
  }

  const retryAttributes = activeId === null ? {} : { [`data-${config.retryDataAttribute}`]: String(activeId) }
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: config.intro },
    ...(config.playback ? [{ id: 'playback', type: 'custom' as const, content: <ListeningPlaybackCard {...config.playback} onComplete={() => { if (!playbackComplete) { setPlaybackComplete(true); addNotice(config.playback?.completedMessage) } }} /> }] : []),
    ...(entryVisible && playbackComplete ? [{ id: 'entry', type: 'panel' as const, title: config.entryTitle ?? 'Your answers', subtitle: config.entrySubtitle, stage: 'entry', content: <><div data-entry-box><AnswerChoiceMatrix layout="table" rows={config.items.map((item) => ({ id: item.id, prompt: item.id, options: config.options.map((value) => ({ value, label: value })) }))} values={Object.fromEntries(Object.entries(answers).map(([id, value]) => [id, value]))} onChange={(id, value) => setAnswers((current) => ({ ...current, [Number(id)]: value }))} /></div><div className="actions"><ActionButton variant="secondary" className="btn secondary" data-demo onClick={() => setAnswers({ ...config.demoAnswers })}>Demo</ActionButton><ActionButton className="btn primary" data-check onClick={checkAll}>Check</ActionButton></div><div className="note">{config.entryNote}</div></> }] : []),
    ...(resultWrong ? [{ id: 'results', type: 'panel' as const, title: config.resultsTitle, subtitle: `${config.items.length - resultWrong.length}/${config.items.length} correct`, stage: 'results', content: <>{config.items.map((item) => <div className="result" key={item.id}><span>{item.summaryLabel}</span><StatusTag tone={resultWrong.includes(item.id) ? 'error' : 'success'}>{resultWrong.includes(item.id) ? 'Try again' : 'Correct ✓'}</StatusTag></div>)}</> }] : []),
    ...notices.map((notice): TaskFlowBlock => ({ id: `notice-${notice.id}`, type: 'tutor-message', content: notice.content })),
    ...(activeId !== null && !complete ? [{ id: `retry-${activeId}-${attempt}`, type: 'custom' as const, content: <section className="retry guided-choice-retry" data-stage="retry" data-attempt={attempt} {...retryAttributes}><div className="retry-head"><strong>{noun(activeId)}</strong><StatusTag tone="warning">{itemById(activeId).retryTag}</StatusTag></div><div className="bookcue">{itemById(activeId).bookCue}</div>{itemById(activeId).speechText ? <div className="replay"><ListenButton text={itemById(activeId).speechText!} label="🔊 Replay relevant part" /></div> : null}{itemById(activeId).retryContent}<div className={`hint ${attempt > 1 ? 'deep' : ''}`}>{attempt === 1 ? itemById(activeId).firstHint : itemById(activeId).secondHint}</div><ChoiceGroup ariaLabel={`${noun(activeId)} retry`} options={config.options.map((value) => ({ value, label: value }))} value={feedback === 'Correct ✓' ? itemById(activeId).key : undefined} wrongValue={wrongValue} disabled={Boolean(feedback)} onChange={chooseRetry} /><div className={`micro ${feedback === 'Correct ✓' ? 'ok' : feedback ? 'bad' : ''}`}>{feedback}</div>{answerShown ? <div className="answerbox">Answer: <strong>{itemById(activeId).key}</strong><br />This {config.itemSingular.toLowerCase()} is marked <strong>Guided</strong>, not independently mastered.</div> : (config.guidedAtLimit ?? true) && attempt >= (config.maxAttempts ?? 3) && showFinalActions ? <div className="actions" data-final-actions><ActionButton variant="secondary" className="btn secondary" data-show onClick={showAnswer}>Show answer</ActionButton><ActionButton className="btn primary" data-keep onClick={() => setShowFinalActions(false)}>Try once more</ActionButton></div> : null}</section> }] : []),
    ...(complete ? [{ id: 'complete', type: 'panel' as const, title: config.summaryTitle, subtitle: config.summarySubtitle, variant: 'summary' as const, stage: 'complete', content: <>{config.items.map((item) => <div className="result" key={item.id}><span>{item.summaryLabel}</span>{config.summaryMode === 'answers' ? <StatusTag tone="success">{item.summaryValue ?? 'Correct ✓'}</StatusTag> : <GuidedIndependentStatus mode={guided[item.id] ? 'guided' : 'independent'} />}</div>)}<div className="note">{config.evidenceNote}</div></> }] : []),
    { id: 'celebration', type: 'custom', content: <Celebration active={showCelebration} onComplete={() => setShowCelebration(false)} /> },
  ]

  return <TaskRenderer task={task} className={`${config.className} guided-choice-task`} chatRef={chatRef} footer={<StatusFooter title={complete ? config.summaryTitle.replace(' ✓', '') : `Task ${task.taskNumber}`} status={complete ? config.footerComplete : config.footerIdle} actionLabel="Back to book" actionId="backBook" disabled={!complete} onAction={() => addNotice(config.backMessage)} />} blocks={blocks} />
}
