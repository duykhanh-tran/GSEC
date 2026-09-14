import type { Form3ParagraphConfig, WritingItemConfig } from '../task-engine/dynamic-schema'
import type { PronunciationScoreResult } from './pronunciationScorer'
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
    // Bỏ qua các số, giờ giấc, token chứa số
    if (/\d/.test(token)) continue

    // Ký tự đơn lẻ trong tiếng Anh chỉ có 'a' hoặc 'i' là từ có nghĩa
    if (token.length === 1) {
      if (token !== 'a' && token !== 'i') {
        return { isGibberish: true, token, reason: `Ký tự đơn lẻ "${token}" không phải là một từ tiếng Anh có nghĩa` }
      }
      continue
    }

    if (token.length <= 3) continue

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
 * Danh sách các Model Gemini chính thức của Google (ưu tiên Flash 2.5 -> 2.0 -> 1.5)
 */
export const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-pro-latest',
  'gemini-2.5-flash',
]

/**
 * Gọi Gemini API với cơ chế tự động thử model tiếp theo nếu gặp lỗi 429 (rate limit) hoặc 503/404
 */
async function callGeminiAPI(
  apiKey: string,
  userPrompt: string,
  systemInstruction?: string,
  maxOutputTokens: number = 2048,
  responseMimeType: string = 'application/json',
): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const payload: any = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType,
          temperature: 0.2,
          maxOutputTokens,
        },
      }

      // thinkingConfig chỉ gửi với model 2.5 để tránh lỗi 400 Bad Request ở model khác
      if (model.includes('2.5')) {
        payload.generationConfig.thinkingConfig = {
          thinkingBudget: 0,
        }
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
        const parts = data?.candidates?.[0]?.content?.parts || []
        const textPart = parts.find((p: any) => p.text && !p.thought) || parts[0]
        const text = textPart?.text
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
- Every word must be a real English word or an acceptable proper noun (such as Vietnamese names: "Tran Quoc", "Nguyen Du", "Ha Noi", "Toan", "Doan", "Nam", "Linh", "Minh", "Hoa", "Lan", "Mai", "Phong", "Khoa", "Dung", "Duc", "Bao", "Huy", etc., or textbook character names like "Peter", "Mary", "Linda", "Tom", "Tony").
- CRITICAL FOR VIETNAMESE NAMES: In Vietnamese, personal names like "Toan" (Toàn) and "Doan" (Đoàn) are single, continuous words written without spaces. Do NOT confuse them with English phrases like "to an" or "do an". In sentences like "Toan is my friend." or "I play with Toan.", "Toan" is a valid proper name, NOT a run-on of "to an"!
- REJECT single-letter or non-word entries (e.g. "S", "X", "B", "A" standing alone without sentence context). A single letter standing alone is NOT an action or answer. Set is_correct = false, score = 0, error_type = "gibberish", and tell the student in feedback_vi to write a complete sentence.
- REJECT words written together without spaces (run-on/concatenated words like "fourpen", "myschool", "inmy", "gotoschool", "playfootball"). Set is_correct = false, score = 40, error_type = "spelling", and explain in feedback_vi that words must be separated by spaces.
- REJECT any gibberish, non-existent words, random keyboard typing (e.g. "sjnvldkfjvblkjdfb", "asdfghjk", "xxxyyy"). Set is_correct = false, score = 0, error_type = "gibberish", and point out the meaningless word in feedback_vi.
- TIME & NUMBER EXPRESSIONS (CRITICAL - ACCEPT AS FULLY VALID & BE LENIENT):
  * Students frequently write times and numbers (e.g. "5.30", "5:30", "5.30pm", "5:30 pm", "5.30 p.m.", "5:30 p.m.", "5 o'clock", "half past five", "quarter past seven", "quarter to eight", "at 5.30", "5 pm", "5:00", "5").
  * These are standard, fully valid English expressions.
  * NEVER mark them as gibberish, spelling errors, or invalid words.
  * Grade them leniently: accept both 12-hour and 24-hour formats, "." or ":" as separators, with or without "am/pm", with or without space before "am/pm", and with or without final period.
- The sentence must express a coherent, logical meaning.

2. GRAMMAR & SYNTAX (CRITICAL):
- SENTENCE FRAGMENTS & MISSING VERB (STRICT): Every complete English sentence MUST contain a subject and a verb (predicate). If a sentence lacks a verb (e.g. "Before school, I S" or "In class, I"), it is an incomplete sentence fragment. Set is_correct = false, score = 20, error_type = "grammar", and instruct the student to add an action verb.
- Plural nouns after numbers > 1: After "two", "three", "four", etc. or "many", countable nouns MUST be plural (e.g., "four pens", NOT "four pen"). If singular noun is used after numbers > 1, set is_correct = false, score = 50, error_type = "grammar", and remind the student to use plural "-s".
- Subject-verb agreement (e.g., "He plays", NOT "He play"; "I am", NOT "I is").
- Correct verb forms and tenses (NO double verbs like "feel is", "have are", "is go").
- Proper parts of speech: After linking verbs like "feel", use an adjective directly ("feel excited"), NOT "feel is a excited".
- If teacher's scoring criteria specifies constraints (e.g. adverbs of frequency, or "tuyệt đối không điền 1 chữ là cho đúng"), STRICTLY ENFORCE THEM!
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
  scoringCriteria?: string,
): AIGrammarResult {
  const trimmed = sentence.trim()
  const minWords = item.min_words || 3
  const words = trimmed.split(/\s+/).filter(Boolean)
  const combinedCriteria = [scoringCriteria, item.scoring_criteria]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const hasTimePattern = /\b(\d{1,2}([.:]\d{2})?\s*(am|pm|o'clock)?|half past|quarter (past|to))\b/i.test(trimmed)
  const effectiveMinWords = hasTimePattern ? 1 : minWords

  if (words.length < effectiveMinWords) {
    return {
      is_correct: false,
      score: 40,
      feedback_en: `Your sentence is too short. Please write a full sentence with at least ${effectiveMinWords} words.`,
      feedback_vi: `Câu của bạn quá ngắn. Hãy viết một câu đầy đủ có ít nhất ${effectiveMinWords} từ nhé.`,
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
      pattern: /\bhave\s+are\b/i,
      en: 'Do not use "have" and "are" together.',
      vi: 'Không dùng "have are" cùng nhau nhé.',
    },
    {
      pattern: /\bcan\s+(?:to\s+)?(is|are|am|was|were)\b/i,
      en: 'Use the base verb after modal verb "can" (say "can be").',
      vi: 'Sau "can" dùng động từ nguyên mẫu (ví dụ "can be").',
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

  // 4. Kiểm tra ký tự đơn lẻ đứng một mình (ngoại trừ 'a' và 'i')
  const cleanWordTokens = words
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean)
  for (const tok of cleanWordTokens) {
    if (tok.length === 1 && !/\d/.test(tok)) {
      const lowTok = tok.toLowerCase()
      if (lowTok !== 'a' && lowTok !== 'i') {
        return {
          is_correct: false,
          score: 0,
          feedback_en: `Single letter "${tok}" is not a valid English word. Please write a complete word.`,
          feedback_vi: `Ký tự đơn lẻ "${tok}" không phải là một từ tiếng Anh có nghĩa. Em hãy viết một từ vựng hoàn chỉnh nhé!`,
          error_type: 'gibberish',
        }
      }
    }
  }

  // 5. Kiểm tra vị ngữ / động từ hành động (Sentence Fragment & Missing Verb Check)
  // Trong tiếng Anh chuẩn, một câu có chủ ngữ bắt buộc phải có động từ vị ngữ (predicate)
  const COMMON_VERB_REGEX = /\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|shall|should|may|might|must|play|plays|played|playing|go|goes|went|gone|going|come|comes|came|coming|see|sees|saw|seen|seeing|watch|watches|watched|watching|listen|listens|listened|listening|speak|speaks|spoke|spoken|speaking|talk|talks|talked|talking|say|says|said|saying|tell|tells|told|telling|ask|asks|asked|asking|answer|answers|answered|answering|read|reads|reading|write|writes|wrote|written|writing|draw|draws|drew|drawn|drawing|sing|sings|sang|sung|singing|dance|dances|danced|dancing|swim|swims|swam|swum|swimming|run|runs|ran|running|walk|walks|walked|walking|jump|jumps|jumped|jumping|ride|rides|rode|riding|study|studies|studied|studying|learn|learns|learned|learning|teach|teaches|taught|teaching|help|helps|helped|helping|make|makes|made|making|take|takes|took|taken|taking|give|gives|gave|given|giving|get|gets|got|getting|eat|eats|ate|eaten|eating|drink|drinks|drank|drunk|drinking|cook|cooks|cooked|cooking|sleep|sleeps|slept|sleeping|wake|wakes|woke|waking|live|lives|lived|living|stay|stays|stayed|staying|work|works|worked|working|open|opens|opened|opening|close|closes|closed|closing|start|starts|started|starting|finish|finishes|finished|finishing|clean|cleans|cleaned|cleaning|wash|washes|washed|washing|brush|brushes|brushed|brushing|leave|leaves|left|leaving|arrive|arrives|arrived|arriving|wear|wears|wore|worn|wearing|use|uses|used|using|think|thinks|thought|thinking|know|knows|knew|known|knowing|meet|meets|met|meeting|feel|feels|felt|feeling|look|looks|looked|looking|like|likes|liked|liking|love|loves|loved|loving|want|wants|wanted|wanting|need|needs|needed|needing|chat|chats|chatted|chatting|relax|relaxes|relaxed|relaxing|cycle|cycles|cycled|cycling|stand|sit|sits|sat|sitting)\b/i
  
  const hasSubject = /\b(i|he|she|they|we|you|it|students?|children|friends?|classmates?|people|my\s+[a-z]+)\b/i.test(lower)
  const hasVerb = COMMON_VERB_REGEX.test(lower)

  if (hasSubject && !hasVerb && !hasTimePattern) {
    return {
      is_correct: false,
      score: 25,
      feedback_en: 'Incomplete sentence. Your sentence is missing an action verb.',
      feedback_vi: 'Câu của em chưa hoàn chỉnh vì thiếu động từ chỉ hành động. Em hãy bổ sung động từ (ví dụ: "play", "study", "eat breakfast") để hoàn thành câu nhé!',
      error_type: 'grammar',
    }
  }

  // 6. Kiểm tra tiêu chí giáo viên (ví dụ: trạng từ chỉ tần suất, không điền 1 chữ)
  const requiresFrequency = combinedCriteria.includes('trạng từ chỉ tần suất') || combinedCriteria.includes('frequency')
  const hasFrequencyWord = /\b(always|usually|often|sometimes|rarely|seldom|never)\b/i.test(lower)
  if (requiresFrequency && !hasFrequencyWord) {
    return {
      is_correct: false,
      score: 45,
      feedback_en: 'Please include an adverb of frequency (always, usually, often, sometimes, never) as required by the lesson.',
      feedback_vi: 'Theo yêu cầu của đề bài, em cần sử dụng trạng từ chỉ tần suất (always, usually, often, sometimes, never) trong câu nhé!',
      error_type: 'grammar',
    }
  }

  if (combinedCriteria.includes('tuyệt đối không điền 1 chữ') || combinedCriteria.includes('không điền 1 chữ')) {
    if (words.length < 3) {
      return {
        is_correct: false,
        score: 0,
        feedback_en: 'A single letter or short word is not allowed. Please write a complete grammatical sentence.',
        feedback_vi: 'Tuyệt đối không điền 1 chữ cái. Em hãy viết một câu hoàn chỉnh đúng ngữ pháp nhé!',
        error_type: 'gibberish',
      }
    }
  }

  const hasPunctuation = /[.?!]$/.test(trimmed)
  const isCapitalized = /^[A-Z]/.test(trimmed)

  // Nếu tiêu chí giáo viên yêu cầu chặt chẽ về dấu chấm hoặc viết hoa:
  const strictPunctuation = combinedCriteria.includes('dấu chấm') || combinedCriteria.includes('period') || combinedCriteria.includes('chấm cuối')
  const strictCapital = combinedCriteria.includes('viết hoa') || combinedCriteria.includes('capital') || combinedCriteria.includes('chữ hoa')

  if (!hasPunctuation && strictPunctuation) {
    return {
      is_correct: false,
      score: 70,
      feedback_en: 'According to the teacher\'s rubric, your sentence must end with a full stop (.).',
      feedback_vi: 'Theo tiêu chí chấm của giáo viên, câu của em cần có dấu chấm câu (.) ở cuối nhé.',
      error_type: 'punctuation',
      corrected_sentence: `${trimmed}.`,
    }
  }

  if (!isCapitalized && strictCapital) {
    return {
      is_correct: false,
      score: 70,
      feedback_en: 'According to the teacher\'s rubric, the first letter must be capitalized.',
      feedback_vi: 'Theo tiêu chí chấm của giáo viên, em cần viết hoa chữ cái đầu câu nhé.',
      error_type: 'grammar',
      corrected_sentence: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    }
  }

  // Nếu thiếu cả viết hoa VÀ thiếu dấu chấm câu -> nhắc nhở
  if (!isCapitalized && !hasPunctuation) {
    return {
      is_correct: false,
      score: 70,
      feedback_en: 'Remember to capitalize the first letter and end your sentence with a full stop (.).',
      feedback_vi: 'Chú ý viết hoa chữ cái đầu câu và có dấu chấm câu (.) ở cuối nhé.',
      error_type: 'punctuation',
    }
  }

  // Nếu chỉ thiếu dấu chấm câu cuối (chế độ thường) -> CHO ĐÚNG và nhắc nhở
  if (!hasPunctuation) {
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
  scoringCriteria?: string,
): Promise<AIGrammarResult> {
  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  const finalCriteria = [scoringCriteria, item.scoring_criteria]
    .filter(Boolean)
    .map((c) => c!.trim())
    .filter(Boolean)
    .join('\n')

  if (!apiKey || !apiKey.trim()) {
    return evaluateSentenceHeuristically(sentence, item, finalCriteria)
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
${
  finalCriteria
    ? `\nTEACHER'S SCORING CRITERIA (MANDATORY TO FOLLOW STRICTLY):
"""
${finalCriteria}
"""
Please strictly evaluate the student's sentence against the teacher's scoring criteria above. Deduct points or set is_correct = false if any criterion is violated.\n`
    : ''
}
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
      return evaluateSentenceHeuristically(sentence, item, finalCriteria)
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

    // Màng lọc Guardrail: Kiểm tra chéo lỗi từ dính chữ, hòa hợp số ít/nhiều hoặc gõ phím vô nghĩa
    const gib = detectGibberish(sentence)
    if (gib.isGibberish && result.is_correct) {
      result.is_correct = false
      result.score = 0
      result.error_type = 'gibberish'
      result.feedback_vi = `Từ "${gib.token}" không phải từ tiếng Anh có nghĩa. Em hãy thay bằng một từ vựng tiếng Anh thật nhé!`
      result.feedback_en = `The word "${gib.token}" is not a recognized English word. Please use a real English word.`
    } else {
      const lexCheck = checkSentenceLexicon(sentence)
      if (lexCheck.hasError && result.is_correct) {
        // Chỉ ghi đè AI nếu là lỗi hòa hợp số nhiều hoặc dính chữ thực sự (concatenated)
        // Không ghi đè nếu chỉ là spelling từ vựng mở rộng/tên riêng mà AI đã công nhận
        const shouldOverride =
          lexCheck.errorType === 'plural_agreement' ||
          lexCheck.errorType === 'concatenated' ||
          lexCheck.errorType === 'concatenated_typo'

        if (shouldOverride) {
          result.is_correct = false
          result.score = Math.min(result.score, 45)
          result.feedback_vi = lexCheck.feedback_vi || result.feedback_vi
          result.feedback_en = lexCheck.feedback_en || result.feedback_en
          result.error_type = lexCheck.errorType === 'plural_agreement' ? 'grammar' : 'spelling'
        }
      }
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
    scoring_criteria?: string
  }>,
  subMode: string = 'FREE_SENTENCE',
  customApiKey?: string,
  scoringCriteria?: string,
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
      fallbackMap[it.id] = evaluateSentenceHeuristically(
        it.sentence,
        {
          id: it.id,
          label: it.label || '',
          prompt: it.prompt,
          required_words: it.required_words,
          hints: it.hints,
          scoring_criteria: it.scoring_criteria,
        },
        scoringCriteria,
      )
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
    ...(it.scoring_criteria ? { scoring_criteria: it.scoring_criteria } : {}),
  }))

  const userPrompt = `Evaluate the following student sentences for a school lesson (mode: ${subMode}).
${
  scoringCriteria && scoringCriteria.trim()
    ? `\nTEACHER'S SCORING CRITERIA (MANDATORY TO FOLLOW STRICTLY FOR THIS EXERCISE):
"""
${scoringCriteria.trim()}
"""
Please strictly evaluate every student sentence against the teacher's scoring criteria above. Deduct points or set is_correct = false if the criteria are violated.\n`
    : ''
}
Return a JSON object with a "results" field mapping each item id to its evaluation:
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

          // Màng lọc Guardrail: Kiểm tra chéo lỗi từ dính chữ, hòa hợp số ít/nhiều hoặc gõ phím vô nghĩa
          const gib = detectGibberish(it.sentence)
          if (gib.isGibberish && itemRes.is_correct) {
            itemRes.is_correct = false
            itemRes.score = 0
            itemRes.error_type = 'gibberish'
            itemRes.feedback_vi = `Từ "${gib.token}" không phải từ tiếng Anh có nghĩa. Em hãy thay bằng một từ vựng tiếng Anh thật nhé!`
            itemRes.feedback_en = `The word "${gib.token}" is not a recognized English word. Please use a real English word.`
          } else {
            const lexCheck = checkSentenceLexicon(it.sentence)
            if (lexCheck.hasError && itemRes.is_correct) {
              const shouldOverride =
                lexCheck.errorType === 'plural_agreement' ||
                lexCheck.errorType === 'concatenated' ||
                lexCheck.errorType === 'concatenated_typo'

              if (shouldOverride) {
                itemRes.is_correct = false
                itemRes.score = Math.min(itemRes.score, 45)
                itemRes.feedback_vi = lexCheck.feedback_vi || itemRes.feedback_vi
                itemRes.feedback_en = lexCheck.feedback_en || itemRes.feedback_en
                itemRes.error_type = lexCheck.errorType === 'plural_agreement' ? 'grammar' : 'spelling'
              }
            }
          }

          resultsMap[it.id] = itemRes
        } else {
          // Dự phòng cho item bị thiếu
          resultsMap[it.id] = evaluateSentenceHeuristically(
            it.sentence,
            {
              id: it.id,
              label: it.label || '',
              prompt: it.prompt,
              required_words: it.required_words,
              hints: it.hints,
              scoring_criteria: it.scoring_criteria,
            },
            scoringCriteria,
          )
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

/**
 * Đánh giá bài phát âm (Form 4) kết hợp Gemini AI dựa trên tiêu chí chấm điểm của giáo viên
 */
export async function evaluateSpeakingWithAI(
  targetSentence: string,
  recognizedText: string,
  baselineResult: PronunciationScoreResult,
  scoringCriteria?: string,
  customApiKey?: string
): Promise<PronunciationScoreResult> {
  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  if (!apiKey || !apiKey.trim() || !scoringCriteria?.trim()) {
    return baselineResult
  }

  const prompt = `You are an expert English language and pronunciation assessor for Vietnamese students (grade 6).
Target sentence: "${targetSentence}"
Recognized speech from student: "${recognizedText}"
Acoustic baseline:
- Word accuracy: ${baselineResult.accuracyScore}/100
- Acoustic confidence: ${baselineResult.confidenceScore}/100
- Baseline score: ${baselineResult.score}/100
- Evaluated words: ${JSON.stringify(
    baselineResult.evaluatedWords.map((w) => ({
      word: w.targetWord,
      heard: w.heardWord,
      status: w.status,
    }))
  )}

TEACHER'S CUSTOM SCORING CRITERIA (MANDATORY TO FOLLOW STRICTLY):
"${scoringCriteria.trim()}"

STRICT EVALUATION INSTRUCTIONS:
1. If the student spoke a completely different sentence, or substituted key content words, is_passed MUST be false and score MUST NOT exceed 40.
2. Under no circumstances should a substituted, missing, or completely wrong sentence be marked as passed.
3. Only mark is_passed = true if the student spoke the actual target sentence accurately with good pronunciation.

Return JSON:
{
  "score": number,
  "is_passed": boolean,
  "feedback_vi": string,
  "feedback_en": string,
  "suggestions": string[]
}`.trim()

  try {
    const rawText = await callGeminiAPI(apiKey, prompt, undefined, 800)
    if (!rawText) return baselineResult

    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanJson)
    if (typeof parsed.score === 'number') {
      const isActuallyPassed =
        baselineResult.isPassed && Boolean(parsed.is_passed) && parsed.score >= 80

      return {
        ...baselineResult,
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        isPassed: isActuallyPassed,
        feedback_vi: parsed.feedback_vi || baselineResult.feedback_vi,
        feedback_en: parsed.feedback_en || baselineResult.feedback_en,
        suggestions:
          Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
            ? parsed.suggestions
            : baselineResult.suggestions,
      }
    }
  } catch (err) {
    console.warn('evaluateSpeakingWithAI fallback to baseline:', err)
  }

  return baselineResult
}

export interface TopicSpeakingEvaluationResult {
  is_passed: boolean
  score: number // 0 - 100
  feedback_vi: string
  feedback_en: string
  topic_relevance: { passed: boolean; feedback: string }
  grammar_score: number
  vocabulary_score: number
  criteria_evaluations: Array<{ name: string; passed: boolean; feedback: string }>
  transcript: string
  suggested_improvement?: string
}

export async function evaluateTopicSpeakingWithAI(
  spokenText: string,
  selectedTopic: string,
  prompt: string,
  scoringCriteria?: string,
  passScore: number = 80,
  customApiKey?: string,
): Promise<TopicSpeakingEvaluationResult> {
  const trimmed = (spokenText || '').trim()
  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  const fallbackHeuristic = (): TopicSpeakingEvaluationResult => {
    const words = trimmed.split(/\s+/).filter(Boolean)
    const isShort = words.length < 5
    const isPassed = !isShort && words.length >= 8
    const baseScore = isShort ? 50 : isPassed ? 85 : 70

    return {
      is_passed: baseScore >= passScore,
      score: baseScore,
      feedback_vi: isPassed
        ? 'Bài nói tốt, thể hiện đúng chủ đề đã chọn!'
        : 'Bạn cần nói dài hơn (ít nhất 2-3 câu hoàn chỉnh) và nêu rõ lý do cho chủ đề đã chọn nhé.',
      feedback_en: isPassed
        ? 'Good speaking effort on the chosen topic!'
        : 'Try to speak a bit longer and give clear reasons.',
      topic_relevance: {
        passed: !isShort,
        feedback: !isShort ? 'Nội dung liên quan đến chủ đề đã chọn.' : 'Chưa đủ độ dài để thể hiện rõ chủ đề.',
      },
      grammar_score: isPassed ? 85 : 65,
      vocabulary_score: isPassed ? 85 : 65,
      criteria_evaluations: scoringCriteria
        ? scoringCriteria
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => ({
              name: c.replace(/^[-*•]\s*/, ''),
              passed: isPassed,
              feedback: isPassed ? 'Đạt tiêu chí' : 'Cần phát triển thêm',
            }))
        : [],
      transcript: trimmed,
      suggested_improvement: isPassed
        ? undefined
        : `Ví dụ: "I choose to ${selectedTopic.toLowerCase().replace(/\.$/, '')} because it helps my school and friends."`,
    }
  }

  if (!trimmed) {
    return {
      is_passed: false,
      score: 0,
      feedback_vi: 'Chưa ghi nhận được giọng nói. Bạn hãy bấm thu âm và nói lại rõ ràng nhé!',
      feedback_en: 'No speech recorded. Please speak clearly into the microphone.',
      topic_relevance: { passed: false, feedback: 'Chưa có nội dung.' },
      grammar_score: 0,
      vocabulary_score: 0,
      criteria_evaluations: [],
      transcript: '',
    }
  }

  if (!apiKey || !apiKey.trim()) {
    return fallbackHeuristic()
  }

  const userPrompt = `
You are an expert English Language Assessor evaluating a student's speech (CEFR A1-B2 level).

Task prompt given to student: "${prompt}"
Topic chosen by the student: "${selectedTopic}"
${scoringCriteria ? `TEACHER'S MANDATORY SCORING CRITERIA:\n"""\n${scoringCriteria.trim()}\n"""` : ''}
Pass score required: ${passScore}/100.

The student spoke (transcribed audio):
"""
${trimmed}
"""

Please evaluate the student's spoken answer:
1. Topic Relevance: Did the student talk about their chosen topic ("${selectedTopic}")?
2. Grammar and Syntax: Are the sentence structures grammatically correct?
3. Vocabulary and Flow: Is the vocabulary appropriate for CEFR A1-B1?
4. Teacher's criteria: Check each criterion if specified.

Return strict JSON:
{
  "is_passed": boolean,
  "score": number,
  "feedback_vi": string,
  "feedback_en": string,
  "topic_relevance": {
    "passed": boolean,
    "feedback": string
  },
  "grammar_score": number,
  "vocabulary_score": number,
  "criteria_evaluations": [
    { "name": string, "passed": boolean, "feedback": string }
  ],
  "suggested_improvement": string or null
}
`.trim()

  try {
    const rawText = await callGeminiAPI(apiKey, userPrompt, undefined, 1024)
    if (!rawText) return fallbackHeuristic()

    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanJson)
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : (parsed.is_passed ? 85 : 60)
    const isPassed = score >= passScore && Boolean(parsed.is_passed)

    return {
      is_passed: isPassed,
      score,
      feedback_vi: parsed.feedback_vi || (isPassed ? 'Bài nói rất tốt!' : 'Hãy chú ý hoàn thiện thêm bài nói nhé.'),
      feedback_en: parsed.feedback_en || (isPassed ? 'Great speaking!' : 'Please check your speech and try again.'),
      topic_relevance: parsed.topic_relevance || { passed: isPassed, feedback: isPassed ? 'Khớp chủ đề' : 'Cần nói rõ hơn về chủ đề' },
      grammar_score: typeof parsed.grammar_score === 'number' ? parsed.grammar_score : score,
      vocabulary_score: typeof parsed.vocabulary_score === 'number' ? parsed.vocabulary_score : score,
      criteria_evaluations: Array.isArray(parsed.criteria_evaluations) ? parsed.criteria_evaluations : [],
      transcript: trimmed,
      suggested_improvement: parsed.suggested_improvement || undefined,
    }
  } catch (err) {
    console.warn('evaluateTopicSpeakingWithAI error, falling back:', err)
    return fallbackHeuristic()
  }
}

/**
 * Làm sạch văn bản lời dẫn: tự động loại bỏ định dạng JSON, nhãn "guidance", các dấu ngoặc nhọn { }, ngoặc kép " "
 */
export function cleanLeadInText(raw: string): string {
  if (!raw) return ''
  let text = raw.trim()

  // Xóa markdown code block nếu có
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  // Nếu là chuỗi JSON
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text)
      const val =
        parsed.guidance ||
        parsed.lead_in ||
        parsed.leadIn ||
        parsed.message ||
        parsed.text ||
        parsed.prompt ||
        Object.values(parsed)[0]
      if (typeof val === 'string') {
        text = val
      }
    } catch {
      const match = text.match(/"(?:guidance|lead_in|message|prompt|text)"?\s*:\s*"([^"]+)"/)
      if (match && match[1]) {
        text = match[1]
      } else {
        text = text.replace(/^[{}"\s]+|[}{"\s]+$/g, '').trim()
      }
    }
  }

  // Loại bỏ các dấu { } " " thừa ở đầu và cuối
  text = text.replace(/^[{\s"“”'«]+|[}\s"“”'»]+$/g, '').trim()
  return text
}

/**
 * Lời dẫn dắt sư phạm mặc định cho TẤT CẢ các dạng bài (Form 1 đến Form 7)
 */
export function getFormPedagogicalLeadIn(
  formType: string,
  content?: any,
  _title?: string
): string {
  if (content?.intro && content.intro.trim() && !content.intro.toLowerCase().includes('check task')) {
    return cleanLeadInText(content.intro)
  }

  switch (formType) {
    case 'FORM_1_CHOICE':
      return 'Chào em! Em hãy đọc kỹ từng câu hỏi, quan sát các phương án và lựa chọn đáp án chính xác nhất nhé.'
    case 'FORM_2_FILL':
      return 'Chào em! Chúng ta cùng hoàn thành phiếu bài tập bằng cách điền câu trả lời chính xác vào từng ô trống nhé.'
    case 'FORM_3_WRITING':
      return 'Chào em! Bây giờ chúng ta cùng luyện kỹ năng viết tiếng Anh. Em hãy chú ý ngữ pháp, viết câu hoàn chỉnh và kiểm tra kỹ trước khi nộp bài nhé.'
    case 'FORM_4_SENTENCE_REPAIR':
      return 'Chào em! Em hãy quan sát câu chưa chính xác và sửa lại cho đúng ngữ pháp nhé.'
    case 'FORM_4_SPEAKING':
      return 'Chào em! Em hãy đọc to và rõ ràng từng câu tiếng Anh vào micro. AI sẽ lắng nghe và đánh giá độ chuẩn xác phát âm của em nhé.'
    case 'FORM_5_SEQUENCE':
      return 'Chào em! Em hãy đọc kỹ các đoạn văn và sắp xếp lại theo đúng thứ tự logic của câu chuyện nhé.'
    case 'FORM_5_LISTEN_REPEAT':
      return 'Chào em! Em hãy lắng nghe thật kỹ từng đoạn âm thanh mẫu, sau đó bấm micro và nhắc lại thật chuẩn xác nhé.'
    case 'FORM_6_1_PROFILE_QA':
      return 'Chào em! Em hãy quan sát hồ sơ của bạn mới, lắng nghe câu hỏi từ Gia sư AI và trả lời thật tự tin nhé.'
    case 'FORM_6_2_INTERVIEW_PROFILE':
      return 'Chào em! Chúng ta cùng tham gia buổi phỏng vấn bạn mới. Hãy lắng nghe lời dẫn và tự tin đặt câu hỏi bằng tiếng Anh nhé.'
    case 'FORM_7_TOPIC_SPEAKING':
      return content?.prompt
        ? `Chào em! Hãy chọn một chủ đề em yêu thích và tự tin trình bày bài nói nhé: "${cleanLeadInText(content.prompt)}".`
        : 'Chào em! Em hãy chọn một chủ đề trong bảng và tự tin trình bày bài nói tiếng Anh của mình nhé.'
    default:
      return 'Chào em! Em hãy hoàn thành các yêu cầu của bài tập dưới đây thật cẩn thận và tự tin nhé.'
  }
}

/**
 * Lời dẫn AI sư phạm chọn lọc chuẩn mực, hiểu ngữ cảnh và TUYỆT ĐỐI KHÔNG đưa ra đáp án hoặc gợi ý tiếng Anh
 */
export function getCuratedPedagogicalLeadIn(
  currentLabel: string,
  stepIndex: number,
  totalSteps: number,
  completedContext: Array<{ label: string; answerText?: string }> = []
): string {
  const normLabel = currentLabel.toLowerCase().trim()

  if (normLabel.includes('name') || normLabel.includes('tên')) {
    return 'Chào em! Chúng ta hãy bắt đầu bài phỏng vấn bằng việc đặt một câu hỏi để làm quen và tìm hiểu về tên của người đối diện nhé.'
  }
  if (normLabel.includes('class') || normLabel.includes('lớp') || normLabel.includes('grade')) {
    const prevName = completedContext.find((c) => c.label.toLowerCase().includes('name'))?.answerText
    return prevName
      ? `Rất tốt, em đã biết bạn tên là ${prevName} rồi! Bây giờ, em hãy đặt câu hỏi tiếp theo để xem bạn ấy đang học ở lớp nào nhé.`
      : 'Rất tốt! Em đã biết thông tin trước rồi. Bây giờ, em hãy đặt câu hỏi tiếp theo để biết bạn ấy đang học ở lớp nào nhé.'
  }
  if (normLabel.includes('subject') || normLabel.includes('môn')) {
    return 'Tuyệt vời! Chúng ta cùng tìm hiểu thêm nhé. Em hãy đặt câu hỏi xem môn học yêu thích nhất của bạn ấy là môn gì nào.'
  }
  if (normLabel.includes('activity') || normLabel.includes('after') || normLabel.includes('hoạt động')) {
    return 'Hay lắm! Đến phần câu hỏi cuối cùng rồi, em hãy hỏi xem bạn ấy thường làm hoạt động gì sau giờ học nhé.'
  }

  // Mặc định sư phạm chuẩn mực cho các câu hỏi khác
  if (stepIndex === 0) {
    return `Chào em! Chúng ta cùng bắt đầu cuộc trò chuyện nhé. Em hãy đặt câu hỏi để tìm hiểu về ${currentLabel} của bạn ấy nào.`
  }
  if (stepIndex === totalSteps - 1) {
    return `Hay lắm! Đến câu hỏi cuối cùng rồi, em hãy đặt câu hỏi để tìm hiểu về ${currentLabel} của bạn ấy nhé.`
  }
  return `Rất tốt! Tiếp theo, em hãy đặt câu hỏi để tìm hiểu thông tin về ${currentLabel} của bạn ấy nhé.`
}

/**
 * Tạo lời dẫn AI sư phạm, chuẩn mực, hiểu ngữ cảnh cho Form 6.2 (Interview AI Tutor).
 * YÊU CẦU BẮT BUỘC TỪ NGƯỜI DÙNG:
 * 1. Phù hợp tuyệt đối với học sinh, chuẩn mực sư phạm, không sử dụng từ ngữ thiếu nghiêm túc.
 * 2. Hiểu ngữ cảnh từng bước để dẫn dắt tự nhiên.
 * 3. TUYỆT ĐỐI KHÔNG gợi ý mẫu câu tiếng Anh hay đưa ra đáp án (chấp hành tuyệt đối).
 */
export async function generatePedagogicalInterviewLeadIn(
  currentLabel: string,
  stepIndex: number,
  totalSteps: number,
  completedContext: Array<{ label: string; answerText?: string }> = [],
  customApiKey?: string
): Promise<string> {
  const defaultLead = getCuratedPedagogicalLeadIn(currentLabel, stepIndex, totalSteps, completedContext)

  const apiKey =
    customApiKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('gsec_gemini_api_key') || ''
      : '') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  if (!apiKey || !apiKey.trim()) {
    return defaultLead
  }

  const prompt = `
Em là một chuyên gia Gia sư AI sư phạm tiếng Anh cho học sinh phổ thông.
Nhiệm vụ: Viết 1 lời dẫn dắt ngắn gọn (chỉ đúng 1 đến 2 câu) bằng tiếng Việt để dẫn dắt học sinh đặt câu hỏi tiếp theo trong bài phỏng vấn.
Ngữ cảnh phỏng vấn hiện tại:
- Bước: Câu hỏi ${stepIndex + 1}/${totalSteps}.
- Mục tiêu cần học sinh tự hỏi: Tìm hiểu về "${currentLabel}".
${completedContext.length > 0 ? `- Các thông tin đã biết trước đó: ${completedContext.map((c) => `${c.label}: ${c.answerText || 'đã biết'}`).join(', ')}` : '- Đây là câu hỏi đầu tiên mở đầu bài phỏng vấn.'}

YÊU CẦU BẮT BUỘC (CHẤP HÀNH TUYỆT ĐỐI):
1. Phù hợp tuyệt đối với lứa tuổi học sinh, phong cách sư phạm chuẩn mực, lịch sự, động viên và thân thiện.
2. TUYỆT ĐỐI KHÔNG dùng từ ngữ cợt nhả hoặc thiếu nghiêm túc.
3. TUYỆT ĐỐI KHÔNG đưa ra mẫu câu tiếng Anh (KHÔNG chứa "What is", "Which class", "Do you", etc.), KHÔNG gợi ý từ vựng tiếng Anh cần hỏi và KHÔNG đưa ra đáp án.
4. Chỉ dẫn dắt mục tiêu giao tiếp bằng tiếng Việt tự nhiên (ví dụ: khích lệ học sinh đặt câu hỏi về điều đó).

Chỉ xuất trực tiếp lời dẫn tiếng Việt dạng văn bản thuần, không dùng định dạng JSON, không kèm dấu ngoặc nhọn hay ngoặc kép.
`.trim()

  try {
    const raw = await callGeminiAPI(apiKey, prompt, undefined, 200, 'text/plain')
    if (!raw || !raw.trim()) return defaultLead
    const cleaned = cleanLeadInText(raw)

    // Kiểm tra an toàn: nếu vô tình có mẫu câu hỏi tiếng Anh thì dùng defaultLead để bảo đảm 100% tuân thủ yêu cầu
    if (/\b(what|which|where|when|who|why|how|is his|are you|do you)\b/i.test(cleaned)) {
      return defaultLead
    }
    return cleaned || defaultLead
  } catch (err) {
    return defaultLead
  }
}



