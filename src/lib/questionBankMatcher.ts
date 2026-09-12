/**
 * Thuật toán so khớp câu hỏi của học sinh với Ngân hàng câu hỏi (Question Bank)
 * Dùng cho Form 6.2: Phỏng vấn AI Tutor điền hồ sơ
 */

import type { Form62InterviewFieldItem } from '../task-engine/dynamic-schema'

export interface MatchResult {
  matchedFieldId: string | null
  confidence: number
  matchedQuestion?: string
  fieldLabel?: string
}

/**
 * Chuẩn hóa chuỗi văn bản: chữ thường, bỏ dấu câu và khoảng trắng thừa
 */
export function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/['’]/g, '') // what's -> whats
    .replace(/[.,?!:;–—\-()[\]{}"/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tách từ (tokens)
 */
export function tokenize(text: string): string[] {
  const norm = normalizeText(text)
  if (!norm) return []
  return norm.split(' ').filter(Boolean)
}

/**
 * Tính toán độ tương đồng từ khóa Jaccard (0.0 -> 1.0)
 */
export function calculateTokenOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let intersectionCount = 0
  for (const token of setA) {
    if (setB.has(token)) intersectionCount++
  }
  const unionCount = new Set([...tokensA, ...tokensB]).size
  return unionCount === 0 ? 0 : intersectionCount / unionCount
}

/**
 * Định nghĩa các từ khóa nhận diện mục đích câu hỏi (Intent keyphrases)
 */
const INTENT_KEYWORDS: Record<string, string[][]> = {
  name: [
    ['name'],
    ['who', 'is'],
    ['who', 'he'],
    ['who', 'she'],
  ],
  class: [
    ['class'],
    ['grade'],
    ['which', 'class'],
  ],
  subject: [
    ['subject'],
    ['favourite', 'subject'],
    ['favorite', 'subject'],
    ['like', 'most'],
    ['favourite', 'lesson'],
    ['favorite', 'lesson'],
  ],
  activity: [
    ['activity'],
    ['after', 'school'],
    ['free', 'time'],
    ['spare', 'time'],
    ['hobby'],
    ['hobbies'],
    ['sport'],
    ['play', 'sport'],
    ['play', 'football'],
    ['play', 'tennis'],
  ],
}

/**
 * So khớp câu hỏi người học (transcribedText) với danh sách các trường và ngân hàng câu hỏi
 */
export function matchQuestionToField(
  transcribedText: string,
  items: Form62InterviewFieldItem[]
): MatchResult {
  const normInput = normalizeText(transcribedText)
  if (!normInput) {
    return { matchedFieldId: null, confidence: 0 }
  }

  const inputTokens = tokenize(normInput)

  let bestMatch: MatchResult = {
    matchedFieldId: null,
    confidence: 0,
  }

  for (const item of items) {
    const fieldIdKey = item.id.toLowerCase()
    let highestFieldConfidence = 0
    let matchedSample = ''

    // 1. Kiểm tra từng câu mẫu trong question_bank của trường
    for (const q of item.question_bank) {
      const normQ = normalizeText(q)
      if (!normQ) continue

      // Exact match
      if (normInput === normQ) {
        return {
          matchedFieldId: item.id,
          confidence: 1.0,
          matchedQuestion: q,
          fieldLabel: item.label,
        }
      }

      // Substring match
      if (normInput.includes(normQ) || normQ.includes(normInput)) {
        const subConf = Math.min(normInput.length, normQ.length) / Math.max(normInput.length, normQ.length)
        if (subConf > highestFieldConfidence) {
          highestFieldConfidence = Math.max(0.85, subConf)
          matchedSample = q
        }
      }

      // Token overlap similarity
      const qTokens = tokenize(normQ)
      const overlap = calculateTokenOverlap(inputTokens, qTokens)
      if (overlap > highestFieldConfidence) {
        highestFieldConfidence = overlap
        matchedSample = q
      }
    }

    // 2. Kiểm tra từ khóa đặc trưng (Intent keywords) cho trường này
    const intentRules = INTENT_KEYWORDS[fieldIdKey] || []
    for (const phraseGroup of intentRules) {
      const allTokensPresent = phraseGroup.every((kw) => normInput.includes(kw))
      if (allTokensPresent) {
        const intentConfidence = 0.78
        if (intentConfidence > highestFieldConfidence) {
          highestFieldConfidence = intentConfidence
          matchedSample = phraseGroup.join(' ')
        }
      }
    }

    // So sánh với best match hiện tại
    if (highestFieldConfidence > bestMatch.confidence) {
      bestMatch = {
        matchedFieldId: item.id,
        confidence: highestFieldConfidence,
        matchedQuestion: matchedSample,
        fieldLabel: item.label,
      }
    }
  }

  // Ngưỡng tối thiểu để công nhận khớp câu hỏi là 0.40
  if (bestMatch.confidence >= 0.40) {
    return bestMatch
  }

  return { matchedFieldId: null, confidence: bestMatch.confidence }
}

/**
 * Kiểm tra câu trả lời nhập liệu của học sinh có đúng với trường đáp án không
 * Hỗ trợ cả câu rút gọn (VD: 'Nam') lẫn câu đầy đủ (VD: 'His name is Nam')
 */
export function checkProfileAnswerMatch(
  userInput: string,
  targetAnswer: string,
  acceptedAnswers: string[] = []
): boolean {
  const normUser = normalizeText(userInput)
  const normTarget = normalizeText(targetAnswer)
  if (!normUser) return false
  if (!normTarget && acceptedAnswers.length === 0) return false

  // 1. Trùng chính xác với targetAnswer
  if (normUser === normTarget) return true

  // 2. Chứa targetAnswer đầy đủ (VD: target là 'Nam', user gõ 'His name is Nam' hoặc 'He is Nam')
  if (normTarget && normUser.includes(normTarget)) {
    return true
  }

  // 3. Trùng với bất kỳ acceptedAnswers nào
  for (const ans of acceptedAnswers) {
    const normAns = normalizeText(ans)
    if (!normAns) continue
    if (normUser === normAns) return true
    if (normAns && normUser.includes(normAns)) return true
    if (normUser && normAns.includes(normUser) && normUser.length >= 2) return true
  }

  return false
}
