import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TaskDefinition } from '../app/task-types'
import { InteractiveTaskFrame } from '../components/shell/InteractiveTaskFrame'
import { ActionButton } from '../components/task/ActionButton'
import { saveTaskAttempt } from '../lib/taskAttemptService'
import type { TaskFlowBlock } from './schema'
import { TaskFlowRenderer } from './TaskFlowRenderer'

interface TaskRendererProps {
  task: TaskDefinition
  className: string
  chatRef?: RefObject<HTMLElement | null>
  footer: ReactNode
  blocks: readonly TaskFlowBlock[]
  disableAutoSave?: boolean
}

export function TaskRenderer({
  task,
  className,
  chatRef,
  footer,
  blocks,
  disableAutoSave = false,
}: TaskRendererProps) {
  const navigate = useNavigate()
  const hasAutoSavedRef = useRef(false)

  // Tự động phát hiện khi bài tập đạt trạng thái hoàn thành (cả 32 bài static):
  // Chỉ hiển thị khối hành động hoàn thành (Làm lại & Quay lại trang nhập mã) khi:
  // 1. Chứa block 'complete', 'complete-message' hoặc 'done'
  // 2. Hoặc panel có stage === 'complete' hoặc variant === 'summary'
  // 3. Hoặc block có stage === 'complete'
  // (TUYỆT ĐỐI KHÔNG kiểm tra 'celebrate'/'celebration' hay footer.disabled để tránh hiển thị sớm khi chưa làm xong)
  const isCompleted = blocks.some((b) => {
    if (!b) return false
    const id = String(b.id || '').toLowerCase()
    if (id === 'complete' || id === 'complete-message' || id === 'done') {
      return true
    }
    if (
      b.type === 'panel' &&
      (b.stage === 'complete' ||
        b.variant === 'summary' ||
        (typeof b.title === 'string' &&
          (b.title.toLowerCase().includes('complete') ||
            b.title.toLowerCase().includes('hoàn thành')) &&
          !b.title.toLowerCase().includes('check') &&
          !b.title.toLowerCase().includes('priority') &&
          !b.title.toLowerCase().includes('first')))
    ) {
      return true
    }
    if ((b as any).stage === 'complete') {
      return true
    }
    return false
  })

  useEffect(() => {
    if (disableAutoSave) return

    if (isCompleted && !hasAutoSavedRef.current) {
      hasAutoSavedRef.current = true
      saveTaskAttempt({
        taskCode: task.code,
        score: 100,
        status: 'completed',
        supportMode: 'INDEPENDENT',
      })
    }
  }, [task.code, isCompleted, disableAutoSave])

  const handleRestart = () => {
    window.dispatchEvent(new CustomEvent('restart-task', { detail: { taskCode: task.code } }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <InteractiveTaskFrame task={task} className={className} chatRef={chatRef} footer={footer}>
      <TaskFlowRenderer blocks={blocks} />

      {/* KHỐI HÀNH ĐỘNG KHI HOÀN THÀNH BÀI TẬP (LÀM LẠI & QUAY LẠI TRANG GÕ MÃ) */}
      {isCompleted && (
        <section
          className="task-panel card completion-actions-card"
          data-stage="task-completed-actions"
          style={{
            marginTop: '20px',
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid #bbf7d0',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '26px' }}>🎉</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#166534' }}>
                  Hoàn thành bài tập!
                </div>
                <div style={{ fontSize: '13px', color: '#15803d', marginTop: '2px' }}>
                  Bạn có thể làm lại bài này hoặc quay lại trang để gõ mã làm bài tiếp theo.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <ActionButton
                id="taskRestartBtn"
                variant="secondary"
                onClick={handleRestart}
              >
                🔄 Làm lại (Try again)
              </ActionButton>
              <ActionButton
                id="taskBackToCodeBtn"
                onClick={() => navigate('/?mode=code')}
              >
                ⌨️ Quay lại trang nhập mã
              </ActionButton>
            </div>
          </div>
        </section>
      )}
    </InteractiveTaskFrame>
  )
}

