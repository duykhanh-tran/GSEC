import { useState, useEffect, useRef } from 'react'
import type { Form62InterviewConfig, Form62InterviewFieldItem } from '../dynamic-schema'
import { matchQuestionToField } from '../../lib/questionBankMatcher'
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

  // Trạng thái câu hỏi hiện tại
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set())

  // Trạng thái thu âm
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isProcessingSTT, setIsProcessingSTT] = useState(false)
  const [sttStageMessage, setSttStageMessage] = useState('')

  // Trạng thái phát âm thanh
  const [playingAudioType, setPlayingAudioType] = useState<'prompt' | 'answer' | null>(null)
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)

  // Trạng thái phản hồi của AI cho câu hỏi
  const [itemFeedbacks, setItemFeedbacks] = useState<Record<string, {
    matched: boolean
    message: string
    spokenText?: string
  }>>({})

  const [isAllCompleted, setIsAllCompleted] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const overallAudioRef = useRef<HTMLAudioElement | null>(null)

  const currentItem = items[activeItemIndex] || items[0]

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

  // Phát Audio 1 (Prompt audio của AI)
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
      // Fallback TTS
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = item.hints?.[0] || `Now, please ask me about his ${item.label}.`
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'en-US'
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

  // Phát Audio 2 (Answer audio của AI khi trả lời đúng)
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
      // Fallback TTS
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
              message: 'Bản ghi âm quá ngắn hoặc chưa rõ tiếng. Bạn hãy bấm thu âm lại và đặt câu hỏi to rõ ràng nhé!',
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

      // Kiểm tra xem câu hỏi có khớp với câu hỏi hiện tại hoặc bất kỳ câu nào không
      const matchResult = matchQuestionToField(transcribedText, items)

      // Ưu tiên khớp với câu hỏi hiện tại nếu câu hỏi có từ khóa của câu hiện tại
      let matchedItem: Form62InterviewFieldItem | null = null
      if (matchResult.matchedFieldId === currentItem.id) {
        matchedItem = currentItem
      } else if (matchResult.matchedFieldId) {
        matchedItem = items.find((it) => it.id === matchResult.matchedFieldId) || null
      }

      if (matchedItem) {
        // Đặt câu hỏi đúng!
        playSuccessDing()

        const newCompleted = new Set(completedItemIds)
        newCompleted.add(matchedItem.id)
        setCompletedItemIds(newCompleted)

        setItemFeedbacks((prev) => ({
          ...prev,
          [matchedItem!.id]: {
            matched: true,
            spokenText: transcribedText,
            message: `Chính xác! AI đang trả lời: "${matchedItem!.answer_text_display || 'Thông tin đã được mở khóa.'}"`,
          },
        }))

        // Phát Audio 2 ngay lập tức
        playAnswerAudio(matchedItem)

        // Kiểm tra xem đã hoàn thành tất cả các câu chưa
        if (newCompleted.size >= items.length) {
          setIsAllCompleted(true)
          onComplete?.(100, {
            completedItems: Array.from(newCompleted),
            totalItems: items.length,
          })
        }
      } else {
        // Chưa khớp câu hỏi nào
        setItemFeedbacks((prev) => ({
          ...prev,
          [currentItem.id]: {
            matched: false,
            spokenText: transcribedText,
            message:
              currentItem.hints?.[0] ||
              `Chưa nhận diện đúng câu hỏi cho "${currentItem.label}". Hãy thử hỏi: "${currentItem.question_bank[0] || 'What is his ' + currentItem.label}?"`,
          },
        }))
      }
    } catch (error: any) {
      const msg = error?.message || 'Có lỗi xảy ra khi xử lý giọng nói. Hãy thử hỏi lại nhé!'
      setItemFeedbacks((prev) => ({
        ...prev,
        [currentItem.id]: {
          matched: false,
          message: msg,
        },
      }))
    } finally {
      setIsProcessingSTT(false)
      setSttStageMessage('')
    }
  }

  // Điều hướng câu tiếp theo
  const handleGoNext = () => {
    if (activeItemIndex < items.length - 1) {
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
            : 'Phỏng vấn AI Tutor: Nghe lời dẫn (Audio 1), đặt câu hỏi và lắng nghe câu trả lời (Audio 2).'}
        </div>
        <div className="interview-progress-pill">
          {completedCount}/{items.length} câu hoàn thành
        </div>
      </div>

      {/* AUDIO TỔNG (OVERALL AUDIO PLAYER) */}
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

      {/* TABS CHỌN CÂU HỎI */}
      <div className="interview-tabs-nav" style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
      }}>
        {items.map((item, idx) => {
          const isDone = completedItemIds.has(item.id)
          const isActive = idx === activeItemIndex
          return (
            <button
              key={item.id}
              type="button"
              id={`interview-tab-${item.id}`}
              className={`interview-tab-btn ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
              style={{
                flex: '1 1 0',
                minWidth: '110px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: isActive ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                background: isActive ? '#eff6ff' : isDone ? '#f0fdf4' : '#ffffff',
                color: isActive ? '#1d4ed8' : isDone ? '#166534' : '#475569',
                fontWeight: isActive ? 700 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setActiveItemIndex(idx)}
            >
              <span>{isDone ? '✓' : idx + 1}.</span>
              <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* KHUNG TƯƠNG TÁC CHÍNH CHO CÂU HỎI ĐANG CHỌN */}
      <section className="interview-active-card" style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        padding: '22px 24px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        {/* TIÊU ĐỀ CÂU HỎI */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Câu hỏi {activeItemIndex + 1} / {items.length}
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
              Chưa hoàn thành
            </span>
          )}
        </div>

        {/* BƯỚC 1: AUDIO 1 (AI DẪN NHẬP / CÂU HỎI CỦA AI) */}
        <div style={{
          background: '#f8fafc',
          borderRadius: '12px',
          padding: '14px 18px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              🔊 Audio 1: AI dẫn mở đầu
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {currentItem.prompt_audio_url ? 'Bấm để nghe gợi mở từ AI cho câu hỏi này' : 'Nghe gợi mở bằng giọng đọc AI'}
            </div>
          </div>

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

        {/* BƯỚC 2: MICRO THU ÂM CÂU HỎI */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 0',
        }}>
          <div style={{ textAlign: 'center', fontSize: '14px', color: '#475569', fontWeight: 600 }}>
            {isCurrentCompleted
              ? 'Bạn đã hỏi thành công câu này! Có thể thu âm lại để luyện tập phát âm rõ hơn:'
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

        {/* BƯỚC 3: PHẢN HỒI CỦA AI VÀ AUDIO 2 */}
        {currentFeedback && (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: currentFeedback.matched ? '#f0fdf4' : '#fffbeb',
            border: currentFeedback.matched ? '1.5px solid #86efac' : '1.5px solid #fde68a',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{currentFeedback.matched ? '🎉' : '💡'}</span>
              <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.5, color: currentFeedback.matched ? '#166534' : '#92400e', fontWeight: 600 }}>
                {currentFeedback.message}
              </div>
            </div>

            {/* Khi hỏi đúng: Nút nghe lại Audio 2 và nút tiếp theo */}
            {currentFeedback.matched && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '6px' }}>
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
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#1e293b',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                    onClick={handleGoNext}
                  >
                    Câu tiếp theo ➡️
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* GỢI Ý NẾU CHƯA HOÀN THÀNH */}
        {!isCurrentCompleted && !currentFeedback && currentItem.hints && currentItem.hints.length > 0 && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#fefce8',
            border: '1px solid #fef08a',
            fontSize: '13px',
            color: '#854d0e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>💡</span>
            <span>Gợi ý: {currentItem.hints[0]}</span>
          </div>
        )}
      </section>

      {/* DANH SÁCH TỔNG QUAN CÁC CÂU HỎI */}
      <section className="interview-profile-sheet" style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
            📋 Tiến độ các câu hỏi phỏng vấn
          </h4>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
            {completedCount}/{items.length} câu hoàn thành
          </span>
        </div>

        <div className="interview-fields-list">
          {items.map((item, idx) => {
            const isDone = completedItemIds.has(item.id)
            const isSelected = idx === activeItemIndex
            const isPlayingThisAnswer = playingAudioType === 'answer' && playingItemId === item.id

            return (
              <div
                key={item.id}
                className={`interview-field-card ${isSelected ? 'active-target' : ''} ${isPlayingThisAnswer ? 'playing-sound' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: isDone ? '#f0fdf4' : '#f8fafc',
                  border: isSelected ? '2px solid #3b82f6' : isDone ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <span style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isDone ? '#22c55e' : '#cbd5e1',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}>
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '12px', color: isDone ? '#166534' : '#64748b' }}>
                      {isDone ? (item.answer_text_display || 'Đã hoàn thành') : 'Chưa đặt câu hỏi'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isDone && (
                    <button
                      type="button"
                      id={`profile-audio-btn-${item.id}`}
                      className={`interview-field-audio-btn ${isPlayingThisAnswer ? 'playing' : 'active'}`}
                      title="Nghe lại Audio 2"
                      onClick={() => playAnswerAudio(item)}
                    >
                      {isPlayingThisAnswer ? '🔊 Đang phát...' : '🔊 Audio 2'}
                    </button>
                  )}

                  <button
                    type="button"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#475569',
                    }}
                    onClick={() => setActiveItemIndex(idx)}
                  >
                    {isSelected ? 'Đang chọn' : 'Chọn câu này'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* NÚT SUBMIT HOẶC KẾT THÚC BÀI HỌC */}
        <div className="interview-submit-section" style={{ marginTop: '16px' }}>
          {isAllCompleted ? (
            <div className="interview-complete-box">
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534', marginBottom: '8px' }}>
                🎉 Xuất sắc! 100/100 Điểm • Hoàn thành toàn bộ phỏng vấn!
              </div>
              <div style={{ fontSize: '13px', color: '#15803d', marginBottom: '14px' }}>
                Bạn đã hoàn thành việc đặt câu hỏi và lắng nghe toàn bộ thông tin từ AI Tutor.
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
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <button
                type="button"
                id="interviewSubmitProfileBtn"
                className="interview-submit-btn"
                disabled={disabled}
                onClick={() => {
                  if (completedCount >= items.length) {
                    setIsAllCompleted(true)
                    playSuccessDing()
                    onComplete?.(100, { completedItems: Array.from(completedItemIds) })
                  } else {
                    alert(`Bạn đã hoàn thành ${completedCount}/${items.length} câu. Hãy hỏi tiếp các câu còn lại để đạt 100 điểm nhé!`)
                  }
                }}
              >
                🚀 Hoàn thành bài ({completedCount}/{items.length})
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
