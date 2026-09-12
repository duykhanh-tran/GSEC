import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../../components/task/ActionButton'
import {
  transcribeAudioWithAssemblyAI,
  getAssemblyAiApiKey,
  type AssemblyAIWord,
  type TranscriptionProgress,
} from '../../lib/assemblyAiService'
import {
  scorePronunciation,
  cleanWord,
  type PronunciationScoreResult,
} from '../../lib/pronunciationScorer'
import { evaluateSpeakingWithAI } from '../../lib/aiGradingService'
import {
  getApprovedWriting,
  type ApprovedWritingData,
} from '../../lib/studentWritingStorageService'
import type { Form4SpeakingConfig } from '../dynamic-schema'
import './speaking-pronunciation.css'

interface SpeakingPronunciationRendererProps {
  config: Form4SpeakingConfig
  taskCode: string
  onComplete?: (score: number, result: PronunciationScoreResult) => void
  onRestart?: () => void
  onNavigateHome?: () => void
  disabled?: boolean
}

export function SpeakingPronunciationRenderer({
  config,
  taskCode: _taskCode,
  onComplete,
  onRestart,
  onNavigateHome,
  disabled = false,
}: SpeakingPronunciationRendererProps) {
  const linkedTaskCode = config.linked_task_code || '60115'
  const passScore = config.pass_score ?? 80

  // Trạng thái dữ liệu bài viết liên kết
  const [writingData, setWritingData] = useState<ApprovedWritingData | null>(null)
  const [sentences, setSentences] = useState<string[]>([])
  const [loadingWriting, setLoadingWriting] = useState(true)

  // Điều hướng từng câu 1 (Sentence by sentence)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [maxUnlockedIndex, setMaxUnlockedIndex] = useState(0)
  const [completedSentences, setCompletedSentences] = useState<
    Record<number, { score: number; result: PronunciationScoreResult; audioUrl?: string }>
  >({})
  const [isAllFinished, setIsAllFinished] = useState(false)

  // Trạng thái thu âm cho câu hiện tại
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)

  // Trạng thái chấm điểm STT cho câu hiện tại
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evalProgress, setEvalProgress] = useState<TranscriptionProgress | null>(null)
  const [currentScoreResult, setCurrentScoreResult] = useState<PronunciationScoreResult | null>(null)
  const [activeWordTooltip, setActiveWordTooltip] = useState<{
    word: string
    tip?: string
    confidence?: number
    status?: string
  } | null>(null)

  // Trạng thái nghe giọng mẫu (TTS)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 1. Tải câu viết từ bài Form 3 tương ứng (ví dụ: 60115)
  useEffect(() => {
    let ignore = false

    async function loadWriting() {
      setLoadingWriting(true)
      const data = await getApprovedWriting(linkedTaskCode)

      if (ignore) return

      setWritingData(data)

      if (data.found && data.sentences.length > 0) {
        setSentences(data.sentences)
      } else if (config.fallback_sentences && config.fallback_sentences.length > 0) {
        setSentences(config.fallback_sentences)
      } else {
        setSentences([])
      }

      setLoadingWriting(false)
    }

    loadWriting()

    const handleApprovedSaved = (e: any) => {
      if (e.detail?.taskCode === linkedTaskCode && Array.isArray(e.detail?.sentences)) {
        setSentences(e.detail.sentences)
        setWritingData({
          found: true,
          sentences: e.detail.sentences,
          paragraph: e.detail.paragraph,
          taskCode: linkedTaskCode,
        })
      }
    }

    window.addEventListener('approved-writing-saved', handleApprovedSaved)
    return () => {
      ignore = true
      window.removeEventListener('approved-writing-saved', handleApprovedSaved)
    }
  }, [linkedTaskCode, config.fallback_sentences])

  // Dọn dẹp stream microphone và timer khi unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [audioUrl])

  // 2. Chức năng phát âm câu mẫu bằng Web Speech API
  const playModelAudio = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.88 // Nhịp vừa phải cho học sinh theo dõi

    utterance.onstart = () => setIsPlayingAudio(true)
    utterance.onend = () => setIsPlayingAudio(false)
    utterance.onerror = () => setIsPlayingAudio(false)

    window.speechSynthesis.speak(utterance)
  }

  // 3. Khởi động Microphone & Thu âm
  const startRecording = async () => {
    setMediaError(null)
    setAudioBlob(null)
    setAudioUrl(null)
    setCurrentScoreResult(null)
    setActiveWordTooltip(null)
    audioChunksRef.current = []

    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ ghi âm trực tiếp. Vui lòng thử Chrome hoặc Edge.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream

      let mimeType = ''
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus'
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const detectedType = mediaRecorder.mimeType || mimeType || 'audio/webm'
        const finalBlob = new Blob(audioChunksRef.current, { type: detectedType })
        setAudioBlob(finalBlob)
        const url = URL.createObjectURL(finalBlob)
        setAudioUrl(url)

        // Dừng tracks chỉ sau khi mediaRecorder đã đóng gói file hoàn tất
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start(250)
      setIsRecording(true)
      setRecordingSeconds(0)

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Không thể truy cập Microphone:', err)
      setMediaError(err?.message || 'Không thể mở Microphone. Vui lòng cấp quyền trong cài đặt trình duyệt.')
      setIsRecording(false)
    }
  }

  // 4. Dừng thu âm
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

  // 5. Chấm điểm phát âm bằng AssemblyAI cho riêng câu hiện tại
  const evaluateRecording = async () => {
    if (!audioBlob || audioBlob.size < 1500) {
      setMediaError('Bản ghi âm quá ngắn hoặc micro chưa thu được tiếng (dưới 1 giây). Vui lòng nhấn thu âm lại và đọc to, rõ ràng cả câu rồi mới bấm Dừng.')
      return
    }

    const currentSentence = sentences[currentIndex] || ''
    if (!currentSentence.trim()) return

    setIsEvaluating(true)
    setEvalProgress({ stage: 'uploading', message: 'Đang chuẩn bị gửi âm thanh lên AssemblyAI...', percent: 15 })

    try {
      const apiKey = getAssemblyAiApiKey()
      let heardText = ''
      let heardWords: AssemblyAIWord[] = []

      // Chỉ boost các tên riêng (Proper nouns) để tránh AssemblyAI ép nhận diện theo câu mẫu khi học sinh đọc từ khác
      const properNouns = currentSentence
        .split(/\s+/)
        .filter((raw, idx) => idx > 0 && /^[A-Z]/.test(raw))
        .map(cleanWord)
        .filter((w) => w.length > 2)

      if (apiKey) {
        const transcriptResponse = await transcribeAudioWithAssemblyAI(
          audioBlob,
          properNouns,
          (progress) => setEvalProgress(progress)
        )

        heardText = transcriptResponse.text || ''
        heardWords = transcriptResponse.words || []
      } else {
        throw new Error(
          'Chưa cấu hình AssemblyAI API Key. Vui lòng kiểm tra file .env (VITE_ASSEMBLYAI_API_KEY) hoặc cài đặt để kích hoạt tính năng chấm giọng nói thực tế.'
        )
      }

      // 1. Chấm điểm phát âm chuẩn âm học (thang điểm 100)
      let evaluation = scorePronunciation(
        currentSentence,
        heardText,
        heardWords,
        passScore,
        config.scoring_criteria
      )

      // 2. Nếu có tiêu chí chấm riêng từ giáo viên/admin, gọi Gemini AI để chấm sát và đưa nhận xét chuẩn xác hơn
      if (config.scoring_criteria && config.scoring_criteria.trim()) {
        setEvalProgress({
          stage: 'transcribing',
          message: 'AI đang đối chiếu với tiêu chí chấm điểm của giáo viên...',
          percent: 90,
        })
        evaluation = await evaluateSpeakingWithAI(
          currentSentence,
          heardText,
          evaluation,
          config.scoring_criteria
        )
      }

      setCurrentScoreResult(evaluation)

      if (evaluation.isPassed) {
        const updated = {
          ...completedSentences,
          [currentIndex]: {
            score: evaluation.score,
            result: evaluation,
            audioUrl: audioUrl || undefined,
          },
        }
        setCompletedSentences(updated)
        setMaxUnlockedIndex((prev) => Math.max(prev, currentIndex + 1))

        // Kiểm tra xem tất cả các câu đã hoàn thành chưa
        const allDone = sentences.every((_, sIdx) => {
          return updated[sIdx] && updated[sIdx].score >= passScore
        })

        if (allDone) {
          setIsAllFinished(true)
          const total = Object.values(updated).reduce((acc, curr) => acc + curr.score, 0)
          const avgScore = Math.round(total / sentences.length)
          onComplete?.(avgScore, evaluation)
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
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setAudioBlob(null)
      setAudioUrl(null)
      setCurrentScoreResult(null)
      setActiveWordTooltip(null)
    } else {
      setIsAllFinished(true)
    }
  }

  // Làm lại từ đầu
  const handleRestartAll = () => {
    setCompletedSentences({})
    setCurrentIndex(0)
    setMaxUnlockedIndex(0)
    setIsAllFinished(false)
    setCurrentScoreResult(null)
    setAudioBlob(null)
    setAudioUrl(null)
    onRestart?.()
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (loadingWriting) {
    return (
      <div className="form-4-speaking-container" style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: '16px' }}>
        <div className="speaking-pulse" style={{ margin: '0 auto 14px' }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
          Đang tải câu văn từ bài tập {linkedTaskCode}...
        </div>
      </div>
    )
  }

  if (sentences.length === 0) {
    return (
      <div
        className="form-4-speaking-container"
        style={{
          textAlign: 'center',
          padding: '36px 20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1.5px dashed #cbd5e1',
        }}
      >
        <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔒</div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
          Yêu cầu hoàn thành bài viết trước
        </h3>
        <p style={{ fontSize: '14px', color: '#475569', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          Bài tập luyện nói này sẽ lấy các câu văn bạn đã viết và được AI chấm đúng từ <strong>Bài tập {linkedTaskCode}</strong>.
          <br />
          Hiện chưa có dữ liệu bài viết đã hoàn thành của bạn. Vui lòng làm bài tập {linkedTaskCode} trước nhé!
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={`/${linkedTaskCode}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            ✏️ Đến làm bài tập {linkedTaskCode}
          </a>
          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                background: '#f1f5f9',
                color: '#475569',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
            >
              Quay lại danh sách bài
            </button>
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // GIAI ĐOẠN HOÀN THÀNH TẤT CẢ CÁC CÂU NÓI
  // =========================================================================
  if (isAllFinished) {
    const totalScore = Object.values(completedSentences).reduce((acc, curr) => acc + curr.score, 0)
    const avgScore = Math.round(totalScore / sentences.length)

    return (
      <div className="form-4-speaking-container">
        <section className="speaking-all-summary">
          <div style={{ fontSize: '40px' }}>🎉</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#166534' }}>
            Task Complete • Luyện Nói Xuất Sắc!
          </h2>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
            Bạn đã đọc chuẩn xác tất cả {sentences.length} câu với điểm số trên {passScore}%.
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', margin: '8px auto', background: '#f0fdf4', border: '1.5px solid #86efac', padding: '8px 24px', borderRadius: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>Điểm trung bình:</span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#15803d' }}>{avgScore}</span>
            <span style={{ fontSize: '14px', color: '#166534' }}>/100</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', marginTop: '10px' }}>
            {sentences.map((sent, sIdx) => {
              const itemScore = completedSentences[sIdx]?.score ?? 0
              return (
                <div
                  key={sIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>
                    {sIdx + 1}. {sent}
                  </span>
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>{itemScore}/100 ✓</span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px' }}>
            <ActionButton id="speakingRestartBtn" variant="secondary" onClick={handleRestartAll}>
              🔄 Luyện lại từ đầu
            </ActionButton>
            {onNavigateHome && (
              <ActionButton id="speakingHomeBtn" onClick={onNavigateHome}>
                ⌨️ Quay lại trang nhập mã
              </ActionButton>
            )}
          </div>
        </section>
      </div>
    )
  }

  const currentSentence = sentences[currentIndex] || ''
  const isCurrentPassed = currentScoreResult ? currentScoreResult.score >= passScore : false
  const savedCurrent = completedSentences[currentIndex]

  return (
    <div className="form-4-speaking-container">
      {/* 1. THÔNG BÁO NGUỒN CÂU VĂN (THU GỌN, TINH TẾ) */}
      <div className="speaking-compact-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✨</span>
          <span>
            {writingData?.found
              ? `Bài viết Task ${linkedTaskCode} (AI xác thực 100% ✓)`
              : `Câu mẫu chuẩn SGK (Task ${linkedTaskCode})`}
          </span>
        </div>
        <div style={{ fontWeight: 700, color: '#15803d' }}>
          Câu {currentIndex + 1} / {sentences.length}
        </div>
      </div>

      {/* 2. ĐIỀU HƯỚNG TỪNG CÂU (STEP PILLS) */}
      <div className="speaking-step-nav">
        {sentences.map((_, sIdx) => {
          const isPassed = Boolean(completedSentences[sIdx] && completedSentences[sIdx].score >= passScore)
          const isActive = sIdx === currentIndex
          const isLocked = sIdx > maxUnlockedIndex

          return (
            <button
              key={sIdx}
              type="button"
              className={`speaking-step-pill ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''} ${isLocked ? 'locked' : ''}`}
              disabled={isLocked || disabled}
              onClick={() => {
                if (!isLocked) {
                  setCurrentIndex(sIdx)
                  setAudioBlob(null)
                  setAudioUrl(null)
                  setCurrentScoreResult(null)
                  setActiveWordTooltip(null)
                }
              }}
              title={isLocked ? 'Cần hoàn thành câu trước để mở khóa' : `Câu ${sIdx + 1}`}
            >
              <span>Câu {sIdx + 1}</span>
              {isPassed ? <span>✓</span> : isLocked ? <span style={{ fontSize: '10px', opacity: 0.7 }}>🔒</span> : null}
            </button>
          )
        })}
      </div>

      {/* 3. THẺ TƯƠNG TÁC CHO CÂU HIỆN TẠI (NHỎ GỌN, KHOA HỌC) */}
      <div className="speaking-single-card">
        {/* Câu mẫu tiếng Anh cần đọc */}
        <div className="speaking-sentence-display">
          <div className="speaking-current-text">
            "{currentSentence}"
          </div>
          <button
            type="button"
            className="listen-model-btn"
            onClick={() => playModelAudio(currentSentence)}
            disabled={disabled || isPlayingAudio}
            title="Nghe mẫu phát âm"
          >
            {isPlayingAudio ? '🔊 Đang đọc...' : '🔊 Nghe mẫu'}
          </button>
        </div>

        {/* Khung thu âm */}
        <div className={`speaking-compact-recorder ${isRecording ? 'recording' : ''}`}>
          <div className="speaking-recorder-main">
            {!isRecording ? (
              <button
                type="button"
                className="speaking-mic-btn"
                onClick={startRecording}
                disabled={disabled || isEvaluating}
                title="Bắt đầu đọc"
              >
                🎙️
              </button>
            ) : (
              <button
                type="button"
                className="speaking-mic-btn active-rec"
                onClick={stopRecording}
                title="Dừng thu âm"
              >
                ⏹
              </button>
            )}

            <div>
              {isRecording ? (
                <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>
                  🔴 Đang thu âm ({formatTime(recordingSeconds)})... Đọc to rõ câu rồi bấm Dừng
                </div>
              ) : audioUrl ? (
                <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>
                  ✓ Đã thu âm xong. Bấm "Chấm điểm AI" để gửi bài.
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  Nhấn biểu tượng Microphone để đọc câu trên
                </div>
              )}
            </div>
          </div>

          {mediaError && (
            <div style={{ color: '#dc2626', fontSize: '12px', background: '#fee2e2', padding: '4px 10px', borderRadius: '6px', width: '100%' }}>
              ⚠️ {mediaError}
            </div>
          )}

          {/* Nghe lại và Nút gửi chấm */}
          {audioUrl && !isRecording && (
            <div className="speaking-recorder-review">
              <audio controls src={audioUrl} style={{ height: '32px', maxWidth: '180px' }} />
              <button
                type="button"
                className="btn-submit"
                style={{ padding: '6px 14px', fontSize: '13px', margin: 0 }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px' }}>
            <div className="speaking-pulse" style={{ width: '14px', height: '14px' }} />
            <span>{evalProgress?.message || 'AssemblyAI đang phân tích giọng nói...'}</span>
          </div>
        )}

        {/* Kết quả chấm điểm trực quan: Câu mẫu 4 màu & Câu thực tế gạch đỏ từ thừa */}
        {currentScoreResult && !isEvaluating && (
          <div className={`speaking-minimal-score ${isCurrentPassed ? 'passed' : 'failed'}`}>
            <div className="speaking-score-top-row">
              <div className="speaking-score-val-tag">
                <span style={{ fontSize: '18px' }}>{currentScoreResult.score}</span>
                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '2px' }}>/100</span>
              </div>
              <div style={{ flex: 1, fontSize: '13px' }}>
                <strong>
                  {isCurrentPassed
                    ? `✓ Đạt yêu cầu (${currentScoreResult.score} điểm • Đạt trên ${passScore}%)`
                    : `⚠️ Chưa đạt (${currentScoreResult.score} điểm • Cần đạt trên ${passScore}%)`}
                </strong>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  {currentScoreResult.feedback_vi || (isCurrentPassed ? 'Phát âm tốt!' : 'Hãy nghe lại mẫu và đọc lại câu này.')}
                </div>
              </div>
            </div>

            {/* PHẦN 1: ĐÁNH GIÁ TỪNG TỪ CỦA CÂU MẪU (Xanh lá / Vàng / Đỏ / Xám) */}
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🎯 Đánh giá câu mẫu theo từng từ:
              </div>
              {currentScoreResult.evaluatedWords && currentScoreResult.evaluatedWords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {currentScoreResult.evaluatedWords
                    .filter((w) => Boolean(w.targetWord))
                    .map((word, wIdx) => {
                      const statusIcon =
                        word.status === 'correct' ? '✓' : word.status === 'unclear' ? '~' : word.status === 'missing' ? '—' : '✗'
                      return (
                        <button
                          key={wIdx}
                          type="button"
                          className={`pronunciation-word-chip ${word.status}`}
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
            <div className="spoken-sentence-card">
              <div className="spoken-sentence-title">
                <span>🗣️ Câu bạn đã đọc:</span>
                {currentScoreResult.spokenWords?.some((w) => w.isExtra) && (
                  <span className="extra-word-tag">Gạch đỏ từ thừa</span>
                )}
              </div>
              {currentScoreResult.spokenWords && currentScoreResult.spokenWords.length > 0 ? (
                <div className="spoken-words-list">
                  {currentScoreResult.spokenWords.map((sword, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      className={`spoken-word-chip ${sword.isExtra ? 'extra' : sword.status}`}
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

            {/* Tooltip khi click vào từ */}
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

            {/* Nút hành động */}
            <div className="speaking-action-row">
              {isCurrentPassed || (savedCurrent && savedCurrent.score >= passScore) ? (
                currentIndex < sentences.length - 1 ? (
                  <button
                    type="button"
                    className="speaking-next-btn"
                    onClick={handleGoNext}
                  >
                    Chuyển câu tiếp theo →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="speaking-next-btn"
                    onClick={() => setIsAllFinished(true)}
                  >
                    🎉 Xem bảng tổng kết hoàn thành ✓
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="speaking-retry-btn"
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
