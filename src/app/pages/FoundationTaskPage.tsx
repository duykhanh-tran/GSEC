import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TaskComponentProps } from '../task-types'
import { ChatRow } from '../../components/chat/ChatRow'
import { TutorBubble } from '../../components/chat/TutorBubble'
import { CodeKeypadModal } from '../../components/keypad/CodeKeypadModal'
import { AppShell } from '../../components/shell/AppShell'
import { TaskFooter } from '../../components/shell/TaskFooter'
import { TutorHeader } from '../../components/shell/TutorHeader'
import { TaskCard } from '../../components/task/TaskCard'

export function FoundationTaskPage({ task }: TaskComponentProps) {
  const navigate = useNavigate()
  const [isKeypadOpen, setIsKeypadOpen] = useState(false)
  const keypadTriggerRef = useRef<HTMLButtonElement>(null)
  const keypadId = useId()

  useEffect(() => {
    document.title = `${task.title} · React`
  }, [task.title])

  return (
    <>
      <AppShell
        taskCode={task.code}
        header={
          <TutorHeader
            task={task}
            keypadId={keypadId}
            keypadTriggerRef={keypadTriggerRef}
            onOpenKeypad={() => setIsKeypadOpen(true)}
          />
        }
        footer={<TaskFooter progress={0} disabled />}
      >
        <ChatRow role="tutor">
          <TutorBubble>
            <strong>Task {task.taskNumber}.</strong>
            <br />
            Nội dung học tập sẽ được chuyển sang React ở giai đoạn chuyển task.
          </TutorBubble>
        </ChatRow>
        <TaskCard title="React foundation" subtitle={`Mã task ${task.code}`}>
          <p>
            Shell, metadata, avatar, bóng thoại, footer và popup nhập mã đang dùng
            component chung.
          </p>
        </TaskCard>
      </AppShell>

      <CodeKeypadModal
        dialogId={keypadId}
        isOpen={isKeypadOpen}
        returnFocusRef={keypadTriggerRef}
        onClose={() => setIsKeypadOpen(false)}
        onNavigate={(code) => {
          setIsKeypadOpen(false)
          navigate(`/tasks/${code}`)
        }}
      />
    </>
  )
}
