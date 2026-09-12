import { useState, useEffect, useRef } from 'react'
import type { Form61ProfileConfig, Form61ProfileFieldItem } from '../dynamic-schema'
import { checkProfileAnswerMatch } from '../../lib/questionBankMatcher'
import { ActionButton } from '../../components/task/ActionButton'
import './profile-listen-answer.css'

function playSuccessDing() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

export interface ProfileListenAnswerRendererProps {
  config: Form61ProfileConfig
  taskCode: string
  onComplete?: (score: number, details: any) => void
  onRestart?: () => void
  onNavigateHome?: () => void
  disabled?: boolean
}

interface StepStatus {
  correct: boolean
  userText: string
  attempts: number
  hint?: string
}

export function ProfileListenAnswerRenderer({
  config,
  taskCode: _taskCode,
  onComplete,
  onRestart,
  onNavigateHome,
  disabled = false,
}: ProfileListenAnswerRendererProps) {
  const items = config.items && config.items.length > 0 ? config.items : [
    {
      id: 'name',
      label: 'Name',
      profile_value: 'Nam',
      audio_url: '',
      accepted_answers: ['Nam', 'His name is Nam', "His name's Nam"],
      hints: ['Nghe kỹ câu hỏi tên bạn ấy trong hồ sơ.'],
    },
    {
      id: 'class',
      label: 'Class',
      profile_value: '6A',
      audio_url: '',
      accepted_answers: ['6A', 'Class 6A', 'He is in class 6A', 'in class 6A'],
      hints: ['Bạn ấy học lớp nào? Nhìn vào cột Class nhé.'],
    },
    {
      id: 'subject',
      label: 'Favourite subject',
      profile_value: 'English',
      audio_url: '',
      accepted_answers: ['English', 'His favourite subject is English'],
      hints: ['Môn học yêu thích của bạn ấy là gì? Nhìn vào Favourite subject.'],
    },
    {
      id: 'activity',
      label: 'Activity after',
      profile_value: 'play football',
      audio_url: '',
      accepted_answers: ['play football', 'plays football', 'He plays football', 'He usually plays football'],
      hints: ['Hoạt động sau giờ học của bạn ấy là gì?'],
    },
  ]

  // Trình tự 4 câu hỏi: Câu 1 luôn là Name (items[0]), 3 câu còn lại xáo trộn ngẫu nhiên
  const [sequence, setSequence] = useState<Form61ProfileFieldItem[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepStatuses, setStepStatuses] = useState<Record<number, StepStatus>>({})
  const [currentInput, setCurrentInput] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [isAllFinished, setIsAllFinished] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Khởi tạo thứ tự câu hỏi khi mount
  useEffect(() => {
    initQuestionSequence()
  }, [config])

  const initQuestionSequence = () => {
    if (!items || items.length === 0) return

    let finalSequence: Form61ProfileFieldItem[] = []
    const isFixedFirst = config.is_fixed_first_field !== false

    if (isFixedFirst && items.length > 1) {
      const firstItem = items[0]
      const remaining = [...items.slice(1)]
      // Xáo trộn 3 câu còn lại (Fisher-Yates)
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = remaining[i]
        remaining[i] = remaining[j]
        remaining[j] = temp
      }
      finalSequence = [firstItem, ...remaining]
    } else {
      finalSequence = [...items]
    }

    setSequence(finalSequence)
    setCurrentStepIndex(0)
    setStepStatuses({})
    setCurrentInput('')
    setFeedbackMessage(null)
    setIsAllFinished(false)
  }

  const currentItem = sequence[currentStepIndex]

  // Tự động phát audio câu hỏi khi chuyển sang bước mới
  useEffect(() => {
    if (currentItem && !isAllFinished) {
      playCurrentAudio()
    }
  }, [currentStepIndex, sequence])

  // Phát âm thanh của câu hỏi hiện tại
  const playCurrentAudio = () => {
    if (!currentItem) return

    if (currentItem.audio_url && currentItem.audio_url.trim()) {
      if (audioRef.current) {
        audioRef.current.src = currentItem.audio_url
        setIsPlayingAudio(true)
        audioRef.current
          .play()
          .catch(() => {
            setIsPlayingAudio(false)
          })
      }
    } else {
      // Fallback: Sử dụng Web Speech Synthesis đọc câu hỏi mẫu
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const questionText = getFallbackQuestionText(currentItem.label)
        const utterance = new SpeechSynthesisUtterance(questionText)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        utterance.onstart = () => setIsPlayingAudio(true)
        utterance.onend = () => setIsPlayingAudio(false)
        utterance.onerror = () => setIsPlayingAudio(false)
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  const getFallbackQuestionText = (label: string): string => {
    const l = label.toLowerCase()
    if (l.includes('name')) return "What's his name?"
    if (l.includes('class')) return "Which class is he in?"
    if (l.includes('subject')) return "What is his favourite subject?"
    if (l.includes('activity')) return "What does he do after school?"
    return `Tell me about his ${label}.`
  }

  // Xử lý nộp câu trả lời cho câu hiện tại
  const handleCheckCurrent = () => {
    if (!currentInput.trim() || !currentItem || disabled) return

    const trimmedInput = currentInput.trim()
    const isCorrect = checkProfileAnswerMatch(
      trimmedInput,
      currentItem.profile_value,
      currentItem.accepted_answers
    )

    const prevAttempts = stepStatuses[currentStepIndex]?.attempts || 0

    if (isCorrect) {
      playSuccessDing()
      const newStatuses = {
        ...stepStatuses,
        [currentStepIndex]: {
          correct: true,
          userText: trimmedInput,
          attempts: prevAttempts + 1,
        },
      }
      setStepStatuses(newStatuses)
      setFeedbackMessage(null)
      setCurrentInput('')

      // Kiểm tra hoàn thành tất cả
      if (currentStepIndex + 1 >= sequence.length) {
        setIsAllFinished(true)
        onComplete?.(100, { stepStatuses: newStatuses })
      } else {
        // Tự động mở câu hỏi tiếp theo
        setCurrentStepIndex((prev) => prev + 1)
      }
    } else {
      // Sai: hiển thị gợi ý
      const hint = currentItem.hints?.[0] || 'Chưa chính xác, hãy nhìn lại bảng thông tin hồ sơ và nghe lại câu hỏi nhé!'
      setStepStatuses({
        ...stepStatuses,
        [currentStepIndex]: {
          correct: false,
          userText: trimmedInput,
          attempts: prevAttempts + 1,
          hint,
        },
      })
      setFeedbackMessage(hint)
    }
  }

  const handleRestartAll = () => {
    initQuestionSequence()
    onRestart?.()
  }

  if (isAllFinished) {
    return (
      <div className="profile-qa-container">
        <section className="profile-all-summary">
          <div style={{ fontSize: '40px' }}>🎉</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#166534' }}>
            Task Complete • Hoàn thành xuất sắc!
          </h2>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
            Bạn đã nghe hiểu và trả lời chính xác toàn bộ thông tin trong hồ sơ của bạn học!
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', margin: '8px auto', background: '#f0fdf4', border: '1.5px solid #86efac', padding: '8px 24px', borderRadius: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>Điểm số:</span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#15803d' }}>100</span>
            <span style={{ fontSize: '14px', color: '#166534' }}>/100</span>
          </div>

          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            {sequence.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                }}
              >
                <span style={{ fontWeight: 600 }}>{idx + 1}. {item.label}:</span>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>
                  {stepStatuses[idx]?.userText || item.profile_value} ✓
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px' }}>
            <ActionButton id="profileRestartBtn" variant="secondary" onClick={handleRestartAll}>
              🔄 Luyện lại
            </ActionButton>
            {onNavigateHome && (
              <ActionButton id="profileHomeBtn" onClick={onNavigateHome}>
                ⌨️ Quay lại trang chủ
              </ActionButton>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="profile-qa-container">
      {/* Ẩn audio element để phát file mp3 */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlayingAudio(false)}
        onError={() => setIsPlayingAudio(false)}
        style={{ display: 'none' }}
      />

      {/* HEADER BANNER */}
      <div className="profile-qa-header">
        <div style={{ fontWeight: 600, color: '#1e293b' }}>
          💡 {config.intro || "Look at your new classmate's profile. Listen to the AI Coach and answer."}
        </div>
        <div style={{ fontWeight: 700, color: '#0284c7' }}>
          Câu {currentStepIndex + 1} / {sequence.length}
        </div>
      </div>

      {/* KHUNG HỘI THOẠI & TRẢ LỜI */}
      <div className="profile-qa-conversation">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            💬 Conversation with AI Coach
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            📖 Nhìn vào hồ sơ trong phiếu bài tập để trả lời
          </div>
        </div>

          <div className="profile-dialogue-list">
            {sequence.map((seqItem, idx) => {
              const status = stepStatuses[idx]
              const isCurrent = idx === currentStepIndex
              const isPast = idx < currentStepIndex

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    className={`profile-dialogue-row ${isCurrent ? 'active' : ''} ${status?.correct ? 'correct' : ''} ${status && !status.correct ? 'wrong' : ''}`}
                  >
                    <span style={{ fontWeight: 700, color: '#334155', minWidth: '60px' }}>
                      {idx + 1}. You:
                    </span>
                    <span style={{ flex: 1, color: status?.correct ? '#166534' : '#0f172a', fontWeight: status?.correct ? 700 : 500 }}>
                      {status?.correct ? (
                        <>
                          {status.userText}{' '}
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                        </>
                      ) : isPast ? (
                        status?.userText || '...'
                      ) : isCurrent ? (
                        <span style={{ color: '#0284c7', fontStyle: 'italic' }}>Đang lắng nghe & nhập câu trả lời...</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>___________________________</span>
                      )}
                    </span>
                  </div>

                  {/* KHUNG AUDIO & Ô NHẬP LIỆU CHO CÂU HIỆN TẠI */}
                  {isCurrent && (
                    <div className="profile-active-audio-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>
                          🎙️ AI Coach hỏi ({seqItem.label}):
                        </span>
                        <button
                          type="button"
                          className="profile-play-btn"
                          onClick={playCurrentAudio}
                          disabled={isPlayingAudio}
                        >
                          {isPlayingAudio ? '🔊 Đang phát...' : '▶️ Nghe lại câu hỏi'}
                        </button>
                      </div>

                      <div className="profile-input-group">
                        <input
                          id={`profile-answer-input-${idx}`}
                          type="text"
                          className="profile-answer-input"
                          placeholder="Gõ câu trả lời của bạn vào đây..."
                          value={currentInput}
                          disabled={disabled}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCheckCurrent()
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          id="profileSubmitBtn"
                          className="profile-submit-btn"
                          disabled={!currentInput.trim() || disabled}
                          onClick={handleCheckCurrent}
                        >
                          Check ✓
                        </button>
                      </div>

                      {feedbackMessage && (
                        <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '6px 10px', borderRadius: '6px' }}>
                          💡 Gợi ý: {feedbackMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
  )
}
