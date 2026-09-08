import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { TaskDefinition } from '../../src/app/task-types'
import { ListeningChoiceTask, type ListeningChoiceTaskConfig } from '../../src/components/assessment/ListeningChoiceTask'
import { ReadinessChecklist } from '../../src/components/checklist/ReadinessChecklist'
import { WritingVerificationChecklist } from '../../src/components/checklist/WritingVerificationChecklist'
import { SequenceOrderInput } from '../../src/components/ordering/SequenceOrderInput'
import { SequenceRepairPanel } from '../../src/components/ordering/SequenceRepairPanel'
import { DraftComparison } from '../../src/components/writing/DraftComparison'
import { LanguageHelpPanel } from '../../src/components/writing/LanguageHelpPanel'

const task: TaskDefinition = {
  code: '60161',
  worksheet: 6,
  taskNumber: 1,
  title: 'AI Tutor • WS 6 - Task 1',
  subtitle: 'Listening · True or False',
  status: 'planned',
  archetypes: ['listening-assessment'],
  component: () => null,
  legacyUrl: '/tasks/60161/index.html',
}

const listeningConfig: ListeningChoiceTaskConfig = {
  className: 'task-60161',
  intro: 'Listen first.',
  entrySubtitle: '1 item',
  entryNote: 'Enter the answer from the worksheet.',
  options: ['T', 'F'],
  items: [{ id: 1, key: 'T', firstHint: 'Listen again.', secondHint: 'Focus on the year.', retryTag: 'LISTEN-DETAIL', bookCue: 'Item 1', summaryLabel: 'Item 1', speechText: 'Year 6.' }],
  demoAnswers: { 1: 'F' },
  incompleteMessage: 'Choose an answer.',
  itemSingular: 'Item',
  itemPlural: 'Items',
  retryDataAttribute: 'question',
  resultsTitle: 'Task 1 check',
  summaryTitle: 'Task 1 complete ✓',
  summarySubtitle: 'Listening',
  evidenceTag: 'LISTEN-DETAIL',
  evidenceNote: 'Evidence stored.',
  footerIdle: 'Listen, then answer.',
  footerComplete: 'Continue.',
  continueLabel: 'Back to book',
  completeIndependent: 'Independent.',
  completeGuided: 'Guided.',
  backMessage: 'Continue.',
  playback: { title: 'Emily’s school', subtitle: 'Full audio', text: 'Hello.', prompt: 'Listen to the full talk', completedMessage: 'Now enter your answer.' },
}

describe('WS6 shared foundation components', () => {
  it('gates a listening choice task until full playback completes', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ListeningChoiceTask task={task} config={listeningConfig} /></MemoryRouter>)
    expect(screen.queryByText('Your answers')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByText('Your answers')).toBeInTheDocument()
    expect(screen.getByText('Now enter your answer.')).toBeInTheDocument()
  })

  it('prevents duplicate sequence choices and targets the selected slot', async () => {
    const user = userEvent.setup()
    const onPlace = vi.fn()
    render(<SequenceOrderInput slots={[{ id: 0, label: 1, value: 4, fixed: true }, { id: 1, label: 2, value: null }]} choices={[4, 2]} selectedSlotId={1} onSelectSlot={vi.fn()} onPlace={onPlace} />)
    expect(screen.getByRole('button', { name: '4' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(onPlace).toHaveBeenCalledWith(2)
  })

  it('supports controlled readiness and writing verification evidence', async () => {
    const user = userEvent.setup()
    const checklistChange = vi.fn()
    const submit = vi.fn()
    function Harness() {
      const [values, setValues] = useState<Record<string, boolean>>({ caps: false })
      const [evidence, setEvidence] = useState('')
      return <><ReadinessChecklist items={[{ id: 'draft', title: 'Draft ready' }]} values={{ draft: false }} onChange={checklistChange} /><WritingVerificationChecklist items={[{ id: 'caps', label: 'Capital letters' }]} values={values} words={['friendly']} evidence={evidence} onItemChange={(id, checked) => setValues((current) => ({ ...current, [id]: checked }))} onEvidenceChange={setEvidence} onSubmit={submit} /></>
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Draft ready' }))
    expect(checklistChange).toHaveBeenCalledWith('draft', true)
    await user.click(screen.getByLabelText('Capital letters'))
    await user.type(screen.getByRole('textbox', { name: 'Type one checked word' }), 'friendly')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('Capital letters')).toBeChecked()
    expect(screen.getByRole('textbox')).toHaveValue('friendly')
    expect(submit).toHaveBeenCalledOnce()
  })

  it('renders sequence repair, draft comparison and language help contracts', () => {
    render(<><SequenceRepairPanel title="Position 2" tag="WRITE-COHESION" cue="Check the worksheet." hint="Follow It." values={[4, 5, null]} activeIndex={1} options={[{ value: '2', label: '2' }]} attempt={3} model="4 – 2 – 5" onChoose={vi.fn()} onShowModel={vi.fn()} /><DraftComparison versions={[{ id: 'first', label: 'First draft', text: 'Teachers is friendly.' }, { id: 'revised', label: 'Revised draft', text: 'Teachers are friendly.' }]} /><LanguageHelpPanel phrases={['My school is …', 'It has …']} /></>)
    expect(screen.getByText('WRITE-COHESION')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show model' })).toBeInTheDocument()
    expect(screen.getByText('Teachers are friendly.')).toBeInTheDocument()
    expect(screen.getByText('My school is …')).toBeInTheDocument()
  })
})
