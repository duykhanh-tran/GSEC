import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import {
  transcribeAudioWithAssemblyAI,
  getAssemblyAiApiKey,
  type AssemblyAIWord,
  type TranscriptionProgress,
} from '../../lib/assemblyAiService'
import {
  scorePronunciation,
  type PronunciationScoreResult,
} from '../../lib/pronunciationScorer'
import type { Form5ListenRepeatConfig, ListenRepeatItemConfig } from '../dynamic-schema'
import './listen-repeat.css'

interface ListenRepeatRendererProps {
  config: Form5ListenRepeatConfig
  taskCode: string
  onComplete?: (finalScore: number, itemResults: Record<string, any>) => void
  onRestart?: () => void
  onNavigateHome?: () => void
  disabled?: boolean
}

export function ListenRepeatRenderer({
  config,
  taskCode: _taskCode,
  onComplete,
  onRestart,
  onNavigateHome,
  disabled = false,
}: ListenRepeatRendererProps) {
  const passScore = config.pass_score ?? 80

  // Danh sách câu hỏi (fallback nếu rỗng)
  const items: ListenRepeatItemConfig[] =
    config.items && config.items.length > 0
      ? config.items
      : [
          {
            id: 'q1',
            label: 'Sentence 1',
            target_text: 'What time do you get up in the morning?',
            hints: ['Lên giọng nhẹ ở cuối câu hỏi.'],
          },
          {
            id: 'q2',
            label: 'Sentence 2',
            target_text: 'I usually have breakfast at seven o\'clock.',
            hints: ['Nhấn trọng âm vào từ "usually" và "breakfast".'],
          },
        ]

  // Trạng thái câu hiện tại
  const [currentIndex, setCurrentIndex] = useState(0)
  const [maxUnlockedIndex, setMaxUnlockedIndex] = useState(0)
  const currentItem = items[currentIndex] || items[0]
  const currentItemId = String(currentItem.id || currentIndex + 1)

  // Lưu kết quả các câu đã làm: key là item.id
  const [completedItems, setCompletedItems] = useState<
    Record<string, { score: number; result: PronunciationScoreResult; audioUrl?: string }>
  >({})

  // Trạng thái âm thanh mẫu (Audio Model)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioSpeed, setAudioSpeed] = useState<1.0 | 0.8>(1.0)
  const audioModelRef = useRef<HTMLAudioElement | null>(null)

  // Trạng thái thu âm
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)

  // Trạng thái chấm điểm
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evalProgress, setEvalProgress] = useState<TranscriptionProgress | null>(null)
  const [currentScoreResult, setCurrentScoreResult] = useState<PronunciationScoreResult | null>(null)
  const [activeWordTooltip, setActiveWordTooltip] = useState<{
    word: string
    tip?: string
    confidence?: number
    status?: string
  } | null>(null)

  // Trạng thái hoàn thành toàn bộ bài
  const [isAllFinished, setIsAllFinished] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Dọn dẹp stream khi unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (audioModelRef.current) {
        audioModelRef.current.pause()
      }
    }
  }, [audioUrl])

  // Khi chuyển câu hỏi: reset audio mẫu và thu âm của câu mới
  useEffect(() => {
    // Dừng audio mẫu nếu đang phát
    if (audioModelRef.current) {
      audioModelRef.current.pause()
      audioModelRef.current.currentTime = 0
    }
    setIsPlayingAudio(false)
    setAudioProgress(0)

    // Reset thu âm
    setIsRecording(false)
    setRecordingSeconds(0)
    setAudioBlob(null)
    setAudioUrl(null)
    setMediaError(null)
    setIsEvaluating(false)
    setEvalProgress(null)
    setActiveWordTooltip(null)

    // Khôi phục kết quả của câu này nếu đã làm trước đó
    const prev = completedItems[currentItemId]
    if (prev) {
      setCurrentScoreResult(prev.result)
      if (prev.audioUrl) setAudioUrl(prev.audioUrl)
    } else {
      setCurrentScoreResult(null)
    }
  }, [currentIndex, currentItemId])

  // =========================================================================
  // 1. PHÁT AUDIO MẪU (File âm thanh hoặc Web Speech TTS bản ngữ)
  // =========================================================================
  const handleTogglePlayModelAudio = () => {
    if (isPlayingAudio) {
      if (audioModelRef.current) {
        audioModelRef.current.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setIsPlayingAudio(false)
      return
    }

    // Trường hợp 1: Có URL file âm thanh
    if (currentItem.audio_url && currentItem.audio_url.trim()) {
      if (!audioModelRef.current) {
        audioModelRef.current = new Audio(currentItem.audio_url.trim())
      } else {
        audioModelRef.current.src = currentItem.audio_url.trim()
      }

      audioModelRef.current.playbackRate = audioSpeed
      audioModelRef.current.onplay = () => setIsPlayingAudio(true)
      audioModelRef.current.onpause = () => setIsPlayingAudio(false)
      audioModelRef.current.onended = () => {
        setIsPlayingAudio(false)
        setAudioProgress(100)
      }
      audioModelRef.current.ontimeupdate = () => {
        if (audioModelRef.current && audioModelRef.current.duration) {
          setAudioProgress(
            (audioModelRef.current.currentTime / audioModelRef.current.duration) * 100
          )
        }
      }
      audioModelRef.current.onerror = () => {
        console.warn('Lỗi phát file audio, chuyển sang Web Speech TTS...')
        fallbackPlayTTS()
      }

      audioModelRef.current.play().catch((err) => {
        console.warn('Play error, using TTS fallback:', err)
        fallbackPlayTTS()
      })
    } else {
      // Trường hợp 2: Không có file audio, dùng Web Speech TTS chuẩn bản ngữ
      fallbackPlayTTS()
    }
  }

  const fallbackPlayTTS = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(currentItem.target_text)
    utterance.lang = 'en-US'
    utterance.rate = audioSpeed === 0.8 ? 0.8 : 0.95

    const voices = window.speechSynthesis.getVoices()
    const englishVoice = voices.find(
      (v) => (v.lang.startsWith('en') || v.lang.includes('US')) && !v.name.includes('Google')
    ) || voices.find((v) => v.lang.startsWith('en'))

    if (englishVoice) {
      utterance.voice = englishVoice
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true)
      setAudioProgress(10)
    }
    utterance.onend = () => {
      setIsPlayingAudio(false)
      setAudioProgress(100)
    }
    utterance.onerror = () => {
      setIsPlayingAudio(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  const handleSpeedChange = (speed: 1.0 | 0.8) => {
    setAudioSpeed(speed)
    if (audioModelRef.current) {
      audioModelRef.current.playbackRate = speed
    }
  }

  // =========================================================================
  // 2. GHI ÂM MICROPHONE CỦA HỌC SINH
  // =========================================================================
  const startRecording = async () => {
    try {
      setMediaError(null)
      setCurrentScoreResult(null)
      setActiveWordTooltip(null)

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
      }
      setAudioBlob(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
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

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setAudioBlob(finalBlob)
        const url = URL.createObjectURL(finalBlob)
        setAudioUrl(url)

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }

      recorder.start(250)
      setIsRecording(true)
      setRecordingSeconds(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Không thể mở micro:', err)
      setMediaError(
        err?.name === 'NotAllowedError'
          ? 'Trình duyệt chưa được cấp quyền micro. Vui lòng cho phép quyền truy cập micro.'
          : 'Không thể khởi động micro. Vui lòng kiểm tra thiết bị của bạn.'
      )
    }
  }

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  // =========================================================================
  // 3. CHẤM ĐIỂM BẰNG ASSEMBLYAI & PRONUNCIATION SCORER
  // =========================================================================
  const evaluateRecording = async () => {
    const targetBlob = audioBlob
    if (!targetBlob || targetBlob.size < 1500) {
      setMediaError(
        'Bản ghi âm quá ngắn hoặc không có âm thanh. Vui lòng bấm thu âm và đọc to rõ ràng ít nhất 1-2 giây trước khi dừng.'
      )
      return
    }

    setIsEvaluating(true)
    setEvalProgress({
      stage: 'uploading',
      message: 'Đang tải bản ghi âm lên hệ thống AI...',
      percent: 20,
    })
    setMediaError(null)

    try {
      const apiKey = getAssemblyAiApiKey()
      // Chỉ boost các tên riêng (Proper nouns) để tránh AssemblyAI ép nhận diện theo câu mẫu khi học sinh đọc từ khác
      const properNouns = currentItem.target_text
        .split(/\s+/)
        .filter((raw, idx) => idx > 0 && /^[A-Z]/.test(raw))
        .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '').trim())
        .filter((w) => w.length > 2)

      let heardText = ''
      let heardWords: AssemblyAIWord[] = []

      if (apiKey) {
        const result = await transcribeAudioWithAssemblyAI(targetBlob, properNouns, (prog) => {
          setEvalProgress(prog)
        })
        heardText = result.text || ''
        heardWords = result.words || []
      } else {
        throw new Error(
          'Chưa cấu hình AssemblyAI API Key. Vui lòng kiểm tra file .env (VITE_ASSEMBLYAI_API_KEY) hoặc cài đặt để kích hoạt tính năng chấm giọng nói thực tế.'
        )
      }

      // Động cơ chấm điểm phát âm 0 - 100 điểm
      const evaluation = scorePronunciation(currentItem.target_text, heardText, heardWords, passScore)
      setCurrentScoreResult(evaluation)

      // Cập nhật kết quả vào danh sách
      if (evaluation.score >= passScore) {
        const updated = {
          ...completedItems,
          [currentItemId]: {
            score: evaluation.score,
            result: evaluation,
            audioUrl: audioUrl || undefined,
          },
        }
        setCompletedItems(updated)

        // Kiểm tra nếu tất cả các câu đều đã qua
        const allPassed = items.every((it) => {
          const id = String(it.id || '')
          return updated[id] && updated[id].score >= passScore
        })

        if (allPassed) {
          setIsAllFinished(true)
          const totalScore = Object.values(updated).reduce((acc, curr) => acc + curr.score, 0)
          const averageScore = Math.round(totalScore / items.length)
          onComplete?.(averageScore, updated)
        }
      }
    } catch (err: any) {
      console.error('Lỗi khi chấm phát âm:', err)
      setMediaError(err?.message || 'Không thể đánh giá phát âm. Vui lòng thử lại.')
    } finally {
      setIsEvaluating(false)
      setEvalProgress(null)
    }
  }

  // Chuyển sang câu tiếp theo
  const handleGoNext = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setCurrentScoreResult(null)
    setActiveWordTooltip(null)
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setIsAllFinished(true)
    }
  }

  // Làm lại từ đầu
  const handleRestartAll = () => {
    setCompletedItems({})
    setCurrentIndex(0)
    setMaxUnlockedIndex(0)
    setIsAllFinished(false)
    setCurrentScoreResult(null)
    onRestart?.()
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const isCurrentItemPassed = currentScoreResult ? currentScoreResult.score >= passScore : false

  // =========================================================================
  // GIAI ĐOẠN 4: BẢNG TỔNG KẾT KHI ĐÃ HOÀN THÀNH TẤT CẢ CÁC CÂU (> 80%)
  // =========================================================================
  if (isAllFinished) {
    const totalScore = Object.values(completedItems).reduce((acc, curr) => acc + curr.score, 0)
    const averageScore = Math.round(totalScore / items.length)

    return (
      <div className="form-5-listen-repeat-container">
        <section className="lr-summary-panel">
          <div className="lr-summary-header">
            <div style={{ fontSize: '42px', marginBottom: '8px' }}>🎉</div>
            <h2>Task Complete • Chúc Mừng Bạn!</h2>
            <p>Bạn đã hoàn thành xuất sắc tất cả các câu nghe & lặp lại với điểm số trên {passScore}%.</p>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', marginTop: '16px', background: '#f0fdf4', border: '1.5px solid #86efac', padding: '10px 24px', borderRadius: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>Điểm trung bình:</span>
              <span style={{ fontSize: '32px', fontWeight: 900, color: '#15803d' }}>{averageScore}</span>
              <span style={{ fontSize: '15px', color: '#64748b' }}>/100</span>
            </div>
          </div>

          <div className="lr-summary-items-list">
            {items.map((item, idx) => {
              const res = completedItems[String(item.id || idx + 1)]
              const score = res?.score ?? 100
              return (
                <div key={item.id} className="lr-summary-row passed">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <strong>{item.label || `Câu ${idx + 1}`}</strong>
                    <span style={{ fontSize: '14px', color: '#334155' }}>"{item.target_text}"</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#15803d' }}>
                      {score}/100 ✓
                    </span>
                    <StatusTag tone="success">Đạt</StatusTag>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
            <ActionButton id="restartAllBtn" variant="secondary" onClick={handleRestartAll}>
              🔄 Làm lại cả bài (Try again)
            </ActionButton>
            <ActionButton id="homeNavBtn" onClick={onNavigateHome || (() => (window.location.href = '/?mode=code'))}>
              ⌨️ Quay lại trang nhập mã
            </ActionButton>
          </div>
        </section>
      </div>
    )
  }

  // =========================================================================
  // GIAO DIỆN LÀM BÀI TỪNG CÂU
  // =========================================================================
  return (
    <div className="form-5-listen-repeat-container">
      {/* 1. Header & Tiến trình */}
      <div className="lr-header">
        <div>
          <h2>{config.intro || 'Listen & Repeat • Nghe và phát âm theo mẫu'}</h2>
          <p>Nghe từng câu mẫu cẩn thận. Sau đó thu âm lặp lại và đạt trên {passScore}% để qua câu.</p>
        </div>
        <div className="lr-pass-badge">
          🎯 Tiêu chuẩn qua câu: <strong>{passScore}%</strong>
        </div>
      </div>

      {/* 2. Thanh điều hướng câu hỏi (Step Navigation - Mở từng câu một) */}
      <div className="lr-step-nav">
        {items.map((it, idx) => {
          const itId = String(it.id || idx + 1)
          const isPassed = Boolean(completedItems[itId] && completedItems[itId].score >= passScore)
          const isActive = idx === currentIndex
          // Khóa các câu phía trước nếu chưa đạt yêu cầu ở câu trước đó
          const isLocked = idx > maxUnlockedIndex

          return (
            <button
              key={it.id}
              type="button"
              className={`lr-step-pill ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''} ${isLocked ? 'locked' : ''}`}
              disabled={isLocked || disabled}
              onClick={() => {
                if (!isLocked) {
                  setCurrentIndex(idx)
                  setAudioBlob(null)
                  setAudioUrl(null)
                  setCurrentScoreResult(null)
                  setActiveWordTooltip(null)
                }
              }}
              title={isLocked ? 'Cần hoàn thành câu trước (> 80%) để mở khóa' : (it.label || `Câu ${idx + 1}`)}
            >
              <span>{it.label || `Câu ${idx + 1}`}</span>
              {isPassed ? <span>✓</span> : isLocked ? <span style={{ fontSize: '11px', opacity: 0.7 }}>🔒</span> : null}
            </button>
          )
        })}
      </div>

      {/* 3. Thẻ tương tác chính của câu hiện tại */}
      <div className="lr-card">
        {/* Header câu hiện tại (ĐÃ ẨN CÂU MẪU ĐỐI CHIẾU - CHỈ AI ĐỐI CHIẾU NGẦM) */}
        <div className="lr-target-sentence-box">
          <div className="lr-target-label">
            🎧 {currentItem.label || `Câu ${currentIndex + 1}`} • Nghe audio mẫu và thu âm lặp lại
          </div>
          {currentItem.hints && currentItem.hints.length > 0 && (
            <div className="lr-target-hint">
              <span>💡 Gợi ý phát âm:</span> {currentItem.hints.join(' • ')}
            </div>
          )}
        </div>

        {/* BƯỚC 1: KHUNG NGHE MẪU (NHỎ GỌN, KHOA HỌC) */}
        <div className="lr-compact-audio-bar">
          <button
            type="button"
            className={`lr-compact-play-btn ${isPlayingAudio ? 'playing' : ''}`}
            onClick={handleTogglePlayModelAudio}
            disabled={disabled || isRecording || isEvaluating}
            title={isPlayingAudio ? 'Dừng phát' : 'Nghe audio mẫu'}
          >
            {isPlayingAudio ? '⏸ Dừng' : '🔊 Nghe câu mẫu'}
          </button>

          <div className="lr-compact-audio-track">
            <div className="lr-compact-audio-fill" style={{ width: `${audioProgress}%` }} />
          </div>

          <div className="lr-compact-speed-box">
            <button
              type="button"
              className={`lr-speed-pill ${audioSpeed === 1.0 ? 'active' : ''}`}
              onClick={() => handleSpeedChange(1.0)}
            >
              1.0x
            </button>
            <button
              type="button"
              className={`lr-speed-pill ${audioSpeed === 0.8 ? 'active' : ''}`}
              onClick={() => handleSpeedChange(0.8)}
              title="Nghe chậm"
            >
              0.8x
            </button>
          </div>
        </div>

        {/* BƯỚC 2: KHUNG THU ÂM (GỌN GÀNG, KHOA HỌC) */}
        <div className={`lr-compact-recorder-bar ${isRecording ? 'is-recording' : ''}`}>
          <div className="lr-recorder-main-action">
            {!isRecording ? (
              <button
                type="button"
                className="lr-compact-mic-btn"
                onClick={startRecording}
                disabled={disabled || isEvaluating || isPlayingAudio}
                title="Bắt đầu thu âm"
              >
                🎙️
              </button>
            ) : (
              <button
                type="button"
                className="lr-compact-mic-btn recording"
                onClick={stopRecording}
                title="Dừng thu âm"
              >
                ⏹
              </button>
            )}

            <div className="lr-recorder-info">
              {isRecording ? (
                <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>
                  🔴 Đang thu âm ({formatTime(recordingSeconds)})... Đọc to rõ rồi nhấn Dừng
                </div>
              ) : audioUrl ? (
                <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>
                  ✓ Đã thu âm xong. Bấm "Chấm điểm AI" để gửi bài.
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  Nhấn biểu tượng Microphone để đọc lại câu vừa nghe
                </div>
              )}
            </div>
          </div>

          {mediaError && (
            <div style={{ color: '#dc2626', fontSize: '12px', background: '#fee2e2', padding: '4px 10px', borderRadius: '6px', width: '100%' }}>
              ⚠️ {mediaError}
            </div>
          )}

          {/* Nghe lại và Nút gửi chấm điểm */}
          {audioUrl && !isRecording && (
            <div className="lr-recorder-review-row">
              <audio controls src={audioUrl} style={{ height: '32px', flex: 1, maxWidth: '200px' }} />
              <button
                type="button"
                className="lr-eval-submit-btn"
                onClick={evaluateRecording}
                disabled={disabled || isEvaluating}
              >
                {isEvaluating ? '⏳ Đang chấm...' : '✨ Chấm điểm AI'}
              </button>
            </div>
          )}
        </div>

        {/* Trạng thái AI đang chấm */}
        {isEvaluating && (
          <div className="lr-eval-status">
            <div className="lr-eval-spinner" />
            <span>{evalProgress?.message || 'AssemblyAI đang phân tích ngữ âm và từ vựng...'}</span>
          </div>
        )}

        {/* BƯỚC 3: KẾT QUẢ TỐI GIẢN (MINIMALIST SCORE BOX) */}
        {currentScoreResult && !isEvaluating && (
          <div className={`lr-minimal-score-box ${isCurrentItemPassed ? 'passed' : 'failed'}`}>
            <div className="lr-minimal-score-top">
              <div className="lr-minimal-score-tag">
                <span className="lr-minimal-score-val">{currentScoreResult.score}</span>
                <span className="lr-minimal-score-denom">/100</span>
              </div>
              <div className="lr-minimal-score-desc">
                <strong>
                  {isCurrentItemPassed
                    ? `✓ Đạt yêu cầu (${currentScoreResult.score} điểm • Đạt trên ${passScore}%)`
                    : `⚠️ Chưa đạt (${currentScoreResult.score} điểm • Cần đạt trên ${passScore}%)`}
                </strong>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  {currentScoreResult.feedback_vi || (isCurrentItemPassed ? 'Phát âm tốt, chuẩn xác!' : 'Hãy nghe lại audio mẫu và thu âm lại câu này.')}
                </div>
              </div>
            </div>

            {/* PHẦN 1: ĐÁNH GIÁ TỪNG TỪ CỦA CÂU MẪU (Xanh lá / Vàng / Đỏ / Xám) */}
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🎯 Đánh giá câu mẫu theo từng từ:
              </div>
              {currentScoreResult.evaluatedWords && currentScoreResult.evaluatedWords.length > 0 && (
                <div className="lr-minimal-words-wrap">
                  {currentScoreResult.evaluatedWords
                    .filter((w) => Boolean(w.targetWord))
                    .map((word, wIdx) => {
                      const statusIcon =
                        word.status === 'correct' ? '✓' : word.status === 'unclear' ? '~' : word.status === 'missing' ? '—' : '✗'
                      return (
                        <button
                          key={wIdx}
                          type="button"
                          className={`lr-word-chip ${word.status}`}
                          onClick={() =>
                            setActiveWordTooltip({
                              word: word.targetWord,
                              tip: word.tip,
                              confidence: word.confidence,
                              status: word.status,
                            })
                          }
                          title={word.tip}
                        >
                          <span>{word.targetWord}</span>
                          <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 800 }}>
                            {statusIcon}
                          </span>
                        </button>
                      )
                    })}
                </div>
              )}

              {/* Chú thích màu trực quan */}
              <div className="color-legend-row">
                <div className="legend-item"><span className="legend-dot correct" /><span>Đọc đúng (Xanh lá)</span></div>
                <div className="legend-item"><span className="legend-dot unclear" /><span>Gần đúng (Vàng)</span></div>
                <div className="legend-item"><span className="legend-dot mispronounced" /><span>Đọc sai (Đỏ)</span></div>
                <div className="legend-item"><span className="legend-dot missing" /><span>Chưa đọc / Bỏ qua (Xám)</span></div>
              </div>
            </div>

            {/* PHẦN 2: CÂU HỌC SINH ĐÃ ĐỌC THỰC TẾ & GẠCH ĐỎ TỪ THỪA */}
            <div className="lr-spoken-sentence-card">
              <div className="lr-spoken-sentence-title">
                <span>🗣️ Câu bạn đã đọc:</span>
                {currentScoreResult.spokenWords?.some((w) => w.isExtra) && (
                  <span className="extra-word-tag">Gạch đỏ từ thừa</span>
                )}
              </div>
              {currentScoreResult.spokenWords && currentScoreResult.spokenWords.length > 0 ? (
                <div className="lr-spoken-words-list">
                  {currentScoreResult.spokenWords.map((sword, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      className={`lr-spoken-word-chip ${sword.isExtra ? 'extra' : sword.status}`}
                      onClick={() =>
                        setActiveWordTooltip({
                          word: sword.text,
                          tip: sword.tip,
                          confidence: sword.confidence,
                          status: sword.status,
                        })
                      }
                      title={sword.tip}
                    >
                      <span>{sword.text}</span>
                      {sword.isExtra && (
                        <span style={{ fontSize: '10px', marginLeft: '2px', textDecoration: 'none', color: '#b91c1c' }}>✗</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                  "{currentScoreResult.recognizedText || 'Chưa ghi nhận được giọng nói rõ ràng từ microphone.'}"
                </div>
              )}

              {currentScoreResult.spokenWords?.some((w) => w.isExtra) && (
                <div className="extra-words-warning-alert">
                  <span>⚠️</span>
                  <span>
                    Bạn đã đọc thừa từ ngoài câu mẫu. Những từ thừa này đã được <strong>gạch đỏ</strong>.
                  </span>
                </div>
              )}
            </div>

            {/* Tooltip khi bấm vào từ */}
            {activeWordTooltip && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px', marginTop: '4px' }}>
                <strong>"{activeWordTooltip.word}":</strong> {activeWordTooltip.tip || 'Chi tiết phát âm'}
                {typeof activeWordTooltip.confidence === 'number' && activeWordTooltip.confidence > 0 && (
                  <span style={{ color: '#64748b', marginLeft: '6px' }}>
                    (Độ tự tin âm học: {Math.round(activeWordTooltip.confidence * 100)}%)
                  </span>
                )}
              </div>
            )}

            {/* Nút hành động tối giản */}
            <div className="lr-minimal-action-row">
              {isCurrentItemPassed ? (
                <button
                  type="button"
                  className="lr-action-next-btn"
                  onClick={handleGoNext}
                >
                  {currentIndex < items.length - 1 ? 'Tiếp tục câu tiếp theo →' : '🎉 Xem bảng tổng kết hoàn thành ✓'}
                </button>
              ) : (
                <button
                  type="button"
                  className="lr-action-retry-btn"
                  onClick={() => {
                    setAudioBlob(null)
                    setAudioUrl(null)
                    setCurrentScoreResult(null)
                    setActiveWordTooltip(null)
                    startRecording()
                  }}
                >
                  🔄 Thu âm lại câu này
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}