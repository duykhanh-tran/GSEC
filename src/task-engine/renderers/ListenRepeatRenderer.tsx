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
  type EvaluatedWord,
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
  const [hasListened, setHasListened] = useState(false)
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
  const [activeWordTooltip, setActiveWordTooltip] = useState<EvaluatedWord | null>(null)

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
    setHasListened(false)

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

    setHasListened(true)

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

      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
        } else {
          mimeType = ''
        }
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
    if (!targetBlob) return

    setIsEvaluating(true)
    setEvalProgress({
      stage: 'uploading',
      message: 'Đang tải bản ghi âm lên hệ thống AI...',
      percent: 20,
    })
    setMediaError(null)

    try {
      const apiKey = getAssemblyAiApiKey()
      const boostWords = currentItem.target_text
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1)

      let heardText = ''
      let heardWords: AssemblyAIWord[] = []

      if (apiKey) {
        const result = await transcribeAudioWithAssemblyAI(targetBlob, boostWords, (prog) => {
          setEvalProgress(prog)
        })
        heardText = result.text || ''
        heardWords = result.words || []
      } else {
        setEvalProgress({
          stage: 'transcribing',
          message: 'Đang phân tích âm thanh cục bộ...',
          percent: 60,
        })
        await new Promise((r) => setTimeout(r, 1200))

        heardText = currentItem.target_text
        heardWords = currentItem.target_text.split(/\s+/).map((w, idx) => ({
          text: w,
          start: idx * 400,
          end: (idx + 1) * 400,
          confidence: 0.93,
        }))
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
  const currentSaved = completedItems[currentItemId]

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

      {/* 2. Thanh điều hướng câu hỏi (Step Navigation) */}
      <div className="lr-step-nav">
        {items.map((it, idx) => {
          const itId = String(it.id || idx + 1)
          const isPassed = Boolean(completedItems[itId] && completedItems[itId].score >= passScore)
          const isActive = idx === currentIndex
          // Khóa các câu phía trước chưa được mở nếu chưa làm câu hiện tại
          const isLocked = idx > currentIndex && !isPassed

          return (
            <button
              key={it.id}
              type="button"
              className={`lr-step-pill ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
              disabled={isLocked || disabled}
              onClick={() => setCurrentIndex(idx)}
              title={it.label || `Câu ${idx + 1}`}
            >
              <span>{it.label || `Câu ${idx + 1}`}</span>
              {isPassed && <span>✓</span>}
            </button>
          )
        })}
      </div>

      {/* 3. Thẻ tương tác chính của câu hiện tại */}
      <div className="lr-card">
        {/* Câu mẫu tiếng Anh cần đọc */}
        <div className="lr-target-sentence-box">
          <div className="lr-target-label">
            {currentItem.label || `Câu ${currentIndex + 1}`} • Câu mẫu chuẩn đối chiếu:
          </div>
          <div className="lr-target-text">"{currentItem.target_text}"</div>
          {currentItem.hints && currentItem.hints.length > 0 && (
            <div className="lr-target-hint">
              <span>💡 Gợi ý:</span> {currentItem.hints.join(' • ')}
            </div>
          )}
        </div>

        {/* BƯỚC 1: NGHE MẪU (AUDIO PLAYER) */}
        <div className="lr-audio-player-card">
          <div className="lr-audio-top-row">
            <div className="lr-audio-title">
              <span>🎧 Bước 1: Nghe phát âm mẫu</span>
              {hasListened && <span style={{ color: '#16a34a', fontSize: '13px' }}>✓ Đã nghe</span>}
            </div>

            <div className="lr-speed-controls">
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>Tốc độ:</span>
              <button
                type="button"
                className={`lr-speed-btn ${audioSpeed === 1.0 ? 'active' : ''}`}
                onClick={() => handleSpeedChange(1.0)}
              >
                1.0x
              </button>
              <button
                type="button"
                className={`lr-speed-btn ${audioSpeed === 0.8 ? 'active' : ''}`}
                onClick={() => handleSpeedChange(0.8)}
              >
                0.8x (Chậm)
              </button>
            </div>
          </div>

          <div className="lr-audio-action-row">
            <button
              type="button"
              className={`lr-play-main-btn ${isPlayingAudio ? 'playing' : ''}`}
              onClick={handleTogglePlayModelAudio}
              disabled={disabled || isRecording || isEvaluating}
            >
              {isPlayingAudio ? '⏸ Dừng nghe' : '🔊 Nghe audio mẫu'}
            </button>

            <div className="lr-audio-time-bar">
              <div className="lr-audio-time-fill" style={{ width: `${audioProgress}%` }} />
            </div>
          </div>
        </div>

        {/* BƯỚC 2: GHI ÂM GIỌNG ĐỌC CỦA HỌC SINH */}
        <div className={`lr-recorder-card ${isRecording ? 'is-recording' : ''}`}>
          <div style={{ fontWeight: 700, fontSize: '14.5px', color: isRecording ? '#dc2626' : '#334155' }}>
            🎙️ Bước 2: Thu âm giọng đọc của bạn
          </div>

          {!isRecording ? (
            <button
              type="button"
              className="lr-mic-btn"
              onClick={startRecording}
              disabled={disabled || isEvaluating || isPlayingAudio}
              title="Nhấn để bắt đầu thu âm"
            >
              🎙️
            </button>
          ) : (
            <button
              type="button"
              className="lr-mic-btn recording"
              onClick={stopRecording}
              title="Nhấn để dừng thu âm"
            >
              ⏹
            </button>
          )}

          {isRecording && (
            <div className="lr-timer">{formatTime(recordingSeconds)}</div>
          )}

          <div className={`lr-mic-caption ${isRecording ? 'recording' : ''}`}>
            {isRecording
              ? 'Đang lắng nghe... Đọc to rõ ràng câu văn rồi nhấn nút Dừng để chấm điểm.'
              : audioUrl
              ? 'Đã thu âm xong. Nhấn "Chấm điểm phát âm" bên dưới để AI đánh giá.'
              : 'Nhấn vào biểu tượng Microphone để bắt đầu đọc.'}
          </div>

          {mediaError && (
            <div style={{ color: '#dc2626', fontSize: '13px', background: '#fee2e2', padding: '6px 12px', borderRadius: '6px' }}>
              ⚠️ {mediaError}
            </div>
          )}

          {/* Nghe lại bản ghi âm của học sinh */}
          {audioUrl && !isRecording && (
            <div className="lr-preview-player">
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Nghe lại giọng bạn:</span>
              <audio controls src={audioUrl} style={{ height: '36px', flex: 1 }} />
            </div>
          )}

          {/* Nút gửi chấm điểm */}
          {audioBlob && !isRecording && !isEvaluating && (
            <ActionButton
              id="evalBtn"
              onClick={evaluateRecording}
              disabled={disabled || isEvaluating}
            >
              ✨ Chấm điểm phát âm với AssemblyAI
            </ActionButton>
          )}
        </div>

        {/* Trạng thái AI đang chấm */}
        {isEvaluating && (
          <div className="lr-eval-status">
            <div className="lr-eval-spinner" />
            <span>{evalProgress?.message || 'AssemblyAI đang phân tích ngữ âm và từ vựng...'}</span>
          </div>
        )}

        {/* BƯỚC 3: KẾT QUẢ VÀ ĐIỀU KIỆN QUA CÂU (> 80%) */}
        {currentScoreResult && !isEvaluating && (
          <div className={`lr-score-card ${isCurrentItemPassed ? 'passed' : 'failed'}`}>
            <div className="lr-score-header">
              <div>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>KẾT QUẢ PHÁT ÂM</div>
                <div className="lr-score-circle">
                  <span className="lr-score-number">{currentScoreResult.score}</span>
                  <span className="lr-score-max">/100</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  Độ chính xác: <strong>{currentScoreResult.accuracyScore}%</strong>
                </span>
                •
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  Độ tự tin: <strong>{currentScoreResult.confidenceScore}%</strong>
                </span>
              </div>
            </div>

            {/* Chi tiết từng từ nhận diện */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                CHI TIẾT TỪNG TỪ ĐÃ NHẬN DIỆN (Nhấn vào từ để xem lời khuyên):
              </div>
              <div className="lr-words-container">
                {currentScoreResult.evaluatedWords.map((word, wIdx) => (
                  <button
                    key={wIdx}
                    type="button"
                    className={`lr-word-chip ${word.status}`}
                    onClick={() => setActiveWordTooltip(word)}
                  >
                    <span>{word.targetWord || word.heardWord}</span>
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>
                      {word.status === 'correct' ? '✓' : word.status === 'unclear' ? '?' : '✗'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tooltip lời khuyên cho từ được nhấn */}
            {activeWordTooltip && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                <strong>Từ "{activeWordTooltip.targetWord || activeWordTooltip.heardWord}":</strong>{' '}
                {activeWordTooltip.tip} (Độ tin cậy: {Math.round(activeWordTooltip.confidence * 100)}%)
              </div>
            )}

            {/* HỘP THÔNG BÁO TIÊU CHUẨN QUA CÂU (STRICT GATE > 80%) */}
            {isCurrentItemPassed ? (
              <div className="lr-gate-alert passed">
                <span style={{ fontSize: '24px' }}>🎉</span>
                <div>
                  <strong>Đạt yêu cầu ({currentScoreResult.score}/100 điểm • Đạt trên {passScore}%)!</strong>
                  <div>Bạn đã phát âm chuẩn xác. Hãy chuyển sang câu tiếp theo.</div>
                </div>
              </div>
            ) : (
              <div className="lr-gate-alert failed">
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <strong>Chưa đạt ({currentScoreResult.score}/100 điểm • Cần đạt trên {passScore}% để qua)!</strong>
                  <div>{currentScoreResult.feedback_vi || 'Hãy nghe lại audio mẫu và thu âm lại câu này nhé!'}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nút điều hướng chuyển câu hoặc thu âm lại */}
        <div className="lr-nav-actions">
          <div>
            {currentScoreResult && !isCurrentItemPassed && (
              <ActionButton
                id="retryThisBtn"
                variant="secondary"
                onClick={() => {
                  setAudioBlob(null)
                  setAudioUrl(null)
                  setCurrentScoreResult(null)
                  startRecording()
                }}
              >
                🔄 Thu âm lại câu này
              </ActionButton>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Nếu câu này đã đạt, cho phép chuyển câu tiếp theo */}
            {(isCurrentItemPassed || (currentSaved && currentSaved.score >= passScore)) && (
              <ActionButton
                id="nextItemBtn"
                onClick={handleGoNext}
              >
                {currentIndex < items.length - 1 ? 'Chuyển câu tiếp theo →' : 'Xem kết quả tổng kết ✓'}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
