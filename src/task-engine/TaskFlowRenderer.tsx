import { ChatRow } from '../components/chat/ChatRow'
import { TutorBubble } from '../components/chat/TutorBubble'
import { Celebration } from '../components/effects/Celebration'
import { ListenButton } from '../components/listening/ListenButton'
import { TaskPanel } from '../components/task/TaskPanel'
import type { TaskFlowBlock } from './schema'

interface TaskFlowRendererProps {
  blocks: readonly TaskFlowBlock[]
}

export function TaskFlowRenderer({ blocks }: TaskFlowRendererProps) {
  return blocks.map((block) => {
    if (block.type === 'tutor-message') {
      return (
        <ChatRow role="tutor" key={block.id}>
          <TutorBubble>
            {block.content}
            {block.speechText ? <><br /><ListenButton text={block.speechText} /></> : null}
          </TutorBubble>
        </ChatRow>
      )
    }

    if (block.type === 'panel') {
      return (
        <TaskPanel
          title={block.title}
          subtitle={block.subtitle}
          variant={block.variant}
          data-stage={block.stage}
          key={block.id}
        >
          {block.content}
        </TaskPanel>
      )
    }

    if (block.type === 'celebration') {
      return <Celebration {...block} key={block.id} />
    }

    return <div className="task-flow-custom" data-block-id={block.id} key={block.id}>{block.content}</div>
  })
}
