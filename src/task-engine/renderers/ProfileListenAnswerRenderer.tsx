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

    setSequence([...items])
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
      // Sai: hiển thị Try again
      setStepStatuses({
        ...stepStatuses,
        [currentStepIndex]: {
          correct: false,
          userText: trimmedInput,
          attempts: prevAttempts + 1,
          hint: 'Try again',
        },
      })
      setFeedbackMessage('Try again')
    }
  }

  const handleRestartAll = () => {
    initQuestionSequence()
    onRestart?.()
  }

  if (isAllFinished) {
    return (
      <div className="profile-qa-container" style={{ width: '100%', boxSizing: 'border-box' }}>
        <section className="profile-all-summary" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '40px' }}>🎉</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#166534' }}>
            Congratulation
          </h2>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
            Bạn đã nghe hiểu và trả lời chính xác toàn bộ thông tin trong hồ sơ của bạn học!
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', margin: '8px auto', background: '#f0fdf4', border: '1.5px solid #86efac', padding: '8px 24px', borderRadius: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>Điểm số:</span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#15803d' }}>100</span>
            <span style={{ fontSize: '14px', color: '#166534' }}>/100</span>
          </div>

          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', boxSizing: 'border-box' }}>
            {sequence.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontWeight: 600, color: '#334155' }}>{idx + 1}. {item.label}:</span>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>
                  {stepStatuses[idx]?.userText || item.profile_value} ✓
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
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
      <div className="profile-qa-conversation" style={{ boxSizing: 'border-box', width: '100%' }}>
        <div className="profile-dialogue-list">
          {sequence.map((seqItem, idx) => {
            const status = stepStatuses[idx]
            const isCurrent = idx === currentStepIndex
            const isDone = Boolean(status?.correct || idx < currentStepIndex)

            if (isDone) {
              return (
                <div
                  key={idx}
                  className="profile-question-card completed"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#166534', fontSize: '14px' }}>
                    {idx + 1}. You: {status?.userText || seqItem.profile_value}
                  </span>
                  <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '16px' }}>✓</span>
                </div>
              )
            }

            if (isCurrent) {
              return (
                <div
                  key={idx}
                  className="profile-question-card active"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '2px solid #0284c7',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                      🎙️ AI Coach
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        id="profileSubmitBtn"
                        className="profile-submit-btn"
                        disabled={!currentInput.trim() || disabled}
                        onClick={handleCheckCurrent}
                        style={{ minWidth: '100px' }}
                      >
                        Check ✓
                      </button>
                    </div>
                  </div>

                  {feedbackMessage && (
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#b91c1c',
                      background: '#fee2e2',
                      border: '1.5px solid #fca5a5',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span>⚠️</span>
                      <span>Try again</span>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div
                key={idx}
                className="profile-question-card locked"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  color: '#94a3b8',
                  fontSize: '14px',
                  gap: '8px',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontWeight: 600 }}>{idx + 1}.</span>
                <span>___________________________</span>
              </div>
            )
          })}
        </div>
      </div>
      </div>
  )
}
