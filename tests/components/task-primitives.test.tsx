import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActionButton } from '../../src/components/task/ActionButton'
import { StatusTag } from '../../src/components/task/StatusTag'
import { TaskPanel } from '../../src/components/task/TaskPanel'

describe('locked task primitives', () => {
  it('renders the shared panel contract and preserves data selectors', () => {
    const { container } = render(<TaskPanel title="Check" subtitle="4 parts" data-stage="entry">Body</TaskPanel>)
    expect(container.querySelector("[data-stage='entry']")).toHaveClass('card')
    expect(screen.getByRole('heading', { name: 'Check' })).toBeInTheDocument()
    expect(screen.getByText('4 parts')).toBeInTheDocument()
  })

  it('renders status tags and action variants with native behavior', () => {
    const onClick = vi.fn()
    render(<><StatusTag tone="warning">Needs work</StatusTag><ActionButton variant="success" disabled onClick={onClick}>Continue</ActionButton></>)
    expect(screen.getByText('Needs work')).toHaveClass('tag', 'warn')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})
