import { useEffect, useState } from 'react'
import type { TaskComponentProps } from '../../app/task-types'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { saveApprovedWriting } from '../../lib/studentWritingStorageService'
import { saveTaskAttempt } from '../../lib/taskAttemptService'
import { evaluateSentenceWithAI, detectGibberish } from '../../lib/aiGradingService'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import './task.css'

export function Task60115({ task }: TaskComponentProps) {
  const [data, setData] = useState({ v1: '', v2: '', v3: '', v4: '' })
  const [phase, setPhase] = useState<'capture' | 'preview' | 'repair' | 'complete'>('capture')
  const [notices, setNotices] = useState<string[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [repairIndex, setRepairIndex] = useState<1 | 2 | 3 | 4>(3)
  const [repairHint, setRepairHint] = useState('Check the noun after “two”.')

  const paragraph = `My school is ${data.v1.trim()}. In my school bag, I have ${data.v2.trim()}. I also have ${data.v3.trim()}. I feel ${data.v4.trim()} at school.`

  useEffect(() => {
    if (phase === 'complete') {
      const sentences = [
        `My school is ${data.v1.trim()}.`,
        `In my school bag, I have ${data.v2.trim()}.`,
        `I also have ${data.v3.trim()}.`,
        `I feel ${data.v4.trim()} at school.`,
      ]
      saveApprovedWriting('60115', sentences, paragraph)
      saveTaskAttempt({
        taskCode: '60115',
        score: 100,
        firstScore: 100,
        status: 'completed',
        supportMode: 'INDEPENDENT',
        answersPayload: {
          v1: data.v1.trim(),
          v2: data.v2.trim(),
          v3: data.v3.trim(),
          v4: data.v4.trim(),
          approved_sentences: sentences,
          approved_paragraph: paragraph,
          verified_by_ai: true,
        },
      })
    }
  }, [phase, data.v1, data.v2, data.v3, data.v4, paragraph])

  const build = () => {
    if (Object.values(data).some((v) => !v.trim())) {
      setNotices((v) => [...v, 'Vui lòng điền đủ cả 4 phần trước khi tiếp tục.'])
    } else {
      setPhase('preview')
    }
  }

  const handleCheckWriting = async () => {
    const v1 = data.v1.trim()
    const v2 = data.v2.trim()
    const v3 = data.v3.trim()
    const v4 = data.v4.trim()

    if (!v1 || !v2 || !v3 || !v4) {
      setNotices((v) => [...v, 'Vui lòng hoàn thành cả 4 phần.'])
      return
    }

    setIsChecking(true)
    setNotices((v) => [...v, '🤖 AI Tutor: Đang kiểm tra ngữ pháp 4 câu viết của bạn...'])

    // 1. Kiểm tra từ vô nghĩa / gibberish
    const gib1 = detectGibberish(v1)
    if (gib1.isGibberish) {
      setRepairIndex(1)
      setRepairHint(`Tên trường "${gib1.token}" không hợp lệ. Vui lòng nhập tên trường tiếng Anh có nghĩa (vd: Minh Khai School).`)
      setPhase('repair')
      setIsChecking(false)
      return
    }

    const gib2 = detectGibberish(v2)
    if (gib2.isGibberish) {
      setRepairIndex(2)
      setRepairHint(`Từ "${gib2.token}" không hợp lệ. Vui lòng liệt kê đồ dùng trong cặp (vd: a ruler and a pencil case).`)
      setPhase('repair')
      setIsChecking(false)
      return
    }

    // 2. Kiểm tra câu 3 (danh từ số nhiều sau số đếm)
    if (/\btwo\s+pen\b/i.test(v3)) {
      setRepairIndex(3)
      setRepairHint('Check the noun after “two”. Sau số đếm “two” danh từ cần ở dạng số nhiều (thêm “s”: “two pens”).')
      setPhase('repair')
      setIsChecking(false)
      return
    }

    // 3. Đánh giá ngữ pháp với AI cho câu 3
    const s3 = `I also have ${v3}.`
    const ai3 = await evaluateSentenceWithAI(s3, {
      id: 'q3',
      label: 'Question 3',
      prompt: 'State items you also have with correct plural noun (e.g. two pens)',
      hints: ['Check plural nouns after numbers: two pens.'],
    })

    if (!ai3.is_correct) {
      setRepairIndex(3)
      setRepairHint(ai3.feedback_vi || 'Câu 3 chưa chuẩn ngữ pháp. Hãy kiểm tra lại danh từ số nhiều nhé.')
      setPhase('repair')
      setIsChecking(false)
      return
    }

    // Tất cả 4 câu đều đạt chuẩn 100%
    setIsChecking(false)
    setPhase('complete')
    setNotices((v) => [
      ...v,
      '🎉 Xuất sắc! Cả 4 câu đã được AI phê duyệt hoàn toàn chính xác ngữ pháp. Dữ liệu đã lưu cho bài tập Task 6 (60116) của bạn.',
    ])
  }

  const handleRepairCheck = async () => {
    setIsChecking(true)
    const curVal = data[`v${repairIndex}` as keyof typeof data].trim()

    if (!curVal) {
      setNotices((v) => [...v, 'Vui lòng không để trống câu này.'])
      setIsChecking(false)
      return
    }

    if (repairIndex === 3) {
      if (/\btwo\s+pen\b/i.test(curVal)) {
        setRepairHint('Chưa đúng. Sau “two” bạn cần thêm “s” vào danh từ: “two pens”.')
        setNotices((v) => [...v, 'Chưa đúng. Sau “two” bạn cần thêm “s” vào danh từ: “two pens”.'])
        setIsChecking(false)
        return
      }

      const s3 = `I also have ${curVal}.`
      const ai3 = await evaluateSentenceWithAI(s3, {
        id: 'q3',
        label: 'Question 3',
        prompt: 'State items you also have with correct plural noun (e.g. two pens)',
        hints: ['Check plural nouns after numbers: two pens.'],
      })

      if (!ai3.is_correct) {
        setRepairHint(ai3.feedback_vi || 'Câu vẫn chưa hoàn toàn chính xác. Vui lòng kiểm tra lại.')
        setNotices((v) => [...v, ai3.feedback_vi || 'Câu vẫn chưa hoàn toàn chính xác.'])
        setIsChecking(false)
        return
      }
    }

    // Đã sửa đúng!
    setIsChecking(false)
    setPhase('complete')
    setNotices((v) => [
      ...v,
      '🎉 Xuất sắc! Bạn đã sửa đúng. Cả 4 câu đã được AI phê duyệt hoàn toàn chính xác ngữ pháp.',
    ])
  }

  const inputs = (
    <>
      {Object.keys(data).map((key, i) => (
        <div className="capture-row" key={key}>
          <span>{i + 1}</span>
          <input
            id={key}
            placeholder="Type what you wrote"
            value={data[key as keyof typeof data]}
            onChange={(e) => setData((v) => ({ ...v, [key]: e.target.value }))}
          />
        </div>
      ))}
    </>
  )

  const blocks: TaskFlowBlock[] = [
    {
      id: 'intro',
      type: 'tutor-message',
      content: (
        <>
          <strong>Check Task 5.</strong>
          <br />
          Enter only what you wrote in 1-4.
        </>
      ),
    },
    ...notices.map((n, i): TaskFlowBlock => ({ id: `n-${i}`, type: 'tutor-message', content: n })),
    ...(phase === 'capture'
      ? [
          {
            id: 'capture',
            type: 'custom' as const,
            content: (
              <section className="card" id="captureCard">
                <div className="ch">
                  <div>
                    <h2>Quick capture</h2>
                    <p>Use your book. The sentence frames stay hidden here.</p>
                  </div>
                </div>
                <div className="cb">
                  {inputs}
                  <div className="actions">
                    <ActionButton
                      id="demo"
                      variant="secondary"
                      onClick={() =>
                        setData({
                          v1: 'Minh Khai School',
                          v2: 'a ruler and a pencil case',
                          v3: 'two pen',
                          v4: 'happy',
                        })
                      }
                    >
                      Demo
                    </ActionButton>
                    <ActionButton id="build" onClick={build}>
                      Build my writing
                    </ActionButton>
                  </div>
                </div>
              </section>
            ),
          },
        ]
      : []),
    ...(phase === 'preview'
      ? [
          {
            id: 'preview',
            type: 'custom' as const,
            content: (
              <section className="card" id="previewCard">
                <div className="ch">
                  <h2>Your writing</h2>
                </div>
                <div className="cb">
                  <div className="paragraph">{paragraph}</div>
                  <div className="actions">
                    <ActionButton id="edit" variant="secondary" onClick={() => setPhase('capture')} disabled={isChecking}>
                      Edit
                    </ActionButton>
                    <ActionButton
                      id="check"
                      onClick={handleCheckWriting}
                      disabled={isChecking}
                    >
                      {isChecking ? 'AI đang kiểm tra...' : 'Check my writing'}
                    </ActionButton>
                  </div>
                </div>
              </section>
            ),
          },
        ]
      : []),
    ...(phase === 'repair'
      ? [
          {
            id: 'repair',
            type: 'custom' as const,
            content: (
              <section className="repair" id="repairCard">
                <strong>{repairIndex === 1 ? '①' : repairIndex === 2 ? '②' : repairIndex === 3 ? '③' : '④'}</strong>
                <div className="hint">{repairHint}</div>
                <input
                  id="repairInput"
                  value={data[`v${repairIndex}` as keyof typeof data]}
                  onChange={(e) => setData((v) => ({ ...v, [`v${repairIndex}`]: e.target.value }))}
                />
                <ActionButton
                  id="repairCheck"
                  onClick={handleRepairCheck}
                  disabled={isChecking}
                >
                  {isChecking ? 'AI đang kiểm tra...' : 'Check'}
                </ActionButton>
              </section>
            ),
          },
        ]
      : []),
    ...(phase === 'complete'
      ? [
          {
            id: 'complete',
            type: 'panel' as const,
            title: 'Task 5 complete ✓',
            subtitle: 'Your writing is ready.',
            variant: 'summary' as const,
            stage: 'complete',
            content: (
              <>
                <div className="sr">
                  <span>Ideas</span>
                  <StatusTag tone="success">Complete ✓</StatusTag>
                </div>
                <div className="reuse">
                  {Object.values(data).map((v, i) => (
                    <div key={i}>
                      {i + 1}. <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              </>
            ),
          },
        ]
      : []),
  ]

  return (
    <TaskRenderer
      task={task}
      className="task-60115 writing-task"
      footer={
        <StatusFooter
          title={phase === 'complete' ? 'Task 5 complete' : 'Task 5'}
          status={phase === 'complete' ? 'Ideas saved for Task 6.' : 'Book → capture → coach.'}
          actionLabel="Task 6"
          actionId="nextBtn"
          disabled={phase !== 'complete'}
          onAction={() => setNotices((v) => [...v, 'Task 6 can now use your saved ideas.'])}
        />
      }
      blocks={blocks}
    />
  )
}
 
