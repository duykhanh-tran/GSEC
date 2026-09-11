/**
 * Service tích hợp AssemblyAI Speech-to-Text (STT) cho luyện nói và chấm phát âm
 * API Docs: https://www.assemblyai.com/docs
 */

export interface AssemblyAIWord {
  text: string
  start: number
  end: number
  confidence: number
}

export interface AssemblyAITranscriptResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  confidence?: number
  words?: AssemblyAIWord[]
  error?: string
}

export interface TranscriptionProgress {
  stage: 'uploading' | 'transcribing' | 'completed' | 'error'
  message: string
  percent?: number
}

/**
 * Lấy AssemblyAI API Key từ localStorage hoặc biến môi trường .env
 */
export function getAssemblyAiApiKey(): string {
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('gsec_assemblyai_api_key')
    if (localKey && localKey.trim()) {
      return localKey.trim()
    }
  }

  const envKey = (import.meta as any).env?.VITE_ASSEMBLYAI_API_KEY
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim()
  }

  return ''
}

/**
 * Lưu AssemblyAI API Key vào localStorage
 */
export function setAssemblyAiApiKey(apiKey: string): void {
  if (typeof window !== 'undefined') {
    if (apiKey && apiKey.trim()) {
      localStorage.setItem('gsec_assemblyai_api_key', apiKey.trim())
    } else {
      localStorage.removeItem('gsec_assemblyai_api_key')
    }
  }
}

/**
 * 1. Tải file âm thanh nhị phân lên server AssemblyAI
 */
export async function uploadAudioToAssemblyAI(
  audioBlob: Blob,
  apiKey: string,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<string> {
  onProgress?.({ stage: 'uploading', message: 'Đang tải âm thanh lên máy chủ AssemblyAI...', percent: 20 })

  const response = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
    },
    body: audioBlob,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AssemblyAI Upload thất bại (${response.status}): ${errText}`)
  }

  const data = await response.json()
  if (!data.upload_url) {
    throw new Error('AssemblyAI không trả về upload_url hợp lệ.')
  }

  return data.upload_url
}

/**
 * 2. Khởi tạo yêu cầu chuyển giọng nói thành văn bản (STT)
 */
export async function requestAssemblyAITranscription(
  uploadUrl: string,
  apiKey: string,
  wordBoost: string[] = []
): Promise<string> {
  const payload: Record<string, any> = {
    audio_url: uploadUrl,
    language_code: 'en',
    speech_models: ['universal-3-5-pro', 'universal-2'], // Model thế hệ mới chuẩn nhất theo khuyến nghị của AssemblyAI
    punctuate: true,
    format_text: true,
  }

  // keyterms_prompt thay thế cho word_boost đã deprecated, giúp model ưu tiên nhận diện chính xác từ vựng
  if (wordBoost.length > 0) {
    const cleanWords = wordBoost.map((w) => w.toLowerCase().trim()).filter(Boolean)
    if (cleanWords.length > 0) {
      payload.keyterms_prompt = cleanWords
    }
  }

  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AssemblyAI Request transcript thất bại (${response.status}): ${errText}`)
  }

  const data = await response.json()
  if (!data.id) {
    throw new Error('AssemblyAI không trả về transcript id.')
  }

  return data.id
}

/**
 * 3. Polling kiểm tra trạng thái xử lý cho đến khi hoàn thành
 */
export async function pollAssemblyAITranscription(
  transcriptId: string,
  apiKey: string,
  onProgress?: (progress: TranscriptionProgress) => void,
  maxAttempts = 30
): Promise<AssemblyAITranscriptResponse> {
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++
    const progressPercent = Math.min(30 + attempts * 5, 90)
    onProgress?.({
      stage: 'transcribing',
      message: `AI đang phân tích âm học và nhận diện giọng nói (${attempts}s)...`,
      percent: progressPercent,
    })

    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        Authorization: apiKey,
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`AssemblyAI Polling thất bại (${response.status}): ${errText}`)
    }

    const data: AssemblyAITranscriptResponse = await response.json()

    if (data.status === 'completed') {
      onProgress?.({ stage: 'completed', message: 'Hoàn thành nhận diện giọng nói!', percent: 100 })
      return data
    }

    if (data.status === 'error') {
      throw new Error(`Lỗi xử lý âm thanh từ AssemblyAI: ${data.error || 'Unknown error'}`)
    }

    // Đợi 1 giây trước khi thăm dò tiếp
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('Quá thời gian chờ phản hồi từ AssemblyAI (Timeout 30s).')
}

/**
 * 4. Hàm tổng hợp toàn bộ quy trình: Audio Blob -> Upload -> STT -> Transcript & Words
 */
export async function transcribeAudioWithAssemblyAI(
  audioBlob: Blob,
  wordBoost: string[] = [],
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<AssemblyAITranscriptResponse> {
  const apiKey = getAssemblyAiApiKey()

  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình AssemblyAI API Key. Vui lòng vào trang Quản trị (Admin) hoặc cấu hình VITE_ASSEMBLYAI_API_KEY để kích hoạt tính năng chấm giọng nói.'
    )
  }

  // B1: Upload
  const uploadUrl = await uploadAudioToAssemblyAI(audioBlob, apiKey, onProgress)

  // B2: Request
  const transcriptId = await requestAssemblyAITranscription(uploadUrl, apiKey, wordBoost)

  // B3: Poll kết quả
  const result = await pollAssemblyAITranscription(transcriptId, apiKey, onProgress)

  return result
}
