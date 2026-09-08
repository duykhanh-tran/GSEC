import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChatRow } from '../../src/components/chat/ChatRow'
import { StudentBubble } from '../../src/components/chat/StudentBubble'
import { TutorBubble } from '../../src/components/chat/TutorBubble'
import { TUTOR_AVATAR_URL } from '../../src/components/chat/TutorAvatar'

describe('shared chat components', () => {
  it('renders the tutor avatar and standard tutor classes', () => {
    const { container } = render(
      <ChatRow role="tutor">
        <TutorBubble>Tutor message</TutorBubble>
      </ChatRow>,
    )

    expect(container.querySelector('[data-chat-role="tutor"]')).toHaveClass('chat-row')
    expect(container.querySelector('img')).toHaveAttribute('src', TUTOR_AVATAR_URL)
    expect(screen.getByText('Tutor message')).toHaveClass('chat-bubble--tutor')
  })

  it('renders the student modifier without a tutor avatar', () => {
    const { container } = render(
      <ChatRow role="student">
        <StudentBubble>Student message</StudentBubble>
      </ChatRow>,
    )

    expect(container.querySelector('[data-chat-role="student"]')).toHaveClass(
      'chat-row--student',
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('Student message')).toHaveClass('chat-bubble--student')
  })
})
