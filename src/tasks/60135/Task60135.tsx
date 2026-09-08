import { useState } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { ProgressSteps } from '../../components/progress/ProgressSteps'
import { RecordingCard } from '../../components/recording/RecordingCard'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { SENTENCES_60135 } from './data'
import './task.css'

export function Task60135({ task }: TaskComponentProps) {
  const [index, setIndex] = useState(0)
  const [retry, setRetry] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [captured, setCaptured] = useState<Array<{ text: string; frequency: string }>>([])
  const [phase, setPhase] = useState<'capture' | 'overall' | 'complete'>('capture')
  const [notices, setNotices] = useState<string[]>([])
  const current = SENTENCES_60135[index]
  const transcript = retry && !current.valid ? current.fixed! : current.spoken
  const { chatRef } = useAutoScroll(`${index}-${retry}-${reviewed}-${phase}-${notices.length}`)

  const useSentence = () => {
    const next = [...captured, { text: transcript, frequency: current.frequency }]
    setCaptured(next); setReviewed(false); setRetry(false)
    if (index === SENTENCES_60135.length - 1) { setPhase('overall'); setNotices((value) => [...value, '4 sentences captured ✓ Now I’ll check the whole Task 5.']) }
    else { setIndex((value) => value + 1); setNotices((value) => [...value, 'Good. Now read the next sentence from your worksheet.']) }
  }

  const captureBlock: TaskFlowBlock | null = phase !== 'capture' ? null : {
    id: `capture-${index}-${retry}-${reviewed}`, type: 'custom', content: !reviewed ? (
      <RecordingCard key={`${index}-${retry}`} label={retry ? 'Read the corrected sentence' : `Read sentence ${index + 1}`} range={`${index + 1} / 4`} stage="capture" dataSentence={index + 1} dataRetry={retry} transcript={transcript} confirmLabel="Yes, check it" onTranscriptRetry={() => setNotices((value) => [...value, 'No problem. Read the same sentence once more.'])} onConfirm={() => setReviewed(true)}>
        <ProgressSteps steps={SENTENCES_60135.map((_, itemIndex) => ({ id: String(itemIndex), label: `Sentence ${itemIndex + 1}`, status: itemIndex < index ? 'complete' : itemIndex === index ? 'active' : 'pending' }))} />
        <div className="prompt">{retry ? 'Read the corrected sentence from your worksheet.' : `Look at your worksheet and read sentence ${index + 1}.`}</div>
        <div className="helper">{index === 3 ? 'This sentence should be about “my friend”.' : 'This sentence should be about yourself.'}</div>
      </RecordingCard>
    ) : (
      <section className="card language-review" data-stage="capture" data-sentence={index + 1} data-retry={String(retry)}>
        <div className="ch"><h2>Language check</h2><span>{index + 1} / 4</span></div><div className="cb"><div className="transcript"><strong>What I heard</strong>{transcript}</div>
        {current.valid || retry ? <><div className="gate ok"><strong>Grammar check ✓</strong><br />Frequency word: <b>{current.frequency}</b><br />Position: correct<br />Present simple: clear</div><div className="actions"><ActionButton variant="secondary" data-again onClick={() => setReviewed(false)}>🎙 Record again</ActionButton><ActionButton variant="success" data-confirm onClick={useSentence}>Use this sentence</ActionButton></div></> : <><div className="gate warn"><strong>One grammar point needs checking.</strong><br />I heard: <em>{current.spoken}</em></div><div className="repair">Before I call this a writing error, compare the transcript with your worksheet.<div className="quote">Did you write <strong>{current.spoken}</strong>?</div></div><div className="actions"><ActionButton variant="secondary" data-asr onClick={() => { setReviewed(false); setNotices((value) => [...value, 'No problem. Read the same sentence once more.']) }}>No, app heard me wrong</ActionButton><ActionButton data-written onClick={() => { setRetry(true); setReviewed(false); setNotices((value) => [...value, `Check the frequency-word position. ${current.repair} Fix it in your worksheet, then read the corrected sentence.`]) }}>Yes, I wrote this</ActionButton></div></>}
        </div>
      </section>
    ),
  }

  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 5.</strong><br />Read the four sentences you wrote in your worksheet. I’ll help you check the language.</> },
    ...notices.map((notice, noticeIndex): TaskFlowBlock => ({ id: `notice-${noticeIndex}`, type: 'tutor-message', content: notice })),
    ...(captureBlock ? [captureBlock] : []),
    ...(phase === 'overall' ? [{ id: 'overall', type: 'panel' as const, title: 'Task 5 language check', subtitle: '4 sentences', stage: 'overall', content: <><div className="transcript"><strong>Your 4 sentences</strong>{captured.map((item, itemIndex) => <div key={item.text}>{itemIndex + 1}. {item.text}</div>)}</div><div className="checklist">{['4 sentences completed','3 sentences about yourself','1 sentence about “my friend”','At least 3 different frequency words','Present-simple forms','Frequency-word position','Sentences understandable'].map((label) => <div className="item" key={label}><span>{label}</span><StatusTag tone="success">Yes ✓</StatusTag></div>)}</div><div className="note">Speech-to-text can support grammar checking, but it cannot reliably inspect handwriting, spelling or punctuation on the page.</div><div className="repair"><strong>Book self-check</strong><br />□ Capital letter<br />□ Spelling<br />□ Full stop</div><div className="actions"><ActionButton variant="secondary" data-review onClick={() => setNotices((value) => [...value, 'Compare the transcripts with the sentences in your worksheet. Your worksheet is the source if the app heard something differently.'])}>Review transcripts</ActionButton><ActionButton variant="success" data-done onClick={() => setPhase('complete')}>I checked my book</ActionButton></div></> }] : []),
    ...(phase === 'complete' ? [{ id: 'complete', type: 'panel' as const, title: 'Task 5 complete ✓', subtitle: 'Grammar in Use', variant: 'summary' as const, stage: 'complete', content: <>{[['Personal sentences','4 / 4 ✓'],['Frequency words','3+ types ✓'],['Present simple','Clear ✓'],['Adverb position','Clear ✓'],['Book self-check','Done ✓']].map(([label, value]) => <div className="summary-row" key={label}><span>{label}</span><StatusTag tone="success">{value}</StatusTag></div>)}</> }, { id: 'complete-message', type: 'tutor-message' as const, content: <><strong>Nice work ✓</strong><br />You wrote, checked and read your four sentences. Next: Task 6.</> }] : []),
  ]

  return <TaskRenderer task={task} className="task-60135 language-capture-task" chatRef={chatRef} footer={<StatusFooter title={phase === 'complete' ? 'Task 5 complete' : 'Task 5'} status={phase === 'complete' ? 'Continue to Task 6.' : phase === 'capture' ? `Sentence ${index + 1} of 4` : 'Whole-task check'} actionLabel="Back to book" actionId="backBook" disabled={phase !== 'complete'} onAction={() => setNotices((value) => [...value, 'Keep going. I’ll be here when you need me.'])} />} blocks={blocks} />
}
