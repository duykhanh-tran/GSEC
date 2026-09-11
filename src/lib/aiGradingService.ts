import type { Form3ParagraphConfig, WritingItemConfig } from '../task-engine/dynamic-schema'
import { checkSentenceLexicon } from './englishLexicon'

export interface KeywordCheckResult {
  passed: boolean
  missingWords: string[]
  foundWords: string[]
}

export interface AIGrammarResult {
  is_correct: boolean
  score: number // 0 - 100
  feedback_en: string
  feedback_vi: string
  error_type?: 'none' | 'grammar' | 'spelling' | 'punctuation' | 'meaning' | 'gibberish'
  corrected_sentence?: string
}

/**
 * Chuẩn hóa từ hoặc cụm từ để so sánh:
 * Chuyển chữ thường, loại bỏ các ký tự dấu câu ở rìa (ví dụ: "badminton." -> "badminton")
 */
export function normalizeToken(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
}

/**
 * BƯỚC 1: Kiểm tra xem câu của học sinh có chứa đầy đủ các từ bắt buộc hay không.
 * Hỗ trợ cả từ đơn (ví dụ: "usually") và cụm từ (ví dụ: "play badminton").
 */
export function checkRequiredKeywords(
  sentence: string,
  requiredWords: string[],
): KeywordCheckResult {
  if (!sentence || !sentence.trim()) {
    return {
      passed: false,
      missingWords: [...requiredWords],
      foundWords: [],
    }
  }

  const normalizedSentence = sentence.toLowerCase()
  // Tách các từ trong câu của học sinh thành mảng tokens đã loại bỏ dấu câu
  const sentenceTokens = sentence
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean)

  const missingWords: string[] = []
  const foundWords: string[] = []

  for (const rawReq of requiredWords) {
    const cleanReq = rawReq.trim()
    if (!cleanReq) continue

    if (cleanReq.includes(' ')) {
      // Trường hợp cụm từ: so sánh chuỗi regex boundary
      const phraseRegex = new RegExp(
        `\\b${cleanReq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      )
      if (phraseRegex.test(normalizedSentence)) {
        foundWords.push(cleanReq)
      } else {
        missingWords.push(cleanReq)
      }
    } else {
      // Trường hợp từ đơn: kiểm tra trong danh sách tokens hoặc biến thể cơ bản
      const targetToken = normalizeToken(cleanReq)
      const found = sentenceTokens.some((t) => {
        if (t === targetToken) return true
        // Cho phép các biến thể đuôi s/es/ed/ing nếu từ gốc >= 3 chữ cái
        if (targetToken.length >= 3) {
          if (t === `${targetToken}s` || t === `${targetToken}es`) return true
          if (t === `${targetToken}ed` || t === `${targetToken}ing`) return true
        }
        return false
      })

      if (found) {
        foundWords.push(cleanReq)
      } else {
        missingWords.push(cleanReq)
      }
    }
  }

  return {
    passed: missingWords.length === 0,
    missingWords,
    foundWords,
  }
}

/**
 * Kiểm tra các chuỗi gõ phím vô nghĩa / từ rác không có trong tiếng Anh (Gibberish)
 */
export function detectGibberish(text: string): { isGibberish: boolean; token?: string; reason?: string } {
  if (!text || !text.trim()) return { isGibberish: false }

  const tokens = text
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean)

  for (const token of tokens) {
    // Bỏ qua các số hoặc từ quá ngắn (1-3 ký tự)
    if (token.length <= 3 || /^\d+$/.test(token)) continue

    // 1. Không chứa bất kỳ nguyên âm nào (a, e, i, o, u, y) trong từ >= 4 ký tự
    if (!/[aeiouy]/i.test(token)) {
      return { isGibberish: true, token, reason: `Từ "${token}" không chứa nguyên âm hợp lệ` }
    }

    // 2. Chứa 5 phụ âm liên tiếp trở lên (ví dụ: sjnvldkfjvblkjdfb, rstlmnhjk)
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(token)) {
      return { isGibberish: true, token, reason: `Từ "${token}" có chuỗi phụ âm bất thường` }
    }

    // 3. Ký tự lặp lại liên tiếp 4 lần trở lên (ví dụ: "aaaa", "zzzz")
    if (/(.)\1{3,}/i.test(token)) {
      return { isGibberish: true, token, reason: `Từ "${token}" lặp lại ký tự bất thường` }
    }

    // 4. Chuỗi bấm phím bừa bãi phổ biến
    const keyboardPatterns = ['asdfgh', 'zxcvbn', 'qwert', 'lkjhgf', 'poiuyt', 'vblkj', 'kfjvb']
    if (keyboardPatterns.some((p) => token.toLowerCase().includes(p))) {
      return { isGibberish: true, token, reason: `Từ "${token}" là chuỗi ký tự bàn phím vô nghĩa` }
    }
  }

  return { isGibberish: false }
}

/**
 * Danh sách các Model Gemini ưu tiên thử nghiệm tuần tự (Flash 3.5 -> 3.5-Lite -> 3.1-Lite -> 3.6 -> Latest)
 * gemini-3.5-flash phản hồi nhanh và ổn định nhất trên free tier, tránh lỗi 503 của 3.6.
 */
export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
]

/**
 * Gọi Gemini API với cơ chế tự động thử model tiếp theo nếu gặp lỗi 429 (rate limit) hoặc 503/404
 */
async function callGeminiAPI(
  apiKey: string,
  userPrompt: string,
  systemInstruction?: string,
  maxOutputTokens: number = 2048,
): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const payload: any = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens,
          thinkingConfig: {
            thinkingBudget: 0, // Vô hiệu hóa thinking để tránh tiêu tốn 800+ token làm cụt JSON
          },
        },
      }

      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return text
      } else {
        console.warn(`Model ${model} returned status ${response.status}, trying next model...`)
      }
    } catch (err) {
      console.warn(`Model ${model} call error:`, err)
    }
  }
  return null
}

const SYSTEM_INSTRUCTION_SENTENCE = `
You are an expert, encouraging English Language Assessor and Pedagogy Specialist evaluating elementary and middle school English learners (CEFR A1-B1).

Your evaluation MUST be rigorous and fair according to standard English:

1. VOCABULARY & SPELLING (CRITICAL):
- Every word must be a real English word or an acceptable proper noun (such as Vietnamese names: "Tran Quoc", "Nguyen Du", "Ha Noi").
- REJECT words written together without spaces (run-on/concatenated words like "fourpen", "myschool", "inmy", "gotoschool", "playfootball"). Set is_correct = false, score = 40, error_type = "spelling", and explain in feedback_vi that words must be separated by spaces.
- REJECT words with typos or extra letters (e.g. "fourlpen"). Set is_correct = false, score = 40, error_type = "spelling", and suggest the correct form (e.g. "four pens").
- REJECT any gibberish, non-existent words, random keyboard typing (e.g. "sjnvldkfjvblkjdfb", "asdfghjk", "xxxyyy"). Set is_correct = false, score = 0, error_type = "gibberish", and point out the meaningless word in feedback_vi.
- The sentence must express a coherent, logical meaning.

2. GRAMMAR & SYNTAX (CRITICAL):
- Plural nouns after numbers > 1: After "two", "three", "four", etc. or "many", countable nouns MUST be plural (e.g., "four pens", NOT "four pen"). If singular noun is used after numbers > 1, set is_correct = false, score = 50, error_type = "grammar", and remind the student to use plural "-s".
- Subject-verb agreement (e.g., "He plays", NOT "He play"; "I am", NOT "I is").
- Correct verb forms and tenses (NO double verbs like "feel is", "have are", "is go").
- Proper parts of speech: After linking verbs like "feel", use an adjective directly ("feel excited"), NOT "feel is a excited".
- If grammatical errors exist, set is_correct = false, score = 30-65, error_type = "grammar", and clearly explain how to fix it in feedback_vi.

3. PUNCTUATION & CAPITALIZATION (LENIENT & CONSTRUCTIVE):
- IMPORTANT: If the sentence is grammatically correct, correctly spelled, and meaningful, but only misses a full stop (.) at the very end or has minor spacing before punctuation (e.g. "school ,"), DO NOT mark the sentence as incorrect! Set is_correct = true, score = 90-95, and gently remind the student in feedback_vi to add a full stop or remove the extra space.
- Do NOT fail an otherwise good sentence solely because of a missing final period!
- If the first letter is lowercase but everything else is correct, set is_correct = true, score = 90, with a gentle reminder.

4. FEEDBACK:
- feedback_vi: Clear, warm explanation in Vietnamese (max 35 words).
- feedback_en: Short English guidance (max 25 words).
- corrected_sentence: Standard corrected sentence if there was an error, or null if already correct.
`.trim();

/**
 * Bộ kiểm tra quy tắc ngữ pháp Heuristic (Dự phòng khi mất mạng hoặc không có API Key)
 */
export function evaluateSentenceHeuristically(
  sentence: string,
  item: WritingItemConfig,
): AIGrammarResult {
  const trimmed = sentence.trim()
  const minWords = item.min_words || 3
  const words = trimmed.split(/\s+/).filter(Boolean)

  if (words.length < minWords) {
    return {
      is_correct: false,
      score: 40,
      feedback_en: `Your sentence is too short. Please write a full sentence with at least ${minWords} words.`,
      feedback_vi: `Câu của bạn quá ngắn. Hãy viết một câu đầy đủ có ít nhất ${minWords} từ nhé.`,
      error_type: 'meaning',
    }
  }

  // 1. Kiểm tra từ rác vô nghĩa (Gibberish)
  const gib = detectGibberish(trimmed)
  if (gib.isGibberish) {
    return {
      is_correct: false,
      score: 0,
      feedback_en: `The word "${gib.token}" is not a real English word. Please write real vocabulary.`,
      feedback_vi: `Từ "${gib.token}" không phải từ tiếng Anh có nghĩa. Em hãy thay bằng một từ vựng tiếng Anh thật nhé!`,
      error_type: 'gibberish',
    }
  }

  // 2. Kiểm tra từ điển tiếng Anh, từ dính chữ và hòa hợp số đếm (Lexicon & Glued Words Check)
  const lexCheck = checkSentenceLexicon(trimmed)
  if (lexCheck.hasError) {
    return {
      is_correct: false,
      score: lexCheck.errorType === 'plural_agreement' ? 50 : 40,
      feedback_en: lexCheck.feedback_en || 'Please check your spelling and word spacing.',
      feedback_vi: lexCheck.feedback_vi || 'Vui lòng kiểm tra lại chính tả và dấu cách giữa các từ.',
      error_type: lexCheck.errorType === 'plural_agreement' ? 'grammar' : 'spelling',
      corrected_sentence: lexCheck.suggestion && lexCheck.token
        ? trimmed.replace(new RegExp(`\\b${lexCheck.token}\\b`, 'i'), lexCheck.suggestion)
        : undefined,
    }
  }

  // 3. Kiểm tra lỗi ngữ pháp phổ biến & lỗi cấu trúc câu
  const lower = trimmed.toLowerCase()
  const commonErrors: Array<{ pattern: RegExp; en: string; vi: string }> = [
    {
      pattern: /\b(feel|look|sound|smell|taste)\s+(?:is|are|am|was|were)\s+a\s+(excited|happy|sad|tired|angry|bored|good|bad)\b/i,
      en: 'Say "I feel [adjective]", without "is a". For example: "I feel excited".',
      vi: 'Sau "feel", em dùng trực tiếp tính từ "excited" mà không cần "is a" nhé. Câu đúng là "I feel excited".',
    },
    {
      pattern: /\b(feel|look|sound|smell|taste)\s+(?:is|are|am|was|were)\b/i,
      en: 'Do not use "is/are/am" after linking verbs like "feel". Say "I feel excited".',
      vi: 'Không dùng động từ to be (is/are/am) ngay sau "feel". Câu đúng là "I feel excited".',
    },
    {
      pattern: /\b(is|are|am|was|were)\s+a\s+(excited|happy|sad|tired|angry|bored|interested)\b/i,
      en: 'Do not use article "a" before an adjective without a noun. Say "I am excited".',
      vi: 'Không dùng mạo từ "a" trước tính từ đứng một mình. Hãy viết "I am excited".',
    },
    {
      pattern: /\b(have|has)\s+(?:is|are|am)\b/i,
      en: 'Incorrect verb combination.',
      vi: 'Cấu trúc động từ không chính xác.',
    },
    {
      pattern: /\b(he|she|it|my father|my mother|my brother|my sister)\s+(?:(?:always|usually|often|sometimes|rarely|never)\s+)?(play|go|do|watch|study|have)\b/i,
      en: 'Remember to add -s/-es to the verb with singular third-person subjects (He/She/It).',
      vi: 'Chú ý thêm -s/-es vào sau động từ với chủ ngữ số ít (He/She/It).',
    },
    {
      pattern: /\b(i|we|they|you)\s+(?:(?:always|usually|often|sometimes|rarely|never)\s+)?(plays|goes|does|watches|studies|has)\b/i,
      en: 'Use base form of the verb with plural subjects / I / You.',
      vi: 'Dùng động từ nguyên mẫu với chủ ngữ số nhiều hoặc I / You.',
    },
    {
      pattern: /\b(i)\s+is\b/i,
      en: 'Use "I am", not "I is".',
      vi: 'Dùng "I am", không dùng "I is".',
    },
    {
      pattern: /\b(they|we|you)\s+is\b/i,
      en: 'Use "are" with plural subjects.',
      vi: 'Dùng "are" với chủ ngữ số nhiều (They/We/You).',
    },
    {
      pattern: /\b(he|she|it)\s+are\b/i,
      en: 'Use "is" with singular subjects (He/She/It).',
      vi: 'Dùng "is" với chủ ngữ số ít (He/She/It).',
    },
  ]

  for (const err of commonErrors) {
    if (err.pattern.test(lower)) {
      return {
        is_correct: false,
        score: 40,
        feedback_en: err.en,
        feedback_vi: err.vi,
        error_type: 'grammar',
      }
    }
  }

  // 3. Kiểm tra viết hoa & dấu câu
  const firstChar = trimmed[0]
  const isCapitalized = firstChar === firstChar.toUpperCase() && /[A-Z]/.test(firstChar)
  const lastChar = trimmed[trimmed.length - 1]
  const hasEndPunctuation = ['.', '!', '?'].includes(lastChar)

  // Nếu thiếu cả viết hoa VÀ thiếu dấu chấm câu -> nhắc nhở
  if (!isCapitalized && !hasEndPunctuation) {
    return {
      is_correct: false,
      score: 70,
      feedback_en: 'Remember to capitalize the first letter and end your sentence with a full stop (.).',
      feedback_vi: 'Chú ý viết hoa chữ cái đầu câu và có dấu chấm câu (.) ở cuối nhé.',
      error_type: 'punctuation',
    }
  }

  // Nếu câu đúng ngữ pháp nhưng chỉ thiếu dấu chấm ở cuối -> CHO ĐÚNG và nhắc nhở nhẹ
  if (!hasEndPunctuation) {
    return {
      is_correct: true,
      score: 95,
      feedback_en: 'Great sentence! Remember to add a full stop (.) at the end.',
      feedback_vi: 'Câu của em rất tốt! Em nhớ thêm dấu chấm câu (.) ở cuối để câu hoàn chỉnh hơn nhé.',
      error_type: 'none',
      corrected_sentence: `${trimmed}.`,
    }
  }

  // Nếu chỉ thiếu viết hoa chữ cái đầu -> CHO ĐÚNG và nhắc nhở
  if (!isCapitalized) {
    return {
      is_correct: true,
      score: 95,
      feedback_en: 'Well done! Remember to capitalize the first letter of your sentence.',
      feedback_vi: 'Câu của em viết đúng rồi! Em nhớ viết hoa chữ cái đầu tiên nhé.',
      error_type: 'none',
      corrected_sentence: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    }
  }

  return {
    is_correct: true,
    score: 100,
    feedback_en: 'Great job! Your sentence is well-formed and grammatically correct.',
    feedback_vi: 'Rất tốt! Câu của bạn viết đúng ngữ pháp và đầy đủ ý nghĩa.',
    error_type: 'none',
  }
}

/**
 * BƯỚC 2A: Đánh giá ngữ pháp 1 câu thông qua AI Model (Google Gemini API)
 */
export async function evaluateSentenceWithAI(
  sentence: string,
  item: WritingItemConfig,
  customApiKey?: string,
): Promise<AIGrammarResult> {
  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  if (!apiKey || !apiKey.trim()) {
    return evaluateSentenceHeuristically(sentence, item)
  }

  // Pre-check gibberish nhanh
  const gib = detectGibberish(sentence)
  if (gib.isGibberish) {
    return {
      is_correct: false,
      score: 0,
      feedback_en: `"${gib.token}" is not a real English word.`,
      feedback_vi: `Từ "${gib.token}" không phải từ tiếng Anh có nghĩa. Em hãy thay bằng một từ vựng tiếng Anh thật nhé!`,
      error_type: 'gibberish',
    }
  }

  const hasKeywords = item.required_words && item.required_words.length > 0
  const prompt = `Task prompt: ${item.prompt || item.label || 'Write a sentence.'}
${hasKeywords ? `Required words that must be used: ${item.required_words!.join(', ')}` : 'Style: Free sentence writing.'}
${item.hints && item.hints.length > 0 ? `Target grammar / hints: ${item.hints.filter(Boolean).join('; ')}` : ''}

Student wrote: "${sentence.trim()}"

Return JSON:
{
  "is_correct": boolean,
  "score": number,
  "feedback_vi": string,
  "feedback_en": string,
  "error_type": "none" | "grammar" | "spelling" | "gibberish" | "meaning" | "punctuation",
  "corrected_sentence": string | null
}`

  try {
    const rawText = await callGeminiAPI(apiKey, prompt, SYSTEM_INSTRUCTION_SENTENCE, 800)
    if (!rawText) {
      return evaluateSentenceHeuristically(sentence, item)
    }

    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanJson)
    const resIsCorrect = Boolean(parsed.is_correct)
    const resScore = typeof parsed.score === 'number' ? parsed.score : resIsCorrect ? 100 : 50

    const result: AIGrammarResult = {
      is_correct: resIsCorrect,
      score: resScore,
      feedback_en: parsed.feedback_en || 'Please check your sentence structure.',
      feedback_vi: parsed.feedback_vi || 'Hãy kiểm tra lại cấu trúc câu của bạn nhé.',
      error_type: parsed.error_type || (resIsCorrect ? 'none' : 'grammar'),
      corrected_sentence: parsed.corrected_sentence || undefined,
    }

    // Màng lọc Guardrail: Nếu câu có lỗi dính chữ hoặc lỗi từ vựng nghiêm trọng
    const lexCheck = checkSentenceLexicon(sentence)
    if (lexCheck.hasError && result.is_correct) {
      result.is_correct = false
      result.score = Math.min(result.score, 45)
      result.feedback_vi = lexCheck.feedback_vi || result.feedback_vi
      result.feedback_en = lexCheck.feedback_en || result.feedback_en
      result.error_type = lexCheck.errorType === 'plural_agreement' ? 'grammar' : 'spelling'
    }

    return result
  } catch (err) {
    console.warn('AI evaluation error, falling back to heuristic:', err)
    return evaluateSentenceHeuristically(sentence, item)
  }
}

/**
 * BƯỚC 2B: Đánh giá TẤT CẢ các câu trong 1 lần gọi duy nhất (Batch API Call)
 * Giúp tiết kiệm hạn mức API (chỉ tốn 1 request thay vì N request) và tránh lỗi 429.
 */
export async function evaluateBatchSentencesWithAI(
  itemsWithSentences: Array<{
    id: string
    prompt?: string
    label?: string
    sentence: string
    required_words?: string[]
    hints?: string[]
  }>,
  subMode: string = 'FREE_SENTENCE',
  customApiKey?: string,
): Promise<Record<string, AIGrammarResult>> {
  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  const fallbackAll = () => {
    const fallbackMap: Record<string, AIGrammarResult> = {}
    for (const it of itemsWithSentences) {
      fallbackMap[it.id] = evaluateSentenceHeuristically(it.sentence, {
        id: it.id,
        label: it.label || '',
        prompt: it.prompt,
        required_words: it.required_words,
        hints: it.hints,
      })
    }
    return fallbackMap
  }

  if (!apiKey || !apiKey.trim()) {
    return fallbackAll()
  }

  const promptItems = itemsWithSentences.map((it) => ({
    id: it.id,
    prompt: it.prompt || it.label || `Question ${it.id}`,
    sentence: it.sentence,
    required_words: it.required_words || [],
    hints: it.hints || [],
  }))

  const userPrompt = `Evaluate the following student sentences for a school lesson (mode: ${subMode}). Return a JSON object with a "results" field mapping each item id to its evaluation:
${JSON.stringify(promptItems, null, 2)}

Required schema:
{
  "results": {
    "<id>": {
      "is_correct": boolean,
      "score": number,
      "feedback_vi": string,
      "feedback_en": string,
      "error_type": "none" | "grammar" | "spelling" | "gibberish" | "meaning" | "punctuation",
      "corrected_sentence": string | null
    }
  }
}`

  try {
    const rawText = await callGeminiAPI(apiKey, userPrompt, SYSTEM_INSTRUCTION_SENTENCE, 2048)
    if (!rawText) {
      return fallbackAll()
    }

    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanJson)
    const resultsMap: Record<string, AIGrammarResult> = {}

    if (parsed && typeof parsed.results === 'object') {
      for (const it of itemsWithSentences) {
        const r = parsed.results[it.id]
        if (r) {
          const itemRes: AIGrammarResult = {
            is_correct: Boolean(r.is_correct),
            score: typeof r.score === 'number' ? r.score : r.is_correct ? 100 : 50,
            feedback_vi: r.feedback_vi || 'Hãy kiểm tra lại cấu trúc câu nhé.',
            feedback_en: r.feedback_en || 'Please check your sentence structure.',
            error_type: r.error_type || (r.is_correct ? 'none' : 'grammar'),
            corrected_sentence: r.corrected_sentence || undefined,
          }

          // Màng lọc Guardrail: Kiểm tra chéo từ dính chữ / chính tả
          const lexCheck = checkSentenceLexicon(it.sentence)
          if (lexCheck.hasError && itemRes.is_correct) {
            itemRes.is_correct = false
            itemRes.score = Math.min(itemRes.score, 45)
            itemRes.feedback_vi = lexCheck.feedback_vi || itemRes.feedback_vi
            itemRes.feedback_en = lexCheck.feedback_en || itemRes.feedback_en
            itemRes.error_type = lexCheck.errorType === 'plural_agreement' ? 'grammar' : 'spelling'
          }

          resultsMap[it.id] = itemRes
        } else {
          // Dự phòng cho item bị thiếu
          resultsMap[it.id] = evaluateSentenceHeuristically(it.sentence, {
            id: it.id,
            label: it.label || '',
            prompt: it.prompt,
            required_words: it.required_words,
            hints: it.hints,
          })
        }
      }
      return resultsMap
    }

    return fallbackAll()
  } catch (err) {
    console.warn('Batch AI evaluation error, falling back to heuristic:', err)
    return fallbackAll()
  }
}

export interface AIParagraphResult {
  is_correct: boolean
  score: number // 0 - 100
  word_count: number
  feedback_vi: string
  feedback_en: string
  criteria_evaluations?: Array<{
    name: string
    passed: boolean
    feedback: string
  }>
  suggestions?: string[]
}

/**
 * Đánh giá đoạn văn Heuristic (Fallback offline khi không có API Key)
 */
export function evaluateParagraphHeuristically(
  paragraph: string,
  config: Form3ParagraphConfig,
): AIParagraphResult {
  const trimmed = paragraph.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const minWords = config.min_words || 25

  if (wordCount < minWords) {
    return {
      is_correct: false,
      score: Math.max(30, Math.round((wordCount / minWords) * 65)),
      word_count: wordCount,
      feedback_vi: `Đoạn văn hiện có ${wordCount} từ, chưa đạt yêu cầu tối thiểu ${minWords} từ. Hãy viết thêm chi tiết nhé!`,
      feedback_en: `Your paragraph has ${wordCount} words, which is fewer than the minimum requirement of ${minWords} words.`,
      suggestions: [`Cần bổ sung thêm câu để đạt tối thiểu ${minWords} từ.`],
    }
  }

  const rawSentences = trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  const sentenceCount = rawSentences.length

  const suggestions: string[] = []
  let grammarIssues = 0

  if (sentenceCount < 3) {
    suggestions.push('Đoạn văn nên có ít nhất 3-4 câu để diễn đạt ý đầy đủ và mạch lạc hơn.')
    grammarIssues += 1
  }

  if (!/^[A-Z]/.test(trimmed)) {
    suggestions.push('Hãy chú ý viết hoa chữ cái đầu tiên của đoạn văn.')
    grammarIssues += 1
  }
  if (!/[.!?]$/.test(trimmed)) {
    suggestions.push('Hãy kết thúc đoạn văn bằng dấu chấm câu (.)')
    grammarIssues += 1
  }

  if (config.helper_words && config.helper_words.length > 0) {
    const lowerPara = trimmed.toLowerCase()
    const usedHelpers = config.helper_words.filter((w) => lowerPara.includes(w.trim().toLowerCase()))
    if (usedHelpers.length === 0 && config.helper_words.length > 0) {
      suggestions.push(`Bạn có thể tham khảo dùng thêm các từ gợi ý: ${config.helper_words.slice(0, 3).join(', ')}.`)
    }
  }

  const score = grammarIssues === 0 ? 95 : Math.max(60, 95 - grammarIssues * 15)
  const isCorrect = score >= 80

  const criteriaEvals = (config.criteria || []).map((crit) => ({
    name: crit,
    passed: isCorrect,
    feedback: isCorrect ? 'Đạt yêu cầu tiêu chí đề bài.' : 'Cần diễn đạt rõ ràng và trau chuốt hơn.',
  }))

  return {
    is_correct: isCorrect,
    score,
    word_count: wordCount,
    feedback_vi: isCorrect
      ? 'Đoạn văn của bạn viết rất tốt, diễn đạt rõ ràng và đúng ngữ pháp!'
      : 'Đoạn văn tương đối tốt nhưng hãy xem các gợi ý chỉnh sửa để hoàn thiện hơn nhé.',
    feedback_en: isCorrect
      ? 'Well done! Your paragraph is coherent, well-structured, and meets the requirements.'
      : 'Good effort! Review the suggestions below to polish your paragraph.',
    criteria_evaluations: criteriaEvals.length > 0 ? criteriaEvals : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  }
}

/**
 * Đánh giá đoạn văn hoàn chỉnh bằng AI (Google Gemini 1.5 Flash)
 */
export async function evaluateParagraphWithAI(
  paragraph: string,
  config: Form3ParagraphConfig,
  customApiKey?: string,
): Promise<AIParagraphResult> {
  const words = paragraph.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const minWords = config.min_words || 25

  // Kiểm tra độ dài trước khi gọi AI để tiết kiệm token
  if (wordCount < minWords) {
    return {
      is_correct: false,
      score: Math.max(30, Math.round((wordCount / minWords) * 65)),
      word_count: wordCount,
      feedback_vi: `Đoạn văn của bạn hiện có ${wordCount} từ, chưa đạt yêu cầu tối thiểu ${minWords} từ. Hãy viết thêm chi tiết nhé!`,
      feedback_en: `Your paragraph has ${wordCount} words, which is fewer than the minimum of ${minWords} words.`,
      suggestions: [`Hãy bổ sung thêm câu để đạt ít nhất ${minWords} từ.`],
    }
  }

  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  if (!apiKey || !apiKey.trim()) {
    return evaluateParagraphHeuristically(paragraph, config)
  }

  const prompt = `
You are an encouraging and expert English Language Tutor evaluating an elementary or middle school student's written paragraph.

Task Prompt: "${config.prompt || 'Write a paragraph.'}"
Length target: ${minWords} - ${config.max_words || 100} words (Student wrote: ${wordCount} words)
${config.helper_words?.length ? `Suggested helper words/phrases: ${config.helper_words.join(', ')}` : ''}
${config.criteria?.length ? `Assessment criteria:\n${config.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}
${config.hints?.length ? `Grammar structure guidelines:\n${config.hints.map((h) => `- ${h}`).join('\n')}` : ''}

Student's written paragraph:
"${paragraph.trim()}"

Evaluate:
1. Overall grammar, spelling, punctuation, capitalization, sentence flow and cohesion.
2. Adherence to topic, criteria, and recommended length.
3. Quality of vocabulary and use of helper words if any.

Return ONLY a valid JSON object matching this schema (no markdown fences, no other text):
{
  "is_correct": true or false (true if score >= 80 and no major grammatical errors),
  "score": integer between 0 and 100,
  "feedback_en": "encouraging and constructive overall feedback in English (max 40 words)",
  "feedback_vi": "nhận xét tổng quan thân thiện bằng tiếng Việt khen ngợi và chỉ ra điểm cần cải thiện (tối đa 50 từ)",
  "criteria_evaluations": [
    {
      "name": "Tên tiêu chí",
      "passed": true or false,
      "feedback": "ngắn gọn nhận xét tiêu chí bằng tiếng Việt"
    }
  ],
  "suggestions": ["1-3 gợi ý cải thiện cụ thể bằng tiếng Việt"]
}
`.trim()

  try {
    const rawText = await callGeminiAPI(apiKey, prompt, undefined, 600)
    if (!rawText) {
      return evaluateParagraphHeuristically(paragraph, config)
    }

    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanJson)

    return {
      is_correct: Boolean(parsed.is_correct),
      score: typeof parsed.score === 'number' ? parsed.score : parsed.is_correct ? 90 : 65,
      word_count: wordCount,
      feedback_en: parsed.feedback_en || 'Good job on completing your paragraph.',
      feedback_vi: parsed.feedback_vi || 'Bạn đã hoàn thành bài viết khá tốt!',
      criteria_evaluations: Array.isArray(parsed.criteria_evaluations) ? parsed.criteria_evaluations : undefined,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : undefined,
    }
  } catch (err) {
    console.warn('AI paragraph evaluation error, falling back to heuristic:', err)
    return evaluateParagraphHeuristically(paragraph, config)
  }
}
