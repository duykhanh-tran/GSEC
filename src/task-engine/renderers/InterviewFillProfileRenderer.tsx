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
  cleanLeadInText,
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
  const [aiLeadInText, setAiLeadInText] = useState<string>('')


  // Trạng thái phát âm thanh
  const [isIntroPlaying, setIsIntroPlaying] = useState(false)
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false)
  const [playingAudioType, setPlayingAudioType] = useState<'prompt' | 'answer' | null>(null)
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)

  // Trạng thái thu âm
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isProcessingSTT, setIsProcessingSTT] = useState(false)
  const [sttStageMessage, setSttStageMessage] = useState('')

  // Trạng thái phản hồi cho câu hỏi
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

    const completedList = items
      .filter((it, idx) => idx < activeItemIndex && completedItemIds.has(it.id))
      .map((it) => ({ label: it.label, answerText: it.answer_text_display }))

    const fastLead = getCuratedPedagogicalLeadIn(
      currentItem.label,
      activeItemIndex,
      items.length,
      completedList
    )
    setAiLeadInText(cleanLeadInText(fastLead))

    let isCancelled = false
    generatePedagogicalInterviewLeadIn(
      currentItem.label,
      activeItemIndex,
      items.length,
      completedList
    ).then((refined) => {
      if (!isCancelled && refined) {
        setAiLeadInText(cleanLeadInText(refined))
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

  // Tự động phát Intro Audio hoặc Audio 1 của Câu 1 khi học sinh vào bài
  useEffect(() => {
    if (overallAudioUrl && overallAudioRef.current) {
      try {
        const playPromise = overallAudioRef.current.play()
        if (playPromise !== undefined && typeof (playPromise as any)?.then === 'function') {
          playPromise
            .then(() => {
              setIsIntroPlaying(true)
              setIsAutoplayBlocked(false)
            })
            .catch(() => {
              // Trình duyệt chặn autoplay khi chưa có thao tác chạm của người dùng
              setIsAutoplayBlocked(true)
            })
        } else {
          setIsIntroPlaying(true)
          setIsAutoplayBlocked(false)
        }
      } catch {
        setIsAutoplayBlocked(true)
      }
    } else {
      // Không có audio intro -> tự động phát Audio 1 của câu 1
      const timer = setTimeout(() => {
        playPromptAudio(items[0])
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [overallAudioUrl])

  // Xử lý khi Audio Intro tự ngắt -> Audio 1 của câu 1 tự phát ngay lập tức
  const handleOverallAudioEnded = () => {
    setIsIntroPlaying(false)
    playPromptAudio(items[0])
  }

  // Người dùng bấm kích hoạt nếu trình duyệt chặn autoplay lúc đầu
  const handleManualStart = () => {
    setIsAutoplayBlocked(false)
    if (overallAudioUrl && overallAudioRef.current) {
      try {
        const playPromise = overallAudioRef.current.play()
        if (playPromise !== undefined && typeof (playPromise as any)?.then === 'function') {
          playPromise
            .then(() => {
              setIsIntroPlaying(true)
            })
            .catch(() => {
              playPromptAudio(items[0])
            })
        } else {
          setIsIntroPlaying(true)
        }
      } catch {
        playPromptAudio(items[0])
      }
    } else {
      playPromptAudio(items[0])
    }
  }

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
        audioPlayerRef.current.onended = () => {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }
        try {
          const playPromise = audioPlayerRef.current.play()
          if (playPromise !== undefined && typeof (playPromise as any)?.catch === 'function') {
            playPromise.catch(() => {
              setPlayingAudioType(null)
              setPlayingItemId(null)
            })
          }
        } catch {
          setPlayingAudioType(null)
          setPlayingItemId(null)
        }
      }
    } else {
      // Fallback TTS đọc lời dẫn AI
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = cleanLeadInText(aiLeadInText) || getCuratedPedagogicalLeadIn(item.label, activeItemIndex, items.length)
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

  // Phát Audio 2 (Answer audio của AI khi trả lời đúng) & TỰ ĐỘNG CHUYỂN CÂU KHI PHÁT XONG
  const playAnswerAudio = (item: Form62InterviewFieldItem, autoAdvanceNext: boolean = true) => {
    setPlayingAudioType('answer')
    setPlayingItemId(item.id)

    const onAudio2Ended = () => {
      setPlayingAudioType(null)
      setPlayingItemId(null)

      // Khi Audio 2 dừng: tự động chuyển sang câu tiếp theo và tự phát Audio 1 của câu đó
      if (autoAdvanceNext) {
        if (activeItemIndex < items.length - 1) {
          const nextIndex = activeItemIndex + 1
          setActiveItemIndex(nextIndex)
          setTimeout(() => {
            playPromptAudio(items[nextIndex])
          }, 500)
        } else {
          setIsAllCompleted(true)
          onComplete?.(100, {
            completedItems: items.map((i) => i.id),
            totalItems: items.length,
          })
        }
      }
    }

    if (item.answer_audio_url && item.answer_audio_url.trim()) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = item.answer_audio_url
        audioPlayerRef.current.onended = onAudio2Ended
        try {
          const playPromise = audioPlayerRef.current.play()
          if (playPromise !== undefined && typeof (playPromise as any)?.catch === 'function') {
            playPromise.catch(() => {
              onAudio2Ended()
            })
          }
        } catch {
          onAudio2Ended()
        }
      }
    } else {
      // Fallback TTS tiếng Anh đọc câu trả lời
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = item.answer_text_display || `His ${item.label} is ${item.target_answer || 'known'}.`
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        utterance.onend = onAudio2Ended
        utterance.onerror = onAudio2Ended
        window.speechSynthesis.speak(utterance)
      } else {
        onAudio2Ended()
      }
    }
  }

  // Bắt đầu ghi âm câu hỏi của học sinh
  const handleStartRecording = async () => {
    if (disabled || isRecording || isProcessingSTT) return

    // Tắt audio đang phát nếu có
    if (audioPlayerRef.current) audioPlayerRef.current.pause()
    if (overallAudioRef.current) overallAudioRef.current.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setPlayingAudioType(null)

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
              message: 'Bản ghi âm quá ngắn hoặc chưa rõ tiếng. Em hãy xem gợi ý bên dưới và bấm thu âm lại nhé!',
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
    setSttStageMessage('Đang nhận diện câu hỏi qua AssemblyAI...')

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
            showHint: false, // Ẩn gợi ý khi đã hỏi đúng
            message: 'Correct',
          },
        }))

        // Tự động phát Audio 2 (câu trả lời) và chuyển câu tiếp theo khi phát xong
        playAnswerAudio(currentItem, true)
      } else {
        // HỌC SINH HỎI SAI
        setItemFeedbacks((prev) => ({
          ...prev,
          [currentItem.id]: {
            matched: false,
            spokenText: transcribedText,
            showHint: true,
            message: 'Try again',
          },
        }))
      }
    } catch (error: any) {
      setItemFeedbacks((prev) => ({
        ...prev,
        [currentItem.id]: {
          matched: false,
          showHint: true,
          message: 'Try again',
        },
      }))
    } finally {
      setIsProcessingSTT(false)
      setSttStageMessage('')
    }
  }

  // Chuyển sang câu tiếp theo thủ công (nếu học sinh muốn chủ động bấm)
  const handleGoNext = () => {
    if (activeItemIndex < items.length - 1) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause()
      setPlayingAudioType(null)
      setPlayingItemId(null)
      const nextIndex = activeItemIndex + 1
      setActiveItemIndex(nextIndex)
      setTimeout(() => {
        playPromptAudio(items[nextIndex])
      }, 400)
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
    if (audioPlayerRef.current) audioPlayerRef.current.pause()
    if (overallAudioRef.current) {
      overallAudioRef.current.currentTime = 0
      overallAudioRef.current.play().catch(() => {})
    } else {
      setTimeout(() => {
        playPromptAudio(items[0])
      }, 400)
    }
    onRestart?.()
  }

  const isCurrentCompleted = completedItemIds.has(currentItem.id)
  const currentFeedback = itemFeedbacks[currentItem.id]

  return (
    <div className="interview-profile-container">
      {/* Audio player ẩn cho Audio tổng quan (tự động phát ngầm) */}
      {overallAudioUrl && (
        <audio
          ref={overallAudioRef}
          src={overallAudioUrl}
          onEnded={handleOverallAudioEnded}
          style={{ display: 'none' }}
        />
      )}

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



      {/* NÚT BẮT ĐẦU NẾU TRÌNH DUYỆT CHẶN AUTOPLAY LẦN ĐẦU */}
      {isAutoplayBlocked && (
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #93c5fd',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <span style={{ fontSize: '14px', color: '#1d4ed8', fontWeight: 600 }}>
            🎧 Bấm để bắt đầu nghe âm thanh bài học:
          </span>
          <button
            type="button"
            className="interview-audio1-btn"
            onClick={handleManualStart}
          >
            ▶️ Bắt đầu bài học
          </button>
        </div>
      )}

      {/* THÔNG BÁO ĐANG PHÁT AUDIO INTRO */}
      {isIntroPlaying && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '13px',
          color: '#0369a1',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ animation: 'spin 2s linear infinite' }}>🎧</span>
          <span>Đang phát phần giới thiệu bài học... Khi kết thúc, câu hỏi 1 sẽ tự động phát.</span>
        </div>
      )}

      {/* TIẾN TRÌNH TỪNG CÂU TUẦN TỰ (ĐÚNG TỪNG CÂU 1) */}
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
              <span>{idx + 1}</span>
              {isDone && <span>✓</span>}
            </div>
          )
        })}
      </div>

      {/* KHUNG TƯƠNG TÁC CHÍNH */}
      {!isAllCompleted ? (
        <section className="interview-active-card" style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '16px',
          padding: '22px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}>
          {/* NÚT NGHE AUDIO 1 (CHỈ ĐỂ LẠI NÚT AUDIO) */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <button
              type="button"
              id={`playAudio1Btn-${currentItem.id}`}
              className="interview-audio1-btn"
              onClick={() => playPromptAudio(currentItem)}
              style={{
                padding: '10px 22px',
                fontSize: '14px',
                borderRadius: '10px',
              }}
            >
              {playingAudioType === 'prompt' && playingItemId === currentItem.id ? '⏹️ Dừng nghe Audio 1' : '▶️ Nghe Audio 1'}
            </button>
          </div>

          {/* KHUNG MICRO GHI ÂM CÂU HỎI */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 0 4px',
          }}>
            <div style={{ textAlign: 'center', fontSize: '14px', color: '#475569', fontWeight: 600 }}>
              Bấm để hỏi
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
                  {isProcessingSTT ? '⏳ Đang nhận diện...' : '🎙️ Bấm để hỏi'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>✓</span>
                <div style={{ flex: 1, fontSize: '15px', color: '#166534', fontWeight: 700 }}>
                  Correct
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
                  onClick={() => playAnswerAudio(currentItem, false)}
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

          {/* KHI HỌC SINH HỎI SAI */}
          {currentFeedback && !currentFeedback.matched && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '1.5px solid #fca5a5',
              color: '#b91c1c',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <span>⚠️</span>
              <span>Try again</span>
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
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: '42px', marginBottom: '10px' }}>🎉</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534', marginBottom: '6px' }}>
            Congratulation
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', margin: '10px auto 20px', background: '#f0fdf4', border: '1.5px solid #86efac', padding: '8px 24px', borderRadius: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>Điểm số:</span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#15803d' }}>100</span>
            <span style={{ fontSize: '14px', color: '#166534' }}>/100</span>
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
