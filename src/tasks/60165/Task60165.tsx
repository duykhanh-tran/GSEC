import { useState, type ReactNode } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { ReadinessChecklist } from '../../components/checklist/ReadinessChecklist'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { LanguageHelpPanel } from '../../components/writing/LanguageHelpPanel'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { WRITING_CHECKLIST, WRITING_LANGUAGE_HELP } from './data'

interface Notice { id: number; content: ReactNode }
type Phase = 'guide' | 'check' | 'complete'

export function Task60165({ task }: TaskComponentProps) {
  const [phase, setPhase] = useState<Phase>('guide')
  const [checks, setChecks] = useState<Record<string, boolean>>({ length: false, name: false, facilities: false, like: false })
  const [warningVisible, setWarningVisible] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const { chatRef } = useAutoScroll(`${phase}-${Object.values(checks).join('-')}-${warningVisible}-${notices.length}`)
  const addNotice = (content: ReactNode) => setNotices((current) => [...current, { id: current.length + 1, content }])
  const missing = WRITING_CHECKLIST.filter((item) => !checks[item.id])

  const finishWriting = () => {
    setPhase('check')
    addNotice('Great. Now check your draft before you send it to the AI Coach.')
  }

  const checkDraft = () => {
    if (missing.length) {
      setWarningVisible(true)
      addNotice(<><strong>One more check.</strong><br />Go back to your paragraph and fix: <strong>{missing.map((item) => item.title).join(', ')}</strong>.</>)
      return
    }
    setPhase('complete')
    addNotice(<><strong>Your first draft is ready.</strong><br />Next, open Task 6 to scan or type the paragraph and get feedback.</>)
  }

  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 5.</strong><br />Use Task 4 as a model and write your own 40–50 word paragraph in the worksheet.</> },
    ...(phase === 'guide' ? [{ id: 'guide', type: 'panel' as const, title: 'Write in your worksheet', subtitle: '40–50 words', stage: 'guide', content: <><div className="goal"><strong>MY SCHOOL</strong><p>Write one short paragraph about your real or fictional school. Keep the worksheet as the main writing space.</p></div><LanguageHelpPanel phrases={WRITING_LANGUAGE_HELP} /><div className="note">Use the phrases only when you need them. Do not copy a model paragraph.</div><div className="actions"><ActionButton variant="secondary" data-demo onClick={finishWriting}>Demo</ActionButton><ActionButton data-ready onClick={finishWriting}>I finished writing</ActionButton></div></> }] : []),
    ...(phase === 'check' ? [{ id: 'check', type: 'panel' as const, title: 'Check your draft', subtitle: 'Before Task 6', stage: 'check', content: <><ReadinessChecklist items={WRITING_CHECKLIST} values={checks} onChange={(id, checked) => { setChecks((current) => ({ ...current, [id]: checked })); setWarningVisible(false) }} /><div className="actions"><ActionButton variant="secondary" data-demo-check onClick={() => { setChecks({ length: true, name: true, facilities: true, like: false }); setWarningVisible(false) }}>Demo</ActionButton><ActionButton data-confirm onClick={checkDraft}>{missing.length ? 'Check my draft' : 'My draft is ready'}</ActionButton></div><div className="note">Keep all writing and corrections in your worksheet. You will scan or type this same draft in Task 6.</div>{warningVisible ? <div className="warnbox" role="alert">Make the change in your worksheet first, then tick the item here.</div> : null}</> }] : []),
    ...notices.map((notice): TaskFlowBlock => ({ id: `notice-${notice.id}`, type: 'tutor-message', content: notice.content })),
    ...(phase === 'complete' ? [{ id: 'complete', type: 'panel' as const, title: 'Task 5 ready ✓', subtitle: 'Independent Writing', variant: 'summary' as const, stage: 'complete', content: <>{WRITING_CHECKLIST.map((item) => <div className="result" key={item.id}><span>{item.title}</span><StatusTag tone="success">Ready ✓</StatusTag></div>)}<div className="note">Your first draft stays in the worksheet. In Task 6, scan or type exactly what you wrote so the AI Coach can give feedback and compare your first and revised versions.</div></> }] : []),
  ]

  return <TaskRenderer task={task} className="task-60165" chatRef={chatRef} footer={<StatusFooter title={phase === 'complete' ? 'Task 5 ready' : 'Task 5'} status={phase === 'complete' ? 'Continue to AI feedback.' : 'Write first, then check your draft.'} actionLabel="Go to Task 6" actionId="nextBtn" disabled={phase !== 'complete'} onAction={() => addNotice('Task 6 starts by capturing the paragraph you wrote in the worksheet.')} />} blocks={blocks} />
}
