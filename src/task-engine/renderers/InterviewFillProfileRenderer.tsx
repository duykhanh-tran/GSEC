import { useState, useEffect, useRef } from 'react'
import type { Form62InterviewConfig, Form62InterviewFieldItem } from '../dynamic-schema'
import { matchQuestionToField } from '../../lib/questionBankMatcher'
import {
  transcribeAudioWithAssemblyAI,
  getAssemblyAiApiKey,
  type TranscriptionProgress,
} from '../../lib/assemblyAiService'
import {
  generatePedagogicalInterviewLeadIn,
  getCuratedPedagogicalLeadIn,
} from '../../lib/aiGradingService'
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
  const items: Form62InterviewFieldItem[] =
    config.items && config.items.length > 0
      ? config.items
      : [
          {
            id: 'name',
            label: 'Name',
            prompt_audio_url: '',
            answer_audio_url: '',
            answer_text_display: 'His name is Nam.',
            question_bank: [
              'What is his name?',
              "What's his name?",
              'Who is he?',
              'Can you tell me his name?',
              'Tell me his name',
            ],
            hints: ['Hãy hỏi về tên của bạn ấy (ví dụ: What is his name?).'],
          },
          {
            id: 'class',
            label: 'Class',
            prompt_audio_url: '',
            answer_audio_url: '',
            answer_text_display: 'He is in class 6A.',
            question_bank: [
              'Which class is he in?',
              'What class is he in?',
              'Which class?',
              'What is his class?',
            ],
            hints: ['Hãy hỏi về lớp học của bạn ấy (ví dụ: Which class is he in?).'],
          },
          {
            id: 'subject',
            label: 'Favourite subject',
            prompt_audio_url: '',
            answer_audio_url: '',
            answer_text_display: 'His favourite subject is English.',
            question_bank: [
              'What is his favourite subject?',
              "What's his favourite subject?",
              'What is his favorite subject?',
              'Which subject does he like?',
              'What subject does he like most?',
            ],
            hints: ['Hãy hỏi về môn học yêu thích (ví dụ: What is his favourite subject?).'],
          },
          {
            id: 'activity',
            label: 'Activity after',
            prompt_audio_url: '',
            answer_audio_url: '',
            answer_text_display: 'He usually plays football after school.',
            question_bank: [
              'What does he do after school?',
              'What is his activity after school?',
              'What does he usually do after school?',
              'What activity does he do?',
            ],
            hints: ['Hãy hỏi về hoạt động sau giờ học (ví dụ: What does he do after school?).'],
          },
        ]

  // Audio tổng quan (Overall Audio)
  const overallAudioUrl = (config as any).audio_url || (config as any).audioUrl || ''

  // Trạng thái câu hỏi hiện tại (làm tuần tự từng câu 1)
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set())

  // Trạng thái lời dẫn AI theo ngữ cảnh cho câu hiện tại
  const [aiLeadInText, setAiLeadInText] = useState<string>('')

  // Trạng thái thu âm
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isProcessingSTT, setIsProcessingSTT] = useState(false)
  const [sttStageMessage, setSttStageMessage] = useState('')

  // Trạng thái phát âm thanh
  const [playingAudioType, setPlayingAudioType] = useState<'prompt' | 'answer' | null>(null)
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)

  // Trạng thái phản hồi của AI cho từng câu hỏi
  const [itemFeedbacks, setItemFeedbacks] = useState<Record<string, {
    matched: boolean
    message: string
    spokenText?: string
    showHint?: boolean
  }>>({})

  const [isAllCompleted, setIsAllCompleted] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const overallAudioRef = useRef<HTMLAudioElement | null>(null)

  const currentItem = items[activeItemIndex] || items[0]

  // Cập nhật lời dẫn AI sư phạm mỗi khi chuyển câu
  useEffect(() => {
    if (!currentItem) return

    // Thiết lập ngay lời dẫn mẫu sư phạm chuẩn mực
    const completedList = items
      .filter((it, idx) => idx < activeItemIndex && completedItemIds.has(it.id))
      .map((it) => ({ label: it.label, answerText: it.answer_text_display }))

    const fastLead = getCuratedPedagogicalLeadIn(
      currentItem.label,
      activeItemIndex,
      items.length,
      completedList
    )
    setAiLeadInText(fastLead)

    // Gọi thêm Gemini AI nếu có key để tinh chỉnh lời dẫn sinh động theo ngữ cảnh
    let isCancelled = false
    generatePedagogicalInterviewLeadIn(
      currentItem.label,
      activeItemIndex,
      items.length,
      completedList
    ).then((refined) => {
      if (!isCancelled && refined) {
        setAiLeadInText(refined)
      }
    }).catch(() => {})

    return () => {
      isCancelled = true
    }
  }, [activeItemIndex, currentItem?.id, completedItemIds])

  // Dọn dẹp stream microphone, timers & TTS khi unmount
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

  // Phát Audio 1 (Prompt audio của AI hoặc đọc lời dẫn AI)
  const playPromptAudio = (item: Form62InterviewFieldItem) => {
    if (playingAudioType === 'prompt' && playingItemId === item.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setPlayingAudioType(null)
      setPlayingItemId(null)
      return
    }

    setPlayingAudioType('prompt')
    setPlayingItemId(item.id)

    if (item.prompt_audio_url && item.prompt_audio_url.trim()) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = item.prompt_audio_url
        audioPlayerRef.current.play().catch(() => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        })
      }
    } else {
      // Fallback TTS đọc lời dẫn AI
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = aiLeadInText || getCuratedPedagogicalLeadIn(item.label, activeItemIndex, items.length)
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'vi-VN'
        utterance.rate = 0.95
        utterance.onend = () => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }
        utterance.onerror = () => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }
        window.speechSynthesis.speak(utterance)
      } else {
        setPlayingAudioType(null)
        setPlayingItemId(null)
      }
    }
  }

  // Phát Audio 2 (Answer audio của AI khi học sinh hỏi đúng)
  const playAnswerAudio = (item: Form62InterviewFieldItem) => {
    if (playingAudioType === 'answer' && playingItemId === item.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setPlayingAudioType(null)
      setPlayingItemId(null)
      return
    }

    setPlayingAudioType('answer')
    setPlayingItemId(item.id)

    if (item.answer_audio_url && item.answer_audio_url.trim()) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = item.answer_audio_url
        audioPlayerRef.current.play().catch(() => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        })
      }
    } else {
      // Fallback TTS tiếng Anh đọc câu trả lời của bạn
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = item.answer_text_display || `His ${item.label} is ${item.target_answer || 'known'}.`
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        utterance.onend = () => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }
        utterance.onerror = () => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }
        window.speechSynthesis.speak(utterance)
      } else {
        setPlayingAudioType(null)
        setPlayingItemId(null)
      }
    }
  }

  // Bắt đầu ghi âm câu hỏi của học sinh
  const handleStartRecording = async () => {
    if (disabled || isRecording || isProcessingSTT) return

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
        stream.getTracks().forEach((track) => track.stop())
        if (audioBlob.size < 1500) {
          setItemFeedbacks((prev) => ({
            ...prev,
            [currentItem.id]: {
              matched: false,
              showHint: true,
              message: 'Bản ghi âm quá ngắn hoặc chưa rõ tiếng. Em hãy đọc gợi ý bên dưới và bấm thu âm lại nhé!',
            },
          }))
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

  // Gửi audio qua AssemblyAI và xử lý đối chiếu ngân hàng câu hỏi
  const processSpokenQuestion = async (audioBlob: Blob) => {
    setIsProcessingSTT(true)
    setSttStageMessage('Đang nhận diện giọng nói qua AssemblyAI...')

    try {
      const apiKey = getAssemblyAiApiKey()
      let transcribedText = ''

      if (apiKey) {
        const keyterms = ['name', 'class', 'subject', 'favourite', 'favorite', 'activity', 'school', 'what', 'who', 'which']
        const result = await transcribeAudioWithAssemblyAI(audioBlob, keyterms, (progress: TranscriptionProgress) => {
          setSttStageMessage(progress.message)
        })
        transcribedText = result.text?.trim() || ''
      } else {
        // Mock fallback nếu không có key
        transcribedText = currentItem.question_bank[0] || "What is his name?"
      }

      // Đối chiếu câu hỏi với câu hiện tại
      const matchResult = matchQuestionToField(transcribedText, [currentItem])

      if (matchResult.matchedFieldId === currentItem.id) {
        // ĐẶT CÂU HỎI ĐÚNG!
        playSuccessDing()

        const newCompleted = new Set(completedItemIds)
        newCompleted.add(currentItem.id)
        setCompletedItemIds(newCompleted)

        setItemFeedbacks((prev) => ({
          ...prev,
          [currentItem.id]: {
            matched: true,
            spokenText: transcribedText,
            showHint: false, // Ẩn gợi ý khi đã làm đúng
            message: `Chính xác! AI trả lời: "${currentItem.answer_text_display || 'Thông tin đã được mở khóa.'}"`,
          },
        }))

        // Tự động phát Audio 2 câu trả lời
        playAnswerAudio(currentItem)

        // Nếu đã hoàn thành tất cả các câu
        if (newCompleted.size >= items.length) {
          setIsAllCompleted(true)
          onComplete?.(100, {
            completedItems: Array.from(newCompleted),
            totalItems: items.length,
          })
        }
      } else {
        // HỌC SINH HỎI SAI: BÂY GIỜ MỚI HIỆN GỢI Ý!
        setItemFeedbacks((prev) => ({
          ...prev,
          [currentItem.id]: {
            matched: false,
            spokenText: transcribedText,
            showHint: true, // Chỉ hiện gợi ý khi học sinh hỏi sai!
            message: 'Chưa đúng câu hỏi cần tìm. Em hãy xem gợi ý bên dưới và thử thu âm lại nhé!',
          },
        }))
      }
    } catch (error: any) {
      const msg = error?.message || 'Có lỗi xảy ra khi xử lý giọng nói. Hãy thử hỏi lại nhé!'
      setItemFeedbacks((prev) => ({
        ...prev,
        [currentItem.id]: {
          matched: false,
          showHint: true,
          message: msg,
        },
      }))
    } finally {
      setIsProcessingSTT(false)
      setSttStageMessage('')
    }
  }

  // Chuyển sang câu tiếp theo (chỉ khi câu hiện tại đã hoàn thành đúng)
  const handleGoNext = () => {
    if (activeItemIndex < items.length - 1) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      setPlayingAudioType(null)
      setPlayingItemId(null)
      setActiveItemIndex(activeItemIndex + 1)
    }
  }

  // Luyện lại từ đầu
  const handleRestartAll = () => {
    setActiveItemIndex(0)
    setCompletedItemIds(new Set())
    setItemFeedbacks({})
    setIsAllCompleted(false)
    setPlayingAudioType(null)
    setPlayingItemId(null)
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    }
    if (overallAudioRef.current) {
      overallAudioRef.current.pause()
      overallAudioRef.current.currentTime = 0
    }
    onRestart?.()
  }

  const completedCount = completedItemIds.size
  const isCurrentCompleted = completedItemIds.has(currentItem.id)
  const currentFeedback = itemFeedbacks[currentItem.id]

  return (
    <div className="interview-profile-container">
      {/* Audio player ẩn cho Audio 1 & Audio 2 */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }}
        onError={() => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }}
        style={{ display: 'none' }}
      />

      {/* HEADER BANNER */}
      <div className="interview-header-banner">
        <div style={{ fontWeight: 600, color: '#1e293b', flex: 1 }}>
          🎙️ {config.intro && !config.intro.toLowerCase().includes('check task')
            ? config.intro
            : 'Phỏng vấn AI Tutor: Lắng nghe lời dẫn, đặt câu hỏi đúng từng bước và nghe câu trả lời.'}
        </div>
        <div className="interview-progress-pill">
          Câu {activeItemIndex + 1}/{items.length} • {completedCount}/{items.length} hoàn thành
        </div>
      </div>

      {/* AUDIO TỔNG QUAN BÀI HỌC (NẾU CÓ) */}
      {overallAudioUrl && (
        <section className="interview-overall-audio-card" style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          border: '1.5px solid #7dd3fc',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0369a1', fontSize: '15px' }}>
              <span>🎧</span>
              <span>Audio tổng quan bài học</span>
            </div>
            <span style={{ fontSize: '12px', color: '#0284c7', background: '#ffffff', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Nghe tổng quát trước khi hỏi
            </span>
          </div>
          <audio
            ref={overallAudioRef}
            src={overallAudioUrl}
            controls
            style={{ width: '100%', height: '40px', borderRadius: '8px' }}
          />
        </section>
      )}

      {/* TIẾN TRÌNH TỪNG CÂU TUẦN TỰ (ĐÚNG TỪNG CÂU 1, KHÔNG CHO NHẢY CÓC) */}
      <div className="interview-sequential-stepper" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '4px 2px',
      }}>
        {items.map((item, idx) => {
          const isDone = completedItemIds.has(item.id)
          const isCurrent = idx === activeItemIndex
          const isFuture = idx > activeItemIndex

          return (
            <div
              key={item.id}
              id={`step-indicator-${item.id}`}
              className={`interview-step-pill ${isCurrent ? 'active' : ''} ${isDone ? 'done' : ''} ${isFuture ? 'locked' : ''}`}
              style={{
                flex: '1 1 0',
                padding: '8px 10px',
                borderRadius: '10px',
                background: isCurrent ? '#eff6ff' : isDone ? '#f0fdf4' : '#f8fafc',
                border: isCurrent ? '2px solid #2563eb' : isDone ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                color: isCurrent ? '#1d4ed8' : isDone ? '#166534' : '#94a3b8',
                fontWeight: isCurrent ? 800 : 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{isDone ? '✓' : isCurrent ? '●' : idx + 1}.</span>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>

      {/* KHUNG TƯƠNG TÁC CHÍNH (TẬP TRUNG HOÀN TOÀN VÀO CÂU HIỆN TẠI) */}
      {!isAllCompleted ? (
        <section className="interview-active-card" style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}>
          {/* TIÊU ĐỀ BƯỚC CÂU HỎI */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CÂU HỎI {activeItemIndex + 1} / {items.length}
              </span>
              <h3 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Hỏi về: {currentItem.label}
              </h3>
            </div>
            {isCurrentCompleted ? (
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                ✓ Đã hỏi thành công
              </span>
            ) : (
              <span style={{ background: '#fef3c7', color: '#b45309', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
                Đang thực hiện
              </span>
            )}
          </div>

          {/* LỜI DẪN AI THEO NGỮ CẢNH (SƯ PHẠM, NGHIÊM TÚC, TUYỆT ĐỐI KHÔNG ĐƯA ĐÁP ÁN) */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '14px',
            padding: '16px 18px',
            border: '1.5px solid #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                  Gia sư AI dẫn dắt:
                </div>
                <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600, lineHeight: 1.5 }}>
                  {aiLeadInText || getCuratedPedagogicalLeadIn(currentItem.label, activeItemIndex, items.length)}
                </div>
              </div>
            </div>

            {/* Nút phát Audio 1 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
              <button
                type="button"
                id={`playAudio1Btn-${currentItem.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: playingAudioType === 'prompt' && playingItemId === currentItem.id ? '#ea580c' : '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => playPromptAudio(currentItem)}
              >
                {playingAudioType === 'prompt' && playingItemId === currentItem.id ? '⏹️ Dừng nghe Audio 1' : '▶️ Nghe Audio 1'}
              </button>
            </div>
          </div>

          {/* KHUNG MICRO GHI ÂM CÂU HỎI */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0 6px',
          }}>
            <div style={{ textAlign: 'center', fontSize: '14px', color: '#475569', fontWeight: 600 }}>
              {isCurrentCompleted
                ? 'Em đã hỏi thành công câu này! Có thể bấm Tiếp tục để sang câu sau hoặc thu âm lại:'
                : 'Bấm micro bên dưới và đặt câu hỏi bằng tiếng Anh:'}
            </div>

            <div className="interview-voice-controls">
              {!isRecording ? (
                <button
                  type="button"
                  id="interviewMicBtn"
                  className={`interview-mic-btn ${isProcessingSTT ? 'processing' : 'idle'}`}
                  disabled={disabled || isProcessingSTT}
                  onClick={handleStartRecording}
                  style={{ minWidth: '220px', justifyContent: 'center' }}
                >
                  {isProcessingSTT ? '⏳ Đang nhận diện...' : '🎙️ Bấm để đặt câu hỏi'}
                </button>
              ) : (
                <button
                  type="button"
                  id="interviewStopMicBtn"
                  className="interview-mic-btn recording"
                  onClick={handleStopRecording}
                  style={{ minWidth: '240px', justifyContent: 'center' }}
                >
                  ⏹️ Dừng ghi ({recordingSeconds}s) • Kiểm tra
                </button>
              )}
            </div>

            {sttStageMessage && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#0284c7', fontStyle: 'italic' }}>
                {sttStageMessage}
              </div>
            )}
          </div>

          {/* HIỂN THỊ CÂU HỎI HỌC SINH VỪA NÓI */}
          {currentFeedback?.spokenText && (
            <div className="interview-message-bubble user" style={{ margin: 0 }}>
              <span className="interview-bubble-label">🗣️ Bạn vừa hỏi:</span>
              <span className="interview-user-query">&ldquo;{currentFeedback.spokenText}&rdquo;</span>
            </div>
          )}

          {/* KẾT QUẢ KHI HỌC SINH HỎI ĐÚNG -> NHẢ AUDIO 2 */}
          {isCurrentCompleted && currentFeedback?.matched && (
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>🎉</span>
                <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.5, color: '#166534', fontWeight: 600 }}>
                  {currentFeedback.message}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
                <button
                  type="button"
                  id={`playAudio2Btn-${currentItem.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: playingAudioType === 'answer' && playingItemId === currentItem.id ? '#15803d' : '#16a34a',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                  onClick={() => playAnswerAudio(currentItem)}
                >
                  {playingAudioType === 'answer' && playingItemId === currentItem.id ? '🔊 Đang phát Audio 2...' : '🔊 Nghe lại Audio 2'}
                </button>

                {activeItemIndex < items.length - 1 && (
                  <button
                    type="button"
                    id="interviewNextStepBtn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                    }}
                    onClick={handleGoNext}
                  >
                    Tiếp tục câu tiếp theo ➡️
                  </button>
                )}
              </div>
            </div>
          )}

          {/* KHI HỌC SINH HỎI SAI -> MỚI HIỆN GỢI Ý ĐÁP ÁN (CHỈ HIỆN KHI SAI) */}
          {currentFeedback && !currentFeedback.matched && currentFeedback.showHint && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1.5px solid #fca5a5',
                color: '#b91c1c',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠️</span>
                <span>{currentFeedback.message}</span>
              </div>

              {/* Hộp gợi ý nổi bật */}
              <div style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: '#fffbeb',
                border: '1.5px solid #fcd34d',
                color: '#92400e',
                fontSize: '13px',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <div>
                  <strong>Gợi ý câu hỏi:</strong>{' '}
                  {currentItem.hints?.[0] || `Hãy thử đặt câu hỏi bắt đầu bằng: "${currentItem.question_bank[0] || 'What'}"`}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* MÀN HÌNH HOÀN THÀNH TOÀN BỘ BÀI PHỎNG VẤN (100/100 ĐIỂM) */
        <section className="interview-complete-box" style={{
          background: '#ffffff',
          border: '2px solid #86efac',
          borderRadius: '16px',
          padding: '32px 24px',
          textAlign: 'center',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{ fontSize: '42px', marginBottom: '10px' }}>🎉</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#166534', marginBottom: '6px' }}>
            Xuất sắc! 100/100 Điểm
          </div>
          <div style={{ fontSize: '15px', color: '#15803d', marginBottom: '20px', maxWidth: '460px', margin: '0 auto 24px' }}>
            Em đã hoàn thành xuất sắc việc đặt toàn bộ {items.length} câu hỏi phỏng vấn và lắng nghe câu trả lời từ AI Tutor!
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <ActionButton id="interviewRestartBtn" variant="secondary" onClick={handleRestartAll}>
              🔄 Luyện lại từ đầu
            </ActionButton>
            {onNavigateHome && (
              <ActionButton id="interviewHomeBtn" onClick={onNavigateHome}>
                ⌨️ Quay lại trang chủ
              </ActionButton>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
