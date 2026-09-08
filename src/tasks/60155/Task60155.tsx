import { useState } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { RecordingCard } from '../../components/recording/RecordingCard'
import { MasteryGate } from '../../components/progress/MasteryGate'
import { ScoreGrid } from '../../components/progress/ScoreGrid'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { TaskPanel } from '../../components/task/TaskPanel'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { SPEAKING_DEMO, type SpeakingPhase } from './data'
import './task.css'

export function Task60155({ task }: TaskComponentProps) {
  const [phase, setPhase] = useState<SpeakingPhase>('first')
  const [finishNotices, setFinishNotices] = useState(0)
  const { chatRef } = useAutoScroll(`${phase}-${finishNotices}`)
  const complete = phase === 'complete'
  const status = phase === 'follow' || phase === 'follow-feedback' ? 'Round 2 • Follow-up' : phase === 'revised' || phase === 'revised-feedback' ? 'Re-record full answer' : complete ? 'Speaking mastery reached' : 'Round 1 • My Choice'

  const blocks: TaskFlowBlock[] = [
    { id: 'intro-message', type: 'tutor-message', content: <><strong>Task 5.</strong><br />Use your notes from Task 4. First, tell me which school you would like to go to and why.</> },
    { id: 'intro', type: 'panel', title: 'Round 1 • My Choice', subtitle: 'Speaking', stage: 'intro', content: <><span className="roundtag">30–45 seconds</span><div className="goal"><strong>Your talk should include:</strong><ul><li>the school name</li><li>two reasons</li><li>one activity you would like to do</li></ul></div><div className="note">Keep your worksheet open. Use your notes as prompts, not as a script.</div></> },
    { id: 'first-question', type: 'tutor-message', content: <>Which school would you like to go to?</>, speechText: 'Which school would you like to go to?' },
    ...(phase === 'first' ? [{ id: 'first-recording', type: 'custom' as const, content: <RecordingCard label="Your first recording" range="30–45s" stage="first-recording" transcript={SPEAKING_DEMO.first} onConfirm={() => setPhase('first-feedback')} /> }] : []),
    ...(phase === 'first-feedback' ? [{ id: 'first-feedback', type: 'custom' as const, content: <FirstFeedback onContinue={() => setPhase('follow')} /> }] : []),
    ...(phaseAtLeast(phase, 'follow') ? [{ id: 'follow-question', type: 'tutor-message' as const, content: <>You said you like art. What would you like to do at Green World School?</>, speechText: 'You said you like art. What would you like to do at Green World School?' }] : []),
    ...(phase === 'follow' ? [{ id: 'follow-recording', type: 'custom' as const, content: <RecordingCard label="Answer the follow-up" range="5–15s" stage="follow-recording" transcript={SPEAKING_DEMO.follow} onConfirm={() => setPhase('follow-feedback')} /> }] : []),
    ...(phase === 'follow-feedback' ? [{ id: 'follow-feedback', type: 'custom' as const, content: <FollowFeedback onContinue={() => setPhase('revision-ready')} /> }] : []),
    ...(phaseAtLeast(phase, 'revision-ready') ? [{ id: 'revision-message', type: 'tutor-message' as const, content: <><strong>Now improve your whole talk.</strong><br />Record the full 30–45 second answer again. Use the two feedback points, not just one corrected sentence.</> }] : []),
    ...(phase === 'revision-ready' ? [{ id: 'revision-ready', type: 'custom' as const, content: <RevisionReady onReady={() => setPhase('revised')} /> }] : []),
    ...(phase === 'revised' ? [{ id: 'revised-recording', type: 'custom' as const, content: <RecordingCard label="Revised recording" range="30–45s" stage="revised-recording" transcript={SPEAKING_DEMO.revised} onConfirm={() => setPhase('revised-feedback')} /> }] : []),
    ...(phase === 'revised-feedback' ? [{ id: 'revised-feedback', type: 'custom' as const, content: <RevisedFeedback onResult={() => setPhase('complete')} /> }] : []),
    ...(complete ? [
      { id: 'complete', type: 'custom' as const, content: <CompleteSummary /> },
      { id: 'complete-message', type: 'tutor-message' as const, content: <><strong>Well done.</strong><br />Your revised talk is clearer and more complete. WS5 is finished.</> },
    ] : []),
    ...Array.from({ length: finishNotices }, (_, index): TaskFlowBlock => ({ id: `finish-${index}`, type: 'tutor-message', content: <>Great work. You completed WS5.</> })),
  ]

  return <TaskRenderer task={task} className="task-60155" chatRef={chatRef} footer={<StatusFooter title={complete ? 'WS5 complete' : 'Task 5'} status={status} actionLabel="Finish WS5" actionId="finishBtn" disabled={!complete} onAction={() => setFinishNotices((value) => value + 1)} />} blocks={blocks} />
}

const PHASES: SpeakingPhase[] = ['first', 'first-feedback', 'follow', 'follow-feedback', 'revision-ready', 'revised', 'revised-feedback', 'complete']
function phaseAtLeast(current: SpeakingPhase, target: SpeakingPhase) { return PHASES.indexOf(current) >= PHASES.indexOf(target) }

function FirstFeedback({ onContinue }: { onContinue: () => void }) { return <TaskPanel title="Your first recording" subtitle="30–45s" data-stage="first-recording"><div className="transcript"><strong>What I heard</strong>{SPEAKING_DEMO.first}</div><div className="checks"><Check label="School named" value="Yes ✓" /><Check label="Reason 1" value="Yes ✓" /><Check label="Reason 2" value="Needs work" warn /><Check label="Activity" value="Not clear" warn /><Check label="Clarity" value="Clear enough ✓" /></div><div className="feedback"><strong>Good start.</strong><br />I’ll give you only two priority points:<ol><li>Add one more clear reason why this school is good for you.</li><li>Say the activity you would like to do using a full idea.</li></ol></div><div className="actions"><ActionButton variant="secondary" className="btn secondary" data-review onClick={(event) => event.currentTarget.closest('.cb')?.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth' })}>Review</ActionButton><ActionButton className="btn primary" data-next onClick={onContinue}>Continue</ActionButton></div></TaskPanel> }
function FollowFeedback({ onContinue }: { onContinue: () => void }) { return <TaskPanel title="Answer the follow-up" subtitle="5–15s" data-stage="follow-recording"><div className="transcript"><strong>What I heard</strong>{SPEAKING_DEMO.follow}</div><div className="checks"><Check label="Answers the AI question" value="Yes ✓" /><Check label="Relevant content" value="Yes ✓" /><Check label="Clarity" value="Clear enough ✓" /></div><div className="actions"><ActionButton variant="success" className="btn success" data-next onClick={onContinue}>Continue</ActionButton></div></TaskPanel> }
function RevisionReady({ onReady }: { onReady: () => void }) { return <TaskPanel title="Before you record again" subtitle="Revision" data-stage="revision-ready"><div className="feedback"><strong>Remember:</strong><ol><li>Add a second clear reason.</li><li>Say one activity you would like to do.</li></ol></div><div className="note">Your first recording is kept so you can compare it with the revised one.</div><div className="actions"><ActionButton className="btn primary" data-ready onClick={onReady}>I’m ready</ActionButton></div></TaskPanel> }
function RevisedFeedback({ onResult }: { onResult: () => void }) { return <TaskPanel title="Revised recording" subtitle="30–45s" data-stage="revised-recording"><div className="transcript"><strong>What I heard</strong>{SPEAKING_DEMO.revised}</div><div className="checks"><Check label="School + two reasons + activity" value="Complete ✓" /><Check label="Relevant content" value="2/2" /><Check label="Vocabulary & grammar" value="2/2" /><Check label="Clarity / intelligibility" value="2/2" /><Check label="Follow-up response" value="2/2" /></div><ScoreGrid items={[{ id: 'first', value: '6/10', label: 'First recording' }, { id: 'revised', value: '9/10', label: 'Revised recording', tone: 'success' }]} /><div className="actions"><ActionButton variant="success" className="btn success" data-result onClick={onResult}>See result</ActionButton></div></TaskPanel> }
function Check({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className="checkrow"><span>{label}</span><StatusTag tone={warn ? 'warning' : 'success'}>{value}</StatusTag></div> }
function CompleteSummary() { return <TaskPanel title="Task 5 complete ✓" subtitle="9/10" variant="summary" data-stage="complete"><div className="result"><span>Task achievement</span><StatusTag tone="success">2/2</StatusTag></div><div className="result"><span>Relevant content</span><StatusTag tone="success">2/2</StatusTag></div><div className="result"><span>Vocabulary &amp; grammar</span><StatusTag tone="success">2/2</StatusTag></div><div className="result"><span>Clarity / intelligibility</span><StatusTag tone="success">2/2</StatusTag></div><div className="result"><span>Response to follow-up</span><StatusTag tone="success">1/2</StatusTag></div><div className="note"><MasteryGate mastered>Speaking is at least 8/10, and the revised talk includes the school choice and two reasons. Both first and revised recordings are stored.</MasteryGate></div></TaskPanel> }
