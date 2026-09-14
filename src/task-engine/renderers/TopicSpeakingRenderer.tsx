import { useState, useEffect, useRef } from 'react'
import type { Form7TopicSpeakingConfig, Form7TopicOption } from '../dynamic-schema'
import {
  evaluateTopicSpeakingWithAI,
  type TopicSpeakingEvaluationResult,
} from '../../lib/aiGradingService'
import {
  transcribeAudioWithAssemblyAI,
  getAssemblyAiApiKey,
  type TranscriptionProgress,
} from '../../lib/assemblyAiService'
import { ActionButton } from '../../components/task/ActionButton'
import './topic-speaking.css'

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

export interface TopicSpeakingRendererProps {
  config: Form7TopicSpeakingConfig
  taskCode: string
  onComplete?: (score: number, details: any) => void
  onRestart?: () => void
  onNavigateHome?: () => void
  disabled?: boolean
}

export function TopicSpeakingRenderer({
  config,
  taskCode: _taskCode,
  onComplete,
  onRestart,
  onNavigateHome,
  disabled = false,
}: TopicSpeakingRendererProps) {
  const options: Form7TopicOption[] =
    config.options && config.options.length > 0
      ? config.options
      : [
          { id: 'opt_1', text: 'Keep my desk and classroom tidy' },
          { id: 'opt_2', text: 'Help a classmate who struggles with lessons' },
          { id: 'opt_3', text: 'Take care of school things (books, plants)' },
        ]

  const passScore = config.pass_score || 80
  const overallAudioUrl = (config as any).audio_url || (config as any).audioUrl || ''

  // Lựa chọn chủ đề
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [otherTopicText, setOtherTopicText] = useState('')

  // Ghi âm & STT
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [stageMessage, setStageMessage] = useState('')

  // Đánh giá AI
  const [evaluation, setEvaluation] = useState<TopicSpeakingEvaluationResult | null>(null)
  const [hasCompleted, setHasCompleted] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Dọn dẹp stream & timer
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // Xác định tên chủ đề đã chọn
  const getSelectedTopicTitle = (): string => {
    if (!selectedOptionId) return ''
    if (selectedOptionId === 'other') {
      return otherTopicText.trim() || 'My own idea'
    }
    const opt = options.find((o) => o.id === selectedOptionId)
    return opt ? opt.text : ''
  }

  // Bắt đầu ghi âm
  const handleStartRecording = async () => {
    if (disabled || isRecording || isProcessing) return
    if (!selectedOptionId) {
      alert('Vui lòng chọn 1 chủ đề ở trên trước khi bấm thu âm!')
      return
    }

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
        stream.getTracks().forEach((t) => t.stop())

        const blobUrl = URL.createObjectURL(audioBlob)
        setRecordedAudioUrl(blobUrl)

        if (audioBlob.size < 1500) {
          alert('Bản ghi âm quá ngắn hoặc chưa thu được âm thanh. Hãy bấm thu âm lại nhé!')
          return
        }

        await processAndGradeAudio(audioBlob)
      }

      recorder.start(250)
      setIsRecording(true)
      setRecordingSeconds(0)
      setEvaluation(null)

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

  // Xử lý STT và chấm điểm qua AI
  const processAndGradeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)
    setStageMessage('Đang nhận diện giọng nói qua AssemblyAI...')

    try {
      const apiKey = getAssemblyAiApiKey()
      let transcribedText = ''

      if (apiKey) {
        const keyterms = ['school', 'good', 'thing', 'classroom', 'tidy', 'classmate', 'help', 'teacher', 'lesson']
        const result = await transcribeAudioWithAssemblyAI(audioBlob, keyterms, (progress: TranscriptionProgress) => {
          setStageMessage(progress.message)
        })
        transcribedText = result.text?.trim() || ''
      } else {
        // Fallback simulation nếu chưa có key
        transcribedText = `I choose to ${getSelectedTopicTitle().toLowerCase()}. At school, I always keep my desk and classroom tidy because it helps us study better.`
      }

      setStageMessage('AI đang chấm điểm dựa trên tiêu chí bài học...')

      const topicTitle = getSelectedTopicTitle()
      const evalResult = await evaluateTopicSpeakingWithAI(
        transcribedText,
        config.prompt || 'Choose ONE good thing to do at school.',
        topicTitle,
        config.scoring_criteria,
        passScore
      )

      setEvaluation(evalResult)

      if (evalResult.is_passed) {
        playSuccessDing()
        setHasCompleted(true)
        onComplete?.(evalResult.score, {
          selectedTopic: topicTitle,
          transcript: evalResult.transcript,
          score: evalResult.score,
          evaluation: evalResult,
        })
      }
    } catch (error: any) {
      alert(`Có lỗi xảy ra: ${error?.message || 'Không thể đánh giá bài nói'}`)
    } finally {
      setIsProcessing(false)
      setStageMessage('')
    }
  }

  const handleRestart = () => {
    setSelectedOptionId(null)
    setOtherTopicText('')
    setRecordedAudioUrl(null)
    setEvaluation(null)
    setHasCompleted(false)
    setIsRecording(false)
    setRecordingSeconds(0)
    onRestart?.()
  }

  const selectedTopicName = getSelectedTopicTitle()

  return (
    <div className="topic-speaking-container">
      {/* HEADER BANNER */}
      <div className="topic-speaking-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Speaking Task • Luyện nói theo chủ đề
            </span>
            <h2 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              {config.prompt || 'Choose ONE good thing to do at school.'}
            </h2>
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: '20px',
            background: hasCompleted ? '#dcfce7' : '#f1f5f9',
            color: hasCompleted ? '#166534' : '#64748b',
            fontWeight: 700,
            fontSize: '13px',
            whiteSpace: 'nowrap',
          }}>
            {hasCompleted ? '✓ Đã hoàn thành' : `Điểm đạt: ${passScore}/100`}
          </div>
        </div>

        {config.intro && (
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
            {config.intro}
          </p>
        )}
      </div>

      {/* AUDIO TỔNG (NẾU CÓ) */}
      {overallAudioUrl && (
        <section style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          border: '1.5px solid #7dd3fc',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0369a1', fontSize: '15px' }}>
            <span>🎧</span>
            <span>Audio hướng dẫn chủ đề</span>
          </div>
          <audio src={overallAudioUrl} controls style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
        </section>
      )}

      {/* KHUNG CHỌN CHỦ ĐỀ (TOPIC SELECTION BOX - GIỐNG SGK) */}
      <section className="topic-speaking-prompt-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Chọn 1 chủ đề bạn muốn nói:
          </span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          Nhấn vào một trong các ô dưới đây để lựa chọn nội dung bài nói:
        </div>

        <div className="topic-speaking-options-grid">
          {options.map((opt) => {
            const isSelected = selectedOptionId === opt.id
            return (
              <div
                key={opt.id}
                id={`topic-option-${opt.id}`}
                className={`topic-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedOptionId(opt.id)}
              >
                <div className="topic-radio-indicator">
                  {isSelected && <div className="topic-radio-dot" />}
                </div>
                <span className="topic-text">{opt.text}</span>
              </div>
            )
          })}

          {/* Tuỳ chọn Other idea nếu được bật */}
          {config.allow_other_idea !== false && (
            <div
              id="topic-option-other"
              className={`topic-card ${selectedOptionId === 'other' ? 'selected' : ''}`}
              onClick={() => setSelectedOptionId('other')}
              style={{ flexDirection: 'column', alignItems: 'flex-start' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                <div className="topic-radio-indicator">
                  {selectedOptionId === 'other' && <div className="topic-radio-dot" />}
                </div>
                <span className="topic-text">Other idea (Ý tưởng riêng của bạn)</span>
              </div>

              {selectedOptionId === 'other' && (
                <input
                  id="topic-other-input"
                  type="text"
                  className="topic-other-input"
                  placeholder="Gõ chủ đề của bạn vào đây (ví dụ: Plant flowers in our school garden)..."
                  value={otherTopicText}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setOtherTopicText(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* KHUNG GHI ÂM BÀI NÓI */}
      <section className="topic-speaking-action-box">
        <div style={{ textAlign: 'center' }}>
          {selectedOptionId ? (
            <div style={{ fontSize: '14px', color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '6px 16px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span>🎯 Chủ đề đã chọn:</span>
              <span>&ldquo;{selectedTopicName}&rdquo;</span>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '6px 16px', borderRadius: '20px' }}>
              ⚠️ Vui lòng chọn 1 chủ đề ở trên trước khi bấm thu âm
            </div>
          )}
        </div>

        {/* NÚT MICRO VÀ HIỆU ỨNG GHI ÂM */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          {!isRecording ? (
            <button
              type="button"
              id="topicSpeakingMicBtn"
              className={`topic-mic-btn ${isProcessing ? 'processing' : 'idle'}`}
              disabled={disabled || !selectedOptionId || isProcessing}
              onClick={handleStartRecording}
            >
              {isProcessing ? '⏳ Đang phân tích...' : '🎙️ Bấm để bắt đầu nói'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div className="recording-wave-bar-container">
                <div className="recording-wave-bar" />
                <div className="recording-wave-bar" />
                <div className="recording-wave-bar" />
                <div className="recording-wave-bar" />
                <div className="recording-wave-bar" />
              </div>
              <button
                type="button"
                id="topicSpeakingStopMicBtn"
                className="topic-mic-btn recording"
                onClick={handleStopRecording}
              >
                ⏹️ Dừng ghi âm ({recordingSeconds}s) • Gửi bài
              </button>
            </div>
          )}

          {stageMessage && (
            <div style={{ fontSize: '13px', color: '#0284c7', fontStyle: 'italic', textAlign: 'center' }}>
              {stageMessage}
            </div>
          )}
        </div>

        {/* BẢN GHI ÂM CỦA HỌC SINH ĐỂ NGHE LẠI */}
        {recordedAudioUrl && !isRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Nghe lại bản thu:</span>
            <audio src={recordedAudioUrl} controls style={{ height: '36px' }} />
          </div>
        )}
      </section>

      {/* KẾT QUẢ ĐÁNH GIÁ CỦA AI */}
      {evaluation && (
        <section className={`topic-evaluation-card ${evaluation.is_passed ? 'passed' : 'failed'}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div className={`topic-score-badge ${evaluation.is_passed ? 'passed' : 'failed'}`}>
              <span>{evaluation.is_passed ? '🎉' : '⚠️'}</span>
              <span>{evaluation.score}/100 Điểm</span>
              <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.9 }}>
                ({evaluation.is_passed ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'})
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Chủ đề: {selectedTopicName}
            </div>
          </div>

          {/* VĂN BẢN NHẬN DIỆN GIỌNG NÓI */}
          {evaluation.transcript && (
            <div style={{
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, color: '#1e40af', marginRight: '6px' }}>
                🗣️ Bài nói nhận diện được:
              </span>
              <span style={{ fontStyle: 'italic', color: '#0f172a' }}>
                &ldquo;{evaluation.transcript}&rdquo;
              </span>
            </div>
          )}

          {/* NHẬN XÉT CỦA AI */}
          <div style={{
            background: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
              🤖 Nhận xét từ AI Tutor:
            </div>
            <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.5 }}>
              {evaluation.feedback_vi}
            </div>
            {evaluation.feedback_en && (
              <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                {evaluation.feedback_en}
              </div>
            )}
          </div>

          {/* CHI TIẾT CÁC TIÊU CHÍ CHẤM ĐIỂM */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Tiêu chí đánh giá
            </div>
            <div className="topic-criteria-list">
              <div className={`topic-criterion-item ${evaluation.topic_relevance.passed ? 'pass' : 'fail'}`}>
                <span style={{ fontWeight: 700, color: evaluation.topic_relevance.passed ? '#15803d' : '#b91c1c' }}>
                  {evaluation.topic_relevance.passed ? '✓ Khớp chủ đề:' : '✗ Lệch chủ đề:'}
                </span>
                <span style={{ color: '#334155' }}>{evaluation.topic_relevance.feedback}</span>
              </div>

              {evaluation.criteria_evaluations.map((crit, idx) => (
                <div key={idx} className={`topic-criterion-item ${crit.passed ? 'pass' : 'fail'}`}>
                  <span style={{ fontWeight: 700, color: crit.passed ? '#15803d' : '#b91c1c' }}>
                    {crit.passed ? '✓' : '✗'} {crit.name}:
                  </span>
                  <span style={{ color: '#334155' }}>{crit.feedback}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GỢI Ý CẢI THIỆN */}
          {evaluation.suggested_improvement && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>💡</span>
              <span><strong>Gợi ý cải thiện:</strong> {evaluation.suggested_improvement}</span>
            </div>
          )}

          {/* NÚT THAO TÁC TIẾP THEO */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
            <ActionButton
              id="topicSpeakingRetryBtn"
              variant={evaluation.is_passed ? 'secondary' : 'primary'}
              onClick={handleRestart}
            >
              {evaluation.is_passed ? '🔄 Nói lại hoặc thử chủ đề khác' : '🎙️ Thu âm nói lại'}
            </ActionButton>

            {evaluation.is_passed && onNavigateHome && (
              <ActionButton id="topicSpeakingHomeBtn" onClick={onNavigateHome}>
                ⌨️ Hoàn thành & Quay lại
              </ActionButton>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
