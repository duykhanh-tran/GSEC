import { useState, type ReactNode } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { GuidedIndependentStatus } from '../../components/progress/GuidedIndependentStatus'
import { ProgressSteps } from '../../components/progress/ProgressSteps'
import { RepairRecordingFlow } from '../../components/recording/RepairRecordingFlow'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { saveTaskAttempt } from '../../lib/taskAttemptService'
import { SENTENCE_CHECK_ITEMS } from './data'

interface Notice { id: number; content: ReactNode }

export function Task60163({ task }: TaskComponentProps) {
  const [index, setIndex] = useState(0)
  const [attempt, setAttempt] = useState(1)
  const [guided, setGuided] = useState<boolean[]>(SENTENCE_CHECK_ITEMS.map(() => false))
  const [complete, setComplete] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const { chatRef } = useAutoScroll(`${index}-${attempt}-${complete}-${notices.length}`)
  const item = SENTENCE_CHECK_ITEMS[index]
  const addNotice = (content: ReactNode) => setNotices((current) => [...current, { id: current.length + 1, content }])

  const nextSentence = () => {
    if (index < SENTENCE_CHECK_ITEMS.length - 1) {
      setIndex((value) => value + 1)
      setAttempt(1)
      addNotice('Good. Now read the next sentence from your worksheet.')
    } else {
      setComplete(true)
      const independent = guided.filter((value) => !value).length
      const score = Math.round((independent / SENTENCE_CHECK_ITEMS.length) * 100)
      const finalScore = independent === 5 ? 100 : Math.max(score, 75)

      saveTaskAttempt({
        taskCode: task.code,
        score: finalScore,
        firstScore: score,
        status: 'completed',
        supportMode: independent === 5 ? 'INDEPENDENT' : 'GUIDED',
      })

      addNotice(<><strong>Task 3 complete.</strong><br />{independent === 5 ? 'All five sentences were completed independently.' : 'Guided sentences can be reviewed later.'} Back to your book for Task 4.</>)
    }
  }

  const progress = SENTENCE_CHECK_ITEMS.map((_, itemIndex) => ({ id: String(itemIndex + 1), label: `Sentence ${itemIndex + 1}`, status: itemIndex < index || complete ? 'complete' as const : itemIndex === index ? 'active' as const : 'pending' as const }))
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 3.</strong><br />Write the five sentences in your worksheet first. Then read each sentence aloud so I can check the sentence order.</> },
    ...notices.map((notice): TaskFlowBlock => ({ id: `notice-${notice.id}`, type: 'tutor-message', content: notice.content })),
    ...(!complete ? [{ id: `sentence-${index}-${attempt}`, type: 'custom' as const, content: <RepairRecordingFlow title={`Sentence ${index + 1}`} subtitle={`${index + 1}/5`} stage="sentence-recording" retry={attempt > 1} dataTurn={index + 1} dataAttempt={attempt} transcript={attempt === 1 ? item.first : item.fixed} correct={attempt > 1 || item.correct} beforeRecording={<><ProgressSteps steps={progress} ariaLabel="Sentence progress" variant="segments" /><div className="type-tag">{item.type}</div><div className="prompt">{attempt === 1 ? 'Read the sentence you wrote in your worksheet.' : 'Read your corrected sentence from the worksheet.'}</div><div className="helper">This is a sentence-order check, not a pronunciation score.</div></>} successMessage={<><strong>Sentence order ✓</strong><br />The sentence structure is correct.</>} repairCue={<><strong>One structure needs fixing.</strong><br />{item.cue}<br /><br /><strong>Fix it in your worksheet.</strong> Then read the corrected sentence again.</>} model={item.model} modelGuidedNote="This sentence will be marked Guided." nextLabel="Use this sentence" completeAction="use" onTranscriptRetry={() => addNotice('No problem. Read the same sentence again.')} onModelShown={() => setGuided((current) => current.map((value, itemIndex) => itemIndex === index ? true : value))} onRepair={() => { setAttempt(2); addNotice(<>Try <strong>Sentence {index + 1}</strong> again.</>) }} onComplete={nextSentence} /> }] : []),
    ...(complete ? [{ id: 'complete', type: 'panel' as const, title: 'Task 3 complete ✓', subtitle: 'Sentence Building', variant: 'summary' as const, stage: 'complete', content: <>{SENTENCE_CHECK_ITEMS.map((sentence, itemIndex) => <div className="result" key={sentence.type}><span>Sentence {itemIndex + 1} • {sentence.type}</span><GuidedIndependentStatus mode={guided[itemIndex] ? 'guided' : 'independent'} /></div>)}<div className="note">Evidence stored as <strong>WRITE-SENTENCE</strong>. STT is only used to capture the sentence you wrote; pronunciation is not scored.</div></> }] : []),
  ]

  return <TaskRenderer task={task} disableAutoSave={true} className="task-60163" chatRef={chatRef} footer={<StatusFooter title={complete ? 'Task 3 complete' : 'Task 3'} status={complete ? 'Continue to Task 4.' : `Sentence ${index + 1} of 5`} actionLabel="Back to book" actionId="backBook" disabled={!complete} onAction={() => addNotice('Keep going. Task 4 is about paragraph organisation.')} />} blocks={blocks} />
}
