import type { ReactNode, RefObject } from 'react'

import type { TaskDefinition } from '../app/task-types'
import { InteractiveTaskFrame } from '../components/shell/InteractiveTaskFrame'
import type { TaskFlowBlock } from './schema'
import { TaskFlowRenderer } from './TaskFlowRenderer'

interface TaskRendererProps {
  task: TaskDefinition
  className: string
  chatRef?: RefObject<HTMLElement | null>
  footer: ReactNode
  blocks: readonly TaskFlowBlock[]
}

export function TaskRenderer({ task, className, chatRef, footer, blocks }: TaskRendererProps) {
  return (
    <InteractiveTaskFrame task={task} className={className} chatRef={chatRef} footer={footer}>
      <TaskFlowRenderer blocks={blocks} />
    </InteractiveTaskFrame>
  )
}
