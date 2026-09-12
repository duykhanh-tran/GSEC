import { useState, useEffect, useRef } from 'react'
import type { Form62InterviewConfig, Form62InterviewFieldItem } from '../dynamic-schema'
import { matchQuestionToField, checkProfileAnswerMatch } from '../../lib/questionBankMatcher'
import {
  transcribeAudioWithAssemblyAI,
  getAssemblyAiApiKey,
  type TranscriptionProgress,
} from '../../lib/assemblyAiService'
import { ActionButton } from '../../components/task/ActionButton'
import './interview-fill-profile.css'

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

export interface InterviewFillProfileRendererProps {
  config: Form62InterviewConfig
  taskCode: string
  onComplete?: (score: number, details: any) => void
  onRestart?: () => void
  onNavigateHome?: () => void
  disabled?: boolean
}

export function InterviewFillProfileRenderer({
  config,
  taskCode: _taskCode,
  onComplete,
  onRestart,
  onNavigateHome,
  disabled = false,
}: InterviewFillProfileRendererProps) {
  const items: Form62InterviewFieldItem[] = config.items && config.items.length > 0 ? config.items : [
    {
      id: 'name',
      label: 'Name',
      target_answer: 'Nam',
      accepted_values: ['Nam', 'his name is Nam'],
      answer_audio_url: '',
      answer_text_display: 'His name is Nam.',
      question_bank: [
        "What is his name?",
        "What's his name?",
        "Who is he?",
        "Can you tell me his name?",
        "Tell me his name",
      ],
      hints: ['Hãy hỏi về tên của bạn ấy (ví dụ: What is his name?).'],
    },
    {
      id: 'class',
      label: 'Class',
      target_answer: '6A',
      accepted_values: ['6A', 'class 6A', 'in class 6A'],
      answer_audio_url: '',
      answer_text_display: 'He is in class 6A.',
      question_bank: [
        "Which class is he in?",
        "What class is he in?",
        "Which class?",
        "What is his class?",
      ],
      hints: ['Hãy hỏi về lớp học của bạn ấy (ví dụ: Which class is he in?).'],
    },
    {
      id: 'subject',
      label: 'Favourite subject',
      target_answer: 'English',
      accepted_values: ['English', 'his favourite subject is English'],
      answer_audio_url: '',
      answer_text_display: 'His favourite subject is English.',
      question_bank: [
        "What is his favourite subject?",
        "What's his favourite subject?",
        "What is his favorite subject?",
        "Which subject does he like?",
        "What subject does he like most?",
      ],
      hints: ['Hãy hỏi về môn học yêu thích (ví dụ: What is his favourite subject?).'],
    },
    {
      id: 'activity',
      label: 'Activity after',
      target_answer: 'play football',
      accepted_values: ['play football', 'plays football', 'he plays football'],
      answer_audio_url: '',
      answer_text_display: 'He usually plays football after school.',
      question_bank: [
        "What does he do after school?",
        "What is his activity after school?",
        "What does he usually do after school?",
        "What activity does he do?",
      ],
      hints: ['Hãy hỏi về hoạt động sau giờ học (ví dụ: What does he do after school?).'],
    },
  ]

  // Trạng thái điền hồ sơ (Profile Inputs)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    name: '',
    class: '',
    subject: '',
    activity: '',
  })
  const [fieldStatuses, setFieldStatuses] = useState<Record<string, { correct?: boolean; hint?: string }>>({})

  // Trạng thái ghi âm & AssemblyAI
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isProcessingSTT, setIsProcessingSTT] = useState(false)
  const [sttStageMessage, setSttStageMessage] = useState('')
  const [lastUserQuestion, setLastUserQuestion] = useState<string | null>(null)
  const [tutorResponse, setTutorResponse] = useState<{ text: string; audioUrl?: string; fieldId?: string } | null>(null)
  const [unlockedAudios, setUnlockedAudios] = useState<Record<string, string>>({})
  const [playingFieldId, setPlayingFieldId] = useState<string | null>(null)
  const [lastMatchedFieldId, setLastMatchedFieldId] = useState<string | null>(null)
  const [isAllCompleted, setIsAllCompleted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Dọn dẹp stream microphone & timer khi unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Bắt đầu ghi âm câu hỏi
  const handleStartRecording = async () => {
    if (disabled || isRecording || isProcessingSTT) return
    setSubmitError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      let mimeType = ''
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        // Dừng microphone stream an toàn sau khi ghi nhận blob
        stream.getTracks().forEach((track) => track.stop())
        if (audioBlob.size < 1500) {
          setTutorResponse({
            text: 'Bản ghi âm quá ngắn hoặc chưa thu được giọng nói. Bạn hãy bấm thu âm lại và đặt câu hỏi to rõ ràng nhé!',
          })
          return
        }
        await processSpokenQuestion(audioBlob)
      }

      recorder.start(250)
      setIsRecording(true)
      setRecordingSeconds(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      alert('Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt.')
    }
  }

  // Dừng ghi âm
  const handleStopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setIsRecording(false)
    mediaRecorderRef.current.stop()
  }

  // Gửi audio sang AssemblyAI và xử lý phản hồi
  const processSpokenQuestion = async (audioBlob: Blob) => {
    setIsProcessingSTT(true)
    setSttStageMessage('Đang nhận diện giọng nói qua AssemblyAI...')

    try {
      const apiKey = getAssemblyAiApiKey()
      let transcribedText = ''

      if (apiKey) {
        const keyterms = ['name', 'class', 'subject', 'favourite', 'activity', 'school', 'what', 'who', 'which']
        const result = await transcribeAudioWithAssemblyAI(audioBlob, keyterms, (progress: TranscriptionProgress) => {
          setSttStageMessage(progress.message)
        })
        transcribedText = result.text?.trim() || ''
      } else {
        // Fallback mô phỏng nếu chưa gắn key
        transcribedText = "What's his name?"
      }

      setLastUserQuestion(transcribedText)

      // Đối chiếu câu hỏi với ngân hàng câu hỏi
      const matchResult = matchQuestionToField(transcribedText, items)

      if (matchResult.matchedFieldId) {
        const matchedItem = items.find((it) => it.id === matchResult.matchedFieldId)
        if (matchedItem) {
          // Bỏ thẻ xanh lá cây (không hiển thị câu text trên màn hình)
          setTutorResponse(null)
          setLastMatchedFieldId(matchedItem.id)

          // Mở khóa âm thanh cho trường này
          setUnlockedAudios((prev) => ({
            ...prev,
            [matchedItem.id]: matchedItem.answer_audio_url || 'unlocked',
          }))

          // Loa bên cạnh ô nhập phát ngay lập tức
          playAnswerAudio(matchedItem)

          // Focus vào ô nhập tương ứng để học sinh sẵn sàng gõ câu trả lời
          setTimeout(() => {
            const inputEl = document.getElementById(`profile-field-${matchedItem.id}`)
            if (inputEl) {
              inputEl.focus()
            }
          }, 100)
        }
      } else {
        // Không khớp trường nào: Hướng dẫn học sinh đặt câu hỏi
        setLastMatchedFieldId(null)
        setTutorResponse({
          text: 'Chưa nhận diện được câu hỏi phù hợp. Bạn hãy thử hỏi: "What is his name?", "Which class is he in?", "What is his favourite subject?", hoặc "What does he do after school?" nhé!',
        })
      }
    } catch (error: any) {
      setLastMatchedFieldId(null)
      const msg = error?.message || 'Có lỗi xảy ra khi kết nối giọng nói. Hãy thử hỏi lại bằng câu ngắn gọn và rõ ràng hơn nhé!'
      setTutorResponse({
        text: msg,
      })
    } finally {
      setIsProcessingSTT(false)
      setSttStageMessage('')
    }
  }

  // Phát audio câu trả lời qua loa bên cạnh ô nhập
  const playAnswerAudio = (item: Form62InterviewFieldItem) => {
    setPlayingFieldId(item.id)
    if (item.answer_audio_url && item.answer_audio_url.trim()) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = item.answer_audio_url
        audioPlayerRef.current.play().catch(() => {
          setPlayingFieldId(null)
        })
      }
    } else {
      // Fallback TTS
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = item.answer_text_display || `His ${item.label} is ${item.target_answer}`
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        utterance.onend = () => setPlayingFieldId(null)
        utterance.onerror = () => setPlayingFieldId(null)
        window.speechSynthesis.speak(utterance)
      } else {
        setPlayingFieldId(null)
      }
    }
  }

  // Xử lý nộp bài và kiểm tra đáp án toàn bộ 4 trường
  const handleSubmitProfile = () => {
    if (disabled || isAllCompleted) return

    let allCorrect = true
    const newStatuses: Record<string, { correct: boolean; hint?: string }> = {}

    for (const item of items) {
      const userVal = fieldValues[item.id] || ''
      const isMatch = checkProfileAnswerMatch(userVal, item.target_answer, item.accepted_values)

      if (isMatch) {
        newStatuses[item.id] = { correct: true }
      } else {
        allCorrect = false
        newStatuses[item.id] = {
          correct: false,
          hint: item.hints?.[0] || `Chưa chính xác. Hãy đặt câu hỏi để nghe lại thông tin về ${item.label}.`,
        }
      }
    }

    setFieldStatuses(newStatuses)

    if (allCorrect) {
      playSuccessDing()
      setIsAllCompleted(true)
      setSubmitError(null)
      onComplete?.(100, { fieldValues })
    } else {
      setSubmitError('Một số thông tin chưa chính xác hoặc chưa điền. Hãy đặt câu hỏi và kiểm tra lại nhé!')
    }
  }

  const handleRestartAll = () => {
    setFieldValues({
      name: '',
      class: '',
      subject: '',
      activity: '',
    })
    setFieldStatuses({})
    setLastUserQuestion(null)
    setTutorResponse(null)
    setLastMatchedFieldId(null)
    setPlayingFieldId(null)
    setUnlockedAudios({})
    setIsAllCompleted(false)
    setSubmitError(null)
    onRestart?.()
  }

  const completedCount = items.filter((it) => fieldStatuses[it.id]?.correct).length

  return (
    <div className="interview-profile-container">
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingFieldId(null)}
        onError={() => setPlayingFieldId(null)}
        style={{ display: 'none' }}
      />

      {/* HEADER BANNER */}
      <div className="interview-header-banner">
        <div style={{ fontWeight: 600, color: '#1e293b', flex: 1 }}>
          🎙️ {config.intro && !config.intro.toLowerCase().includes('check task')
            ? config.intro
            : 'Đặt câu hỏi bằng tiếng Anh để khám phá thông tin và điền vào hồ sơ.'}
        </div>
        <div className="interview-progress-pill">
          {completedCount}/{items.length} hoàn thành
        </div>
      </div>

      {/* KHUNG ĐẶT CÂU HỎI QUA GIỌNG NÓI */}
      <section className="interview-voice-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
            🎤 Bước 1: Đặt câu hỏi bằng tiếng Anh
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Nhấn nút micro để đặt câu hỏi về tên, lớp, môn học hoặc hoạt động:
          </div>
        </div>

        <div className="interview-voice-controls">
          {!isRecording ? (
            <button
              type="button"
              id="interviewMicBtn"
              className={`interview-mic-btn ${isProcessingSTT ? 'processing' : 'idle'}`}
              disabled={disabled || isProcessingSTT || isAllCompleted}
              onClick={handleStartRecording}
            >
              {isProcessingSTT ? '⏳ Đang nhận diện...' : '🎙️ Bấm để đặt câu hỏi'}
            </button>
          ) : (
            <button
              type="button"
              id="interviewStopMicBtn"
              className="interview-mic-btn recording"
              onClick={handleStopRecording}
            >
              ⏹️ Dừng ghi âm ({recordingSeconds}s) • Gửi nhận diện
            </button>
          )}
        </div>

        {sttStageMessage && (
          <div style={{ textAlign: 'center', fontSize: '13px', color: '#0284c7', fontStyle: 'italic' }}>
            {sttStageMessage}
          </div>
        )}

        {/* BẢNG KẾT QUẢ CÂU HỎI & HƯỚNG DẪN (ĐÃ BỎ THẺ XANH LÁ CÂY ĐỂ BẮT BUỘC NGHE LOA) */}
        {(lastUserQuestion || (tutorResponse && !lastMatchedFieldId)) && (
          <div className="interview-chat-console">
            {lastUserQuestion && (
              <div className="interview-message-bubble user">
                <span className="interview-bubble-label">🗣️ Bạn vừa hỏi:</span>
                <span className="interview-user-query">&ldquo;{lastUserQuestion}&rdquo;</span>
              </div>
            )}
            {tutorResponse && !lastMatchedFieldId && (
              <div className="interview-message-bubble guide">
                <span className="interview-answer-icon">💡</span>
                <span style={{ fontSize: '13px', lineHeight: 1.5 }}>{tutorResponse.text}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* KHUNG ĐIỀN HỒ SƠ (TOÀN BỘ 4 MỤC HIỂN THỊ RÕ RÀNG VỚI LOA BÊN CẠNH) */}
      <section className="interview-profile-sheet">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
            📝 Bước 2: Điền thông tin vào hồ sơ (Fill in the profile)
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Lắng nghe câu trả lời từ loa để điền vào từng mục dưới đây:
          </div>
        </div>

        <div className="interview-fields-list">
          {items.map((item, idx) => {
            const status = fieldStatuses[item.id]
            const isAnswered = status?.correct === true
            const isWrong = status?.correct === false
            const isUnlocked = Boolean(unlockedAudios[item.id])
            const isPlayingThis = playingFieldId === item.id
            const isHighlighted = lastMatchedFieldId === item.id

            return (
              <div
                key={item.id}
                className={`interview-field-card ${isHighlighted ? 'active-target' : ''} ${isPlayingThis ? 'playing-sound' : ''}`}
              >
                <div className="interview-field-main">
                  <span className="interview-field-label">
                    {idx + 1}. {item.label}:
                  </span>
                  <div className="interview-input-wrap">
                    <input
                      id={`profile-field-${item.id}`}
                      type="text"
                      className={`interview-field-input ${isAnswered ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                      placeholder={isUnlocked ? 'Nhập câu trả lời vừa nghe...' : 'Hỏi qua micro để mở khóa...'}
                      value={fieldValues[item.id] || ''}
                      disabled={disabled || isAllCompleted}
                      onChange={(e) =>
                        setFieldValues({
                          ...fieldValues,
                          [item.id]: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSubmitProfile()
                        }
                      }}
                    />

                    {/* Loa bên cạnh ô nhập: Phát âm thanh câu trả lời */}
                    {isUnlocked ? (
                      <button
                        type="button"
                        id={`profile-audio-btn-${item.id}`}
                        className={`interview-field-audio-btn ${isPlayingThis ? 'playing' : 'active'}`}
                        title="Nghe lại câu trả lời"
                        onClick={() => playAnswerAudio(item)}
                      >
                        {isPlayingThis ? '🔊 Đang phát...' : '🔊 Nghe lại'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="interview-field-audio-btn locked"
                        title="Hãy hỏi qua micro ở Bước 1 để mở khóa âm thanh"
                        onClick={() => {
                          setSubmitError(`Hãy bấm micro ở Bước 1 và đọc câu hỏi về "${item.label}" để mở khóa loa!`)
                        }}
                      >
                        🔒 Chưa mở
                      </button>
                    )}

                    {isAnswered && <span className="interview-status-icon correct">✓</span>}
                    {isWrong && <span className="interview-status-icon wrong">✗</span>}
                  </div>
                </div>

                {isWrong && status.hint && (
                  <div className="interview-field-hint">
                    💡 {status.hint}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* NÚT SUBMIT */}
        <div className="interview-submit-section">
          {submitError && (
            <div className="interview-error-banner">
              ⚠️ {submitError}
            </div>
          )}

          {!isAllCompleted ? (
            <button
              type="button"
              id="interviewSubmitProfileBtn"
              className="interview-submit-btn"
              disabled={disabled}
              onClick={handleSubmitProfile}
            >
              🚀 Submit
            </button>
          ) : (
            <div className="interview-complete-box">
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534', marginBottom: '8px' }}>
                🎉 Task Complete • 100/100 Điểm!
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <ActionButton id="interviewRestartBtn" variant="secondary" onClick={handleRestartAll}>
                  🔄 Luyện lại
                </ActionButton>
                {onNavigateHome && (
                  <ActionButton id="interviewHomeBtn" onClick={onNavigateHome}>
                    ⌨️ Quay lại trang chủ
                  </ActionButton>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
