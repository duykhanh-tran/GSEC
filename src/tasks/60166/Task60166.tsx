import { useState, type ReactNode } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { WritingVerificationChecklist } from '../../components/checklist/WritingVerificationChecklist'
import { MasteryGate } from '../../components/progress/MasteryGate'
import { ScoreGrid } from '../../components/progress/ScoreGrid'
import { RecordingCard } from '../../components/recording/RecordingCard'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { TaskPanel } from '../../components/task/TaskPanel'
import { DraftComparison } from '../../components/writing/DraftComparison'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { CHECK_WORDS, MECHANICS_ITEMS, WRITING_DEMO } from './data'

type Phase = 'first' | 'first-feedback' | 'verify' | 'revision' | 'revised' | 'revised-feedback' | 'complete'
interface Notice { id: number; content: ReactNode }

export function Task60166({ task }: TaskComponentProps) {
  const [phase, setPhase] = useState<Phase>('first')
  const [mechanics, setMechanics] = useState<Record<string, boolean>>({ caps: false, endmark: false, spelling: false })
  const [evidence, setEvidence] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const { chatRef } = useAutoScroll(`${phase}-${Object.values(mechanics).join('-')}-${evidence}-${notices.length}`)
  const addNotice = (content: ReactNode) => setNotices((current) => [...current, { id: current.length + 1, content }])
  const complete = phase === 'complete'

  const submitVerification = () => {
    if (MECHANICS_ITEMS.some((item) => !mechanics[item.id]) || !evidence.trim()) {
      setVerificationError('Complete the short book check first. I need evidence from the writing on the page.')
      addNotice('Complete the short book check first. I need evidence from the writing on the page.')
      return
    }
    setVerificationError('')
    setPhase('revision')
    addNotice(<><strong>Now correct your paragraph in the worksheet.</strong><br />Use the two feedback points. Do not rewrite a new paragraph in the app.</>)
  }

  const recordingGuide = <><span className="roundtag">Read exactly what you wrote</span><div className="goal"><strong>Important</strong><ul><li>Read the whole paragraph.</li><li>Do not improve it while reading.</li><li>The book remains the official writing source.</li></ul></div></>
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 6.</strong><br />Read the paragraph you wrote in the worksheet. I’ll use your speech to understand the content, but spelling and punctuation will still be checked from your book.</> },
    ...(phase === 'first' ? [{ id: 'first-recording', type: 'custom' as const, content: <RecordingCard label="First draft" range="Read full paragraph" stage="first-recording" transcript={WRITING_DEMO.first} confirmLabel="Yes, this is right" onConfirm={() => setPhase('first-feedback')}>{recordingGuide}</RecordingCard> }] : []),
    ...(phase === 'first-feedback' ? [{ id: 'first-feedback', type: 'custom' as const, content: <FirstDraftFeedback onContinue={() => setPhase('verify')} /> }] : []),
    ...(phase === 'verify' ? [{ id: 'verification', type: 'custom' as const, content: <TaskPanel title="Book check" subtitle="Spelling & punctuation" data-stage="verification"><div className="transcript"><strong>What I heard</strong>{WRITING_DEMO.first}</div><WritingVerificationChecklist items={MECHANICS_ITEMS} values={mechanics} words={CHECK_WORDS} evidence={evidence} error={verificationError} note="The AI does not assume spelling or punctuation from STT. You verify them from the paragraph you actually wrote." onItemChange={(id, checked) => { setMechanics((current) => ({ ...current, [id]: checked })); setVerificationError('') }} onEvidenceChange={(value) => { setEvidence(value); setVerificationError('') }} onSubmit={submitVerification} /></TaskPanel> }] : []),
    ...(phase === 'revision' ? [{ id: 'revision', type: 'custom' as const, content: <TaskPanel title="Revision checklist" subtitle="Book-first" data-stage="revision"><div className="feedback"><strong>Fix these in the worksheet:</strong><ol><li>Add a clearer detail about the football activity.</li><li>Correct the verb in the final sentence.</li></ol></div><div className="note">When you finish, read the whole revised paragraph again so the first and revised versions can be compared.</div><div className="actions"><ActionButton data-ready onClick={() => setPhase('revised')}>I corrected my book</ActionButton></div></TaskPanel> }] : []),
    ...(phase === 'revised' ? [{ id: 'revised-recording', type: 'custom' as const, content: <RecordingCard label="Revised draft" range="Read full paragraph" stage="revised-recording" transcript={WRITING_DEMO.revised} confirmLabel="Yes, this is right" onConfirm={() => setPhase('revised-feedback')}>{recordingGuide}</RecordingCard> }] : []),
    ...(phase === 'revised-feedback' ? [{ id: 'revised-feedback', type: 'custom' as const, content: <RevisedDraftFeedback onResult={() => { setPhase('complete'); addNotice(<><strong>Well done.</strong><br />You improved the paragraph in your book and proved the improvement with a full revised reading.</>) }} /> }] : []),
    ...notices.map((notice): TaskFlowBlock => ({ id: `notice-${notice.id}`, type: 'tutor-message', content: notice.content })),
    ...(complete ? [{ id: 'complete', type: 'custom' as const, content: <TaskPanel title="Task 6 complete ✓" subtitle="Writing 10/10" variant="summary" data-stage="complete"><RubricRows revised /><div className="note"><strong>Evidence stored:</strong><br />First draft + revised draft + rubric → <strong>WRITE-CONTENT</strong><br />Priority errors + self-correction → <strong>WRITE-LANGUAGE</strong>.</div><div className="note"><MasteryGate mastered>Revised Writing is at least 8/10. Final WS6 mastery also depends on Listening ≥80% and Tasks 3–4 ≥80% without direct answers.</MasteryGate></div></TaskPanel> }] : []),
  ]

  const status = phase === 'first' ? 'First draft • STT' : phase === 'first-feedback' || phase === 'verify' ? 'Check the first draft' : phase === 'revision' ? 'Revise in the book' : phase === 'revised' || phase === 'revised-feedback' ? 'Revised draft • STT' : 'Writing mastery reached'
  return <TaskRenderer task={task} className="task-60166" chatRef={chatRef} footer={<StatusFooter title={complete ? 'WS6 complete' : 'Task 6'} status={status} actionLabel="Finish WS6" actionId="finishBtn" disabled={!complete} onAction={() => addNotice('Great work. You completed WS6.')} />} blocks={blocks} />
}

function FirstDraftFeedback({ onContinue }: { onContinue: () => void }) {
  return <TaskPanel title="First draft" subtitle="Writing feedback" data-stage="first-feedback"><div className="transcript"><strong>What I heard</strong>{WRITING_DEMO.first}</div><RubricRows /><div className="feedback"><strong>One success</strong><br />You named your school and described the facilities clearly.<ol><li>Add a clearer detail about where students play football.</li><li>Check the verb in “my teachers is friendly”.</li></ol></div><div className="actions"><ActionButton variant="secondary" data-book onClick={onContinue}>Check the book</ActionButton><ActionButton data-next onClick={onContinue}>Continue</ActionButton></div></TaskPanel>
}

function RevisedDraftFeedback({ onResult }: { onResult: () => void }) {
  return <TaskPanel title="Revised draft" subtitle="Writing comparison" data-stage="revised-feedback"><div className="transcript"><strong>What I heard</strong>{WRITING_DEMO.revised}</div><DraftComparison versions={[{ id: 'first', label: 'First draft', text: WRITING_DEMO.first }, { id: 'revised', label: 'Revised draft', text: WRITING_DEMO.revised }]} /><RubricRows revised /><ScoreGrid items={[{ id: 'first', label: 'First draft', value: '8/10' }, { id: 'revised', label: 'Revised draft', value: '10/10', tone: 'success' }]} /><div className="actions"><ActionButton variant="success" data-result onClick={onResult}>See result</ActionButton></div></TaskPanel>
}

function RubricRows({ revised = false }: { revised?: boolean }) {
  const rows = [['Task achievement', '2/2'], ['Organisation', '2/2'], ['Vocabulary', '2/2'], ['Grammar', revised ? '2/2' : '1/2'], ...(revised ? [['Spelling & punctuation', '2/2 verified']] : [])]
  return <div className="checks">{rows.map(([label, value]) => <div className="checkrow" key={label}><span>{label}</span><StatusTag tone={!revised && label === 'Grammar' ? 'warning' : 'success'}>{value}</StatusTag></div>)}</div>
}
