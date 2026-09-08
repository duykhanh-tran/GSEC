import { useState, type ReactNode } from 'react'

import type { TaskComponentProps } from '../../app/task-types'
import { GuidedIndependentStatus } from '../../components/progress/GuidedIndependentStatus'
import { SequenceOrderInput } from '../../components/ordering/SequenceOrderInput'
import { SequenceRepairPanel } from '../../components/ordering/SequenceRepairPanel'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { useTaskTimers } from '../../hooks/useTaskTimers'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { SequenceValue, TaskFlowBlock } from '../../task-engine/schema'
import { PARAGRAPH_LINK_HINTS, PARAGRAPH_ORDER_KEY } from './data'

interface Notice { id: number; content: ReactNode }

export function Task60164({ task }: TaskComponentProps) {
  const [order, setOrder] = useState<(number | null)[]>([4, null, null, null, null])
  const [selectedSlot, setSelectedSlot] = useState<string | number | null>(1)
  const [entryVisible, setEntryVisible] = useState(true)
  const [checkedOrder, setCheckedOrder] = useState<(number | null)[] | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [feedback, setFeedback] = useState('')
  const [guided, setGuided] = useState(false)
  const [modelVisible, setModelVisible] = useState(false)
  const [complete, setComplete] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const schedule = useTaskTimers()
  const { chatRef } = useAutoScroll(`${order.join('-')}-${attempt}-${feedback}-${complete}-${notices.length}`)
  const addNotice = (content: ReactNode) => setNotices((current) => [...current, { id: current.length + 1, content }])
  const firstWrong = () => order.findIndex((value, index) => index > 0 && value !== PARAGRAPH_ORDER_KEY[index])

  const place = (value: SequenceValue) => {
    if (typeof selectedSlot !== 'number' || typeof value !== 'number') return
    setOrder((current) => current.map((item, index) => index === selectedSlot ? value : item))
    const next = order.findIndex((item, index) => index > selectedSlot && item === null)
    if (next !== -1) setSelectedSlot(next)
  }

  const finish = (guidedResult = guided) => {
    setOrder([...PARAGRAPH_ORDER_KEY])
    setComplete(true)
    setFeedback('')
    addNotice(<><strong>Task 4 complete.</strong><br />{guidedResult ? 'Review how the sentences connect before Task 5.' : 'You organised the paragraph independently.'} Back to your book for Task 5.</>)
  }

  const checkOrder = () => {
    if (order.some((value) => value === null)) { addNotice('Complete all five positions first.'); return }
    setEntryVisible(false)
    setCheckedOrder([...order])
    if (order.every((value, index) => value === PARAGRAPH_ORDER_KEY[index])) { finish(); return }
    setAttempt(1)
    addNotice('The paragraph order is not complete yet. Let’s repair it by following the links between sentences.')
  }

  const chooseRepair = (raw: string) => {
    const position = firstWrong()
    if (position < 0 || feedback) return
    const value = Number(raw)
    if (value === PARAGRAPH_ORDER_KEY[position]) {
      setFeedback('Good link ✓')
      const nextOrder = order.map((item, index) => index === position ? value : index > 0 && item === value ? null : item)
      setOrder(nextOrder)
      schedule(() => {
        if (nextOrder.every((item, index) => item === PARAGRAPH_ORDER_KEY[index])) finish()
        else { setFeedback(''); setAttempt(1) }
      }, 650)
    } else {
      setFeedback('Not yet.')
      schedule(() => {
        setFeedback('')
        setAttempt((current) => current + 1)
        addNotice(attempt === 1 ? 'Look again at how the ideas connect from one sentence to the next.' : 'Try one final time. If you show the model, this task will be Guided.')
      }, 650)
    }
  }

  const activePosition = firstWrong()
  const activeHint = activePosition > 0 ? PARAGRAPH_LINK_HINTS[activePosition] : null
  const slots = order.map((value, index) => ({ id: index, label: index + 1, value, fixed: index === 0 }))
  const blocks: TaskFlowBlock[] = [
    { id: 'intro', type: 'tutor-message', content: <><strong>Task 4.</strong><br />Arrange the paragraph in your worksheet first. Sentence 4 is already first. Then enter your order here.</> },
    ...(entryVisible ? [{ id: 'entry', type: 'panel' as const, title: 'Your paragraph order', subtitle: '5 sentences', stage: 'entry', content: <><SequenceOrderInput slots={slots} choices={[1, 2, 3, 5]} selectedSlotId={selectedSlot} onSelectSlot={setSelectedSlot} onPlace={place} /><div className="actions"><ActionButton variant="secondary" data-demo onClick={() => { setOrder([4, 5, 2, 1, 3]); setSelectedSlot(1) }}>Demo</ActionButton><ActionButton data-check onClick={checkOrder}>Check order</ActionButton></div><div className="note">The full sentences stay in your worksheet. The app only records the sequence and helps you notice links between sentences.</div></> }] : []),
    ...(checkedOrder ? [{ id: 'results', type: 'panel' as const, title: 'Task 4 check', subtitle: complete ? 'Correct' : 'Needs repair', stage: 'results', content: <>{checkedOrder.map((value, index) => <div className="result" key={index}><span>Position {index + 1}</span><StatusTag tone={value === PARAGRAPH_ORDER_KEY[index] ? 'success' : 'error'}>{value === PARAGRAPH_ORDER_KEY[index] ? 'Correct ✓' : 'Check link'}</StatusTag></div>)}</> }] : []),
    ...notices.map((notice): TaskFlowBlock => ({ id: `notice-${notice.id}`, type: 'tutor-message', content: notice.content })),
    ...(!complete && checkedOrder && activePosition > 0 && activeHint ? [{ id: `repair-${activePosition}-${attempt}`, type: 'custom' as const, content: <SequenceRepairPanel title={`Position ${activePosition + 1}`} tag="WRITE-COHESION" cue={<>Look at the sentences in your worksheet around <strong>position {activePosition + 1}</strong>.</>} hint={attempt === 1 ? activeHint.first : activeHint.second} values={order} activeIndex={activePosition} options={[1, 2, 3, 5].map((value) => ({ value: String(value), label: value }))} attempt={attempt} feedback={feedback} model={<>Model order: <strong>4 – 2 – 5 – 1 – 3</strong><br />This task is marked <strong>Guided</strong>.</>} modelVisible={modelVisible} onChoose={chooseRepair} onShowModel={() => { setGuided(true); setModelVisible(true); schedule(() => finish(true), 1200) }} onKeepTrying={() => undefined} /> }] : []),
    ...(complete ? [{ id: 'complete', type: 'panel' as const, title: 'Task 4 complete ✓', subtitle: 'Paragraph Organisation', variant: 'summary' as const, stage: 'complete', content: <><div className="result"><span>Paragraph order</span><GuidedIndependentStatus mode={guided ? 'guided' : 'independent'} /></div><div className="result"><span>School → It</span><StatusTag tone="success">Linked ✓</StatusTag></div><div className="result"><span>Playground → there</span><StatusTag tone="success">Linked ✓</StatusTag></div><div className="result"><span>Activity → This activity</span><StatusTag tone="success">Linked ✓</StatusTag></div><div className="note">Evidence stored as <strong>WRITE-COHESION</strong>. The app checks paragraph links without copying the full sentences from the worksheet.</div></> }] : []),
  ]

  return <TaskRenderer task={task} className="task-60164" chatRef={chatRef} footer={<StatusFooter title={complete ? 'Task 4 complete' : 'Task 4'} status={complete ? 'Continue to Task 5.' : 'Enter the paragraph order.'} actionLabel="Back to book" actionId="backBook" disabled={!complete} onAction={() => addNotice('Keep going. Task 5 is your own 40–50 word paragraph.')} />} blocks={blocks} />
}
