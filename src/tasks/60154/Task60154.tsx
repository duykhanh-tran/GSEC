import { useState } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { DEMO_CHECKS, EMPTY_CHECKS, PLAN_ITEMS, type PlanId } from './data'
import './task.css'

type TutorEvent = { id: number; kind: 'missing'; titles: string[] } | { id: number; kind: 'continue' }

export function Task60154({ task }: TaskComponentProps) {
  const [checks, setChecks] = useState({ ...EMPTY_CHECKS })
  const [warningVisible, setWarningVisible] = useState(false)
  const [complete, setComplete] = useState(false)
  const [events, setEvents] = useState<TutorEvent[]>([])
  const { chatRef } = useAutoScroll(`${doneKey(checks)}-${warningVisible}-${complete}-${events.length}`)
  const done = Object.values(checks).filter(Boolean).length

  const toggle = (id: PlanId) => {
    setChecks((current) => ({ ...current, [id]: !current[id] }))
    setWarningVisible(false)
  }

  const checkPlan = () => {
    const missing = PLAN_ITEMS.filter((item) => !checks[item.id])
    if (missing.length) {
      setWarningVisible(true)
      setEvents((current) => [
        ...current,
        { id: current.length + 1, kind: 'missing', titles: missing.map((item) => item.title) },
      ])
      return
    }
    setComplete(true)
    setWarningVisible(false)
  }

  const readinessContent = <div data-ready-box><div className="plan">{PLAN_ITEMS.map((item) => <button className={`plan-item ${checks[item.id] ? 'checked' : ''}`.trim()} type="button" data-plan-id={item.id} aria-pressed={checks[item.id]} onClick={() => toggle(item.id)} key={item.id}><span className="check" aria-hidden="true"><span>✓</span></span><span className="plan-text"><strong>{item.title}</strong><small>{item.help}</small></span></button>)}</div><div className="actions"><ActionButton variant="secondary" className="btn secondary" data-demo onClick={() => { setChecks({ ...DEMO_CHECKS }); setWarningVisible(false) }}>Demo</ActionButton><ActionButton className="btn primary" data-ready onClick={checkPlan}>{done === 4 ? 'I’m ready' : 'Check my plan'}</ActionButton></div><div className="note">Do not type your notes into the app. Keep the short notes in your worksheet and use them in Task 5.</div><div className="warnbox" data-plan-warning hidden={!warningVisible}>Finish the missing note(s) in your book, then tick them here.</div></div>
  const completeContent = <>{PLAN_ITEMS.map((item) => <div className="result" key={item.id}><span>{item.title}</span><StatusTag tone="success">Ready ✓</StatusTag></div>)}<div className="note">Keep the worksheet open. In Task 5, you will speak for 30–45 seconds using these notes.</div></>
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 4.</strong><br />Keep your speaking plan open in the worksheet. Check that you have all four parts before you start speaking.</> },
    ...(!complete ? [{ id: 'readiness', type: 'panel' as const, title: 'Speaking plan check', subtitle: '4 parts', stage: 'readiness', content: readinessContent }] : []),
    ...(complete ? [
      { id: 'complete', type: 'panel' as const, title: 'Task 4 ready ✓', subtitle: 'Speaking Plan', variant: 'summary' as const, stage: 'complete', content: completeContent },
      { id: 'ready-message', type: 'tutor-message' as const, content: <><strong>You’re ready to speak.</strong><br />Use your notes as prompts, not as a script. Next: Task 5 AI speaking.</> },
    ] : []),
    ...events.map((event): TaskFlowBlock => ({ id: `event-${event.id}`, type: 'tutor-message', content: event.kind === 'missing' ? <><strong>Almost ready.</strong><br />Go back to your worksheet and add: <strong>{event.titles.join(', ')}</strong>.</> : <>Task 5 starts with your 30–45 second talk.</> })),
  ]

  return (
    <TaskRenderer
      task={task}
      className="task-60154"
      chatRef={chatRef}
      footer={
        <StatusFooter
          title={complete ? 'Task 4 ready' : 'Task 4'}
          status={complete ? 'Continue to Task 5.' : 'Prepare for speaking.'}
          actionLabel="Continue"
          actionId="backBook"
          disabled={!complete}
          onAction={() =>
            setEvents((current) => [...current, { id: current.length + 1, kind: 'continue' }])
          }
        />
      }
      blocks={blocks}
    />
  )
}

function doneKey(checks: Record<PlanId, boolean>) {
  return PLAN_ITEMS.map((item) => Number(checks[item.id])).join('')
}
