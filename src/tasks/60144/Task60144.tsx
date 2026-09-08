import { useState } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { MasteryGate } from '../../components/progress/MasteryGate'
import { GuidedIndependentStatus } from '../../components/progress/GuidedIndependentStatus'
import { RepairRecordingFlow } from '../../components/recording/RepairRecordingFlow'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { StatusTag } from '../../components/task/StatusTag'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { ROLEPLAY_STAGES_60144, type RoleplayStage60144 } from './data'
import './task.css'

export function Task60144({ task }: TaskComponentProps) {
  const [stage, setStage] = useState<RoleplayStage60144 | 'complete'>('greet')
  const [retry, setRetry] = useState(false)
  const [guided, setGuided] = useState(false)
  const [doneNotices, setDoneNotices] = useState(0)
  const complete = stage === 'complete'
  const current = complete ? null : ROLEPLAY_STAGES_60144[stage]
  const { chatRef } = useAutoScroll(`${stage}-${retry}-${doneNotices}`)

  const advance = () => {
    setRetry(false)
    if (stage === 'greet') setStage('question')
    else if (stage === 'question') setStage('introduce')
    else setStage('complete')
  }

  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 4.</strong><br />Two short speaking rounds. Read my messages, listen if you want, then answer by speaking.</> },
    ...(stage === 'greet' ? [{ id: 'round1', type: 'panel' as const, title: 'Round 1 • Respond', subtitle: '1 / 2', content: <><span className="round-tag">RESPOND + ASK</span><div className="note">Greet Sam after the AI introduces Sam to you. Then ask Sam one suitable question.</div></> }, { id: 'ai-greet', type: 'tutor-message' as const, content: 'Hi! This is Sam, my new classmate.', speechText: 'Hi! This is Sam, my new classmate.' }] : []),
    ...(stage === 'question' ? [{ id: 'ai-question', type: 'tutor-message' as const, content: 'Nice to meet you, too.', speechText: 'Nice to meet you, too.' }] : []),
    ...(stage === 'introduce' ? [{ id: 'round2', type: 'panel' as const, title: 'Round 2 • Introduce', subtitle: '2 / 2', content: <><span className="round-tag">INTRODUCE</span><div className="cardface"><div className="big">AN</div><div className="small">NEW CLASSMATE • CLASS 6A</div></div><div className="note">Use the card to introduce An to the AI.</div></> }, { id: 'ai-intro', type: 'tutor-message' as const, content: 'Who is with you?', speechText: 'Who is with you?' }] : []),
    ...(!complete && current ? [{ id: `record-${stage}-${retry}`, type: 'custom' as const, content: <RepairRecordingFlow key={`${stage}-${retry}`} title="Your turn" subtitle={current.label} stage={stage} retry={retry} transcript={retry ? current.good : current.bad} correct={retry} successMessage={<><strong>{stage === 'question' ? 'Question check' : 'Function check'} ✓</strong><br />{current.success}</>} repairCue={<><strong>{stage === 'question' ? 'Question cue' : 'Function cue'}</strong><br />{current.cue}</>} model={current.good} modelLabel={stage === 'question' ? 'Need an example' : 'Need a model'} modelGuidedNote="This task will be marked Guided." nextLabel={current.next} onModelShown={() => setGuided(true)} onRepair={() => setRetry(true)} onComplete={advance} /> }] : []),
    ...(complete ? [
      { id: 'complete', type: 'panel' as const, title: 'Task 4 complete ✓', subtitle: guided ? 'Guided completion' : '10/10', variant: 'summary' as const, stage: 'complete', content: <><div className="result"><span>Learning mode</span><GuidedIndependentStatus mode={guided ? 'guided' : 'independent'} /></div>{[['Introduce someone','2/2'],['Greet & respond','2/2'],['Suitable question','2/2'],['Speech clarity','2/2'],['Target language','1/1'],['Turn-taking','1/1']].map(([label,value]) => <div className="result" key={label}><span>{label}</span><StatusTag tone="success">{value}</StatusTag></div>)}<div className="metrics"><div className="metric"><strong>First recordings</strong><span>Stored</span></div><div className="metric"><strong>Corrected recordings</strong><span>Stored</span></div></div><div className="note">Clarity means “clear enough to understand”. Model-supported work is recorded as Guided and does not count as independent mastery.</div></> },
      { id: 'mastery', type: 'tutor-message' as const, content: <MasteryGate mastered={!guided} title={guided ? 'Guided completion' : 'Mastery reached ✓'}>{guided ? 'You completed the role-play with model support. Practise it again independently to reach mastery.' : 'You responded to an introduction and introduced another person successfully.'}</MasteryGate> },
    ] : []),
    ...Array.from({ length: doneNotices }, (_, index): TaskFlowBlock => ({ id: `done-${index}`, type: 'tutor-message', content: 'Great work. WS4 is complete.' })),
  ]

  return <TaskRenderer task={task} className="task-60144 dialogue-recording-task" chatRef={chatRef} footer={<StatusFooter title={complete ? guided ? 'Task 4 guided' : 'Task 4 mastered' : 'Task 4'} status={complete ? guided ? 'Completed with model support' : '8/10+ with both essential functions' : stage === 'introduce' ? 'Round 2 of 2' : 'Round 1 of 2'} actionLabel="Finish" actionId="doneBtn" disabled={!complete} onAction={() => setDoneNotices((value) => value + 1)} />} blocks={blocks} />
}
