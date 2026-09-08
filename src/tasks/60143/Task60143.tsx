import { useState } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { ProgressSteps } from '../../components/progress/ProgressSteps'
import { GuidedIndependentStatus } from '../../components/progress/GuidedIndependentStatus'
import { RepairRecordingFlow } from '../../components/recording/RepairRecordingFlow'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { DIALOGUE_TURNS_60143 } from './data'
import './task.css'

export function Task60143({ task }: TaskComponentProps) {
  const [turnIndex, setTurnIndex] = useState(0)
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [complete, setComplete] = useState(false)
  const [guided, setGuided] = useState<boolean[]>(DIALOGUE_TURNS_60143.map(() => false))
  const [notices, setNotices] = useState<string[]>([])
  const [finishNotices, setFinishNotices] = useState(0)
  const { chatRef } = useAutoScroll(`${turnIndex}-${attempt}-${complete}-${notices.length}-${finishNotices}`)
  const turn = DIALOGUE_TURNS_60143[turnIndex]

  const advance = () => {
    if (turnIndex === DIALOGUE_TURNS_60143.length - 1) { setComplete(true); return }
    setTurnIndex((value) => value + 1)
    setAttempt(1)
    setNotices((current) => [...current, 'Good. Now read the next turn from your worksheet.'])
  }

  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 3.</strong><br />Keep your worksheet open. Read each line of the dialogue you wrote. I’ll check whether each turn does the right job.</> },
    ...notices.map((notice, index): TaskFlowBlock => ({ id: `notice-${index}`, type: 'tutor-message', content: notice })),
    ...(!complete ? [{ id: `turn-${turnIndex}-${attempt}`, type: 'custom' as const, content: <RepairRecordingFlow key={`${turnIndex}-${attempt}`} title={`${turn.role} • Turn ${turnIndex + 1}`} subtitle={`${turnIndex + 1}/4`} stage="turn" retry={attempt > 1} dataTurn={turnIndex + 1} dataAttempt={attempt} transcript={attempt === 1 ? turn.first : turn.retry} correct={attempt > 1 || turn.correct} beforeRecording={<><ProgressSteps steps={DIALOGUE_TURNS_60143.map((_, index) => ({ id: String(index), label: `Turn ${index + 1}`, status: index < turnIndex ? 'complete' : index === turnIndex ? 'active' : 'pending' }))} /><div className="function">{turn.function}</div><div className="prompt">{attempt === 1 ? 'Read the line you wrote in your worksheet.' : 'Read your corrected line from the worksheet.'}</div><div className="helper">Do not type it again. Just read your own sentence.</div></>} successMessage={<><strong>Function check ✓</strong><br />This turn does the right job: <b>{turn.function}</b>.</>} repairCue={<><strong>One function needs fixing.</strong><br />{turn.cue}<div className="repair" data-repair><strong>Fix it in your worksheet.</strong><br />{turn.cue}<br /><br />Then read the corrected line once more.</div></>} model={turn.model} modelGuidedNote="This turn will be marked Guided." nextLabel="Use this turn" completeAction="use" onTranscriptRetry={() => setNotices((current) => [...current, 'No problem. Read the same line again.'])} onModelShown={() => setGuided((current) => current.map((value, index) => index === turnIndex ? true : value))} onRepair={() => { setAttempt(2); setNotices((current) => [...current, `Try Turn ${turnIndex + 1} again.`]) }} onComplete={advance} /> }] : []),
    ...(complete ? [
      { id: 'complete', type: 'panel' as const, title: 'Task 3 complete ✓', subtitle: 'Supported Dialogue', variant: 'summary' as const, stage: 'complete', content: <>{DIALOGUE_TURNS_60143.map((item, index) => <div className="result" key={item.function}><span>Turn {index + 1} • {item.function}</span><GuidedIndependentStatus mode={guided[index] ? 'guided' : 'independent'} /></div>)}<div className="note">The app checks whether each spoken line fulfils its communicative function. A turn shown by the model is recorded as Guided.</div></> },
      { id: 'complete-message', type: 'tutor-message' as const, content: <><strong>Dialogue ready ✓</strong><br />You built and checked all four turns. Next, you’ll use the language in an AI role-play.</> },
    ] : []),
    ...Array.from({ length: finishNotices }, (_, index): TaskFlowBlock => ({ id: `finish-${index}`, type: 'tutor-message', content: 'Keep going. Task 4 is the role-play.' })),
  ]

  return <TaskRenderer task={task} className="task-60143 dialogue-recording-task" chatRef={chatRef} footer={<StatusFooter title={complete ? 'Task 3 complete' : 'Task 3'} status={complete ? 'Continue to Task 4.' : `Turn ${turnIndex + 1} of 4`} actionLabel="Back to book" actionId="backBook" disabled={!complete} onAction={() => setFinishNotices((value) => value + 1)} />} blocks={blocks} />
}
