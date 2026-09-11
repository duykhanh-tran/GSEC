import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TaskRenderer } from '../../src/task-engine/TaskRenderer'
import type { TaskDefinition } from '../../src/app/task-types'
import { Task60113 } from '../../src/tasks/60113/Task60113'
import { Task60131 } from '../../src/tasks/60131/Task60131'

const mockTask: TaskDefinition = {
  code: '60113',
  unit: 1,
  lesson: 'A Closer Look 1',
  taskNumber: 3,
  title: 'Listen and write',
  subtitle: 'Vocabulary',
  archetypes: ['matching'],
  worksheet: 'WS1',
}

describe('Completion Actions Card Visibility', () => {
  it('does NOT render completion actions card when task is in entry / in-progress stage', () => {
    render(
      <MemoryRouter>
        <TaskRenderer
          task={mockTask}
          className="test-task"
          footer={<button disabled={true}>Back to book</button>}
          blocks={[
            { id: 'intro', type: 'tutor-message', content: 'Intro message' },
            { id: 'entry', type: 'panel', title: 'Your answers', stage: 'entry', content: <div>inputs</div> },
          ]}
        />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Hoàn thành bài tập!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Làm lại \(Try again\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Quay lại trang nhập mã/i)).not.toBeInTheDocument()
  })

  it('does NOT render completion actions card if footer is not disabled in in-progress stage', () => {
    render(
      <MemoryRouter>
        <TaskRenderer
          task={mockTask}
          className="test-task"
          footer={<button disabled={false}>Check</button>}
          blocks={[
            { id: 'intro', type: 'tutor-message', content: 'Intro' },
            { id: 'entry', type: 'panel', title: 'Your answers', stage: 'entry', content: <div>inputs</div> },
          ]}
        />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Hoàn thành bài tập!/i)).not.toBeInTheDocument()
  })

  it('does NOT render completion actions card if results are still being checked or in retry', () => {
    render(
      <MemoryRouter>
        <TaskRenderer
          task={mockTask}
          className="test-task"
          footer={<button disabled={true}>Back to book</button>}
          blocks={[
            { id: 'intro', type: 'tutor-message', content: 'Intro' },
            { id: 'results', type: 'panel', title: 'Task 1 check', stage: 'results', content: <div>1/3 correct</div> },
            { id: 'retry-1', type: 'panel', title: 'Question 1 retry', stage: 'retry', content: <div>retry</div> },
          ]}
        />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Hoàn thành bài tập!/i)).not.toBeInTheDocument()
  })

  it('DOES render completion actions card when task is genuinely complete', () => {
    render(
      <MemoryRouter>
        <TaskRenderer
          task={mockTask}
          className="test-task"
          footer={<button disabled={false}>Back to book</button>}
          blocks={[
            { id: 'intro', type: 'tutor-message', content: 'Intro' },
            { id: 'complete', type: 'panel', title: 'Task 1 complete ✓', stage: 'complete', variant: 'summary', content: <div>All correct!</div> },
          ]}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Hoàn thành bài tập!/i)).toBeInTheDocument()
    expect(screen.getByText(/Làm lại \(Try again\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Quay lại trang nhập mã/i)).toBeInTheDocument()
  })

  it('Task60113 does NOT show completion box on initial render', () => {
    render(
      <MemoryRouter>
        <Task60113 task={mockTask} />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Hoàn thành bài tập!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Làm lại \(Try again\)/i)).not.toBeInTheDocument()
  })

  it('Task60131 does NOT show completion box on initial render', () => {
    const task60131Def: TaskDefinition = {
      ...mockTask,
      code: '60131',
      taskNumber: 1,
      title: 'Grammar Task 1',
    }

    render(
      <MemoryRouter>
        <Task60131 task={task60131Def} />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Hoàn thành bài tập!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Làm lại \(Try again\)/i)).not.toBeInTheDocument()
  })
})
