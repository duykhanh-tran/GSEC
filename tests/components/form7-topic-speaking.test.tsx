import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TopicSpeakingRenderer } from '../../src/task-engine/renderers/TopicSpeakingRenderer'
import type { Form7TopicSpeakingConfig } from '../../src/task-engine/dynamic-schema'

describe('TopicSpeakingRenderer (Form 7)', () => {
  const sampleForm7Config: Form7TopicSpeakingConfig = {
    prompt: 'Choose ONE good thing to do at school.',
    intro: 'Select one topic from the box and speak aloud into your mic.',
    pass_score: 80,
    allow_other_idea: true,
    scoring_criteria: 'Speak clearly and stay on topic.',
    options: [
      { id: 'opt_1', text: 'Keep my desk and classroom tidy' },
      { id: 'opt_2', text: 'Help a classmate who struggles with lessons' },
      { id: 'opt_3', text: 'Take care of school things' },
    ],
  }

  it('renders prompt, options list, and initial disabled mic button', () => {
    render(
      <TopicSpeakingRenderer
        config={sampleForm7Config}
        taskCode="70101"
      />
    )

    expect(screen.getByText(/Choose ONE good thing to do at school/i)).toBeDefined()
    expect(screen.getByText(/Keep my desk and classroom tidy/i)).toBeDefined()
    expect(screen.getByText(/Help a classmate who struggles with lessons/i)).toBeDefined()
    expect(screen.getByText(/Take care of school things/i)).toBeDefined()
    expect(screen.getByText(/Other idea/i)).toBeDefined()

    const micBtn = document.getElementById('topicSpeakingMicBtn') as HTMLButtonElement
    expect(micBtn.disabled).toBe(true)
  })

  it('enables mic button when a topic is selected', () => {
    render(
      <TopicSpeakingRenderer
        config={sampleForm7Config}
        taskCode="70101"
      />
    )

    const opt1 = document.getElementById('topic-option-opt_1')!
    fireEvent.click(opt1)

    const micBtn = document.getElementById('topicSpeakingMicBtn') as HTMLButtonElement
    expect(micBtn.disabled).toBe(false)
    expect(screen.getByText(/Chủ đề đã chọn:/i)).toBeDefined()
    expect(screen.getAllByText(/Keep my desk and classroom tidy/i).length).toBeGreaterThanOrEqual(1)
  })

  it('supports selecting "Other idea" and typing custom text', () => {
    render(
      <TopicSpeakingRenderer
        config={sampleForm7Config}
        taskCode="70101"
      />
    )

    const otherCard = document.getElementById('topic-option-other')!
    fireEvent.click(otherCard)

    const otherInput = document.getElementById('topic-other-input') as HTMLInputElement
    expect(otherInput).toBeDefined()

    fireEvent.change(otherInput, { target: { value: 'Plant trees in the yard' } })
    expect(otherInput.value).toBe('Plant trees in the yard')

    const micBtn = document.getElementById('topicSpeakingMicBtn') as HTMLButtonElement
    expect(micBtn.disabled).toBe(false)
  })
})
