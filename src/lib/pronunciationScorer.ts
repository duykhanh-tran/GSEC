import type { AssemblyAIWord } from './assemblyAiService'

export type WordPronunciationStatus =
  | 'correct' // Đọc chuẩn xác (Xanh lá)
  | 'unclear' // Đọc được nhưng âm chưa tròn vành (Vàng cam)
  | 'mispronounced' // Đọc nhầm từ khác hoặc âm sai lệch nhiều (Đỏ)
  | 'missing' // Bỏ sót từ / Chưa đọc hoặc bỏ qua (Xám hoặc tối màu)
  | 'extra' // Đọc thừa từ bên ngoài (Gạch đỏ ở câu người dùng đọc)

export interface EvaluatedWord {
  targetWord: string
  heardWord?: string
  status: WordPronunciationStatus
  confidence: number // 0.0 - 1.0
  tip?: string
}

export interface SpokenWord {
  text: string
  isExtra: boolean // true nếu là từ đọc thừa không có trong câu mẫu -> gạch đỏ
  status: WordPronunciationStatus
  confidence: number // 0.0 - 1.0
  matchedTargetWord?: string
  tip?: string
}

export interface PronunciationScoreResult {
  score: number // 0 - 100
  accuracyScore: number // 0 - 100
  confidenceScore: number // 0 - 100
  isPassed: boolean // Điểm >= passScore
  evaluatedWords: EvaluatedWord[]
  spokenWords: SpokenWord[] // Chuỗi các từ thực tế người dùng đã đọc, đánh dấu gạch đỏ từ thừa
  matchedCount: number
  totalTargetWords: number
  recognizedText: string
  feedback_vi: string
  feedback_en: string
  suggestions: string[]
}

/**
 * Chuẩn hóa một từ: chữ thường, loại bỏ dấu câu ngoại trừ dấu nháy đơn nội bộ
 */
export function cleanWord(raw: string): string {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .replace(/^[\s.,!?;:()"\[\]{}<>\/\\*#@~]+/, '')
    .replace(/[\s.,!?;:()"\[\]{}<>\/\\*#@~]+$/, '')
    .trim()
}

/**
 * Kiểm tra xem 2 từ có tương đương nhau không (xử lý số đếm, viết tắt thông dụng)
 */
function isWordMatch(w1: string, w2: string): boolean {
  const c1 = cleanWord(w1)
  const c2 = cleanWord(w2)

  if (!c1 || !c2) return false
  if (c1 === c2) return true

  // Viết tắt thông dụng
  const contractionMap: Record<string, string[]> = {
    im: ["i'm", 'i', 'am'],
    "i'm": ['im', 'i', 'am'],
    dont: ["don't", 'do', 'not'],
    "don't": ['dont', 'do', 'not'],
    isnt: ["isn't", 'is', 'not'],
    "isn't": ['isnt', 'is', 'not'],
    arent: ["aren't", 'are', 'not'],
    "aren't": ['arent', 'are', 'not'],
    cant: ["can't", 'cannot', 'can', 'not'],
    "can't": ['cant', 'cannot', 'can', 'not'],
    its: ["it's", 'it', 'is'],
    "it's": ['its', 'it', 'is'],
    thats: ["that's", 'that', 'is'],
    "that's": ['thats', 'that', 'is'],
    theyre: ["they're", 'they', 'are'],
    "they're": ['theyre', 'they', 'are'],
    weve: ["we've", 'we', 'have'],
    "we've": ['weve', 'we', 'have'],
  }

  if (contractionMap[c1]?.includes(c2) || contractionMap[c2]?.includes(c1)) {
    return true
  }

  // Số viết bằng chữ và số đếm: 1 <-> one, 2 <-> two...
  const numberMap: Record<string, string> = {
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
    '10': 'ten',
  }

  if (numberMap[c1] === c2 || numberMap[c2] === c1) {
    return true
  }

  return false
}

/**
 * Thuật toán so khớp chuỗi từ vựng (Sequence Alignment - Needleman-Wunsch variant)
 * Giúp phát hiện từ đúng, từ đọc sai, từ bị bỏ sót hoặc từ đọc thừa
 */
export function alignWords(
  targetWords: string[],
  heardWords: AssemblyAIWord[]
): Array<{ targetIdx: number | null; heardIdx: number | null; isMatch: boolean }> {
  const n = targetWords.length
  const m = heardWords.length

  // Bảng quy hoạch động dp[i][j]: chi phí nhỏ nhất để so khớp target[0..i-1] với heard[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))

  for (let i = 0; i <= n; i++) dp[i][0] = i * 1.0 // Chi phí bỏ sót từ mục tiêu
  for (let j = 0; j <= m; j++) dp[0][j] = j * 0.6 // Chi phí đọc thừa từ ngoài

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = isWordMatch(targetWords[i - 1], heardWords[j - 1].text)
      const costSub = match ? 0 : 1.2
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + costSub, // Thay thế / Khớp
        dp[i - 1][j] + 1.0, // Bỏ sót từ trong câu mẫu (Deletion)
        dp[i][j - 1] + 0.6 // Đọc thừa từ ngoài (Insertion)
      )
    }
  }

  // Truy vết (Backtracking)
  const alignment: Array<{ targetIdx: number | null; heardIdx: number | null; isMatch: boolean }> = []
  let i = n
  let j = m

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const match = isWordMatch(targetWords[i - 1], heardWords[j - 1].text)
      const costSub = match ? 0 : 1.2
      if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + costSub)) < 1e-6) {
        alignment.unshift({ targetIdx: i - 1, heardIdx: j - 1, isMatch: match })
        i--
        j--
        continue
      }
    }

    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1.0)) < 1e-6) {
      alignment.unshift({ targetIdx: i - 1, heardIdx: null, isMatch: false })
      i--
    } else if (j > 0) {
      alignment.unshift({ targetIdx: null, heardIdx: j - 1, isMatch: false })
      j--
    } else {
      break
    }
  }

  return alignment
}

/**
 * Thuật toán chấm điểm phát âm toàn diện
 * @param targetSentence Câu văn chuẩn mà học sinh cần đọc (lấy từ Form 3)
 * @param recognizedText Văn bản nhận diện được từ AssemblyAI
 * @param recognizedWords Mảng từ chi tiết kèm confidence từ AssemblyAI
 * @param passScore Ngưỡng điểm để hoàn thành bài tập (mặc định 80)
 * @param scoringCriteria Tiêu chí chấm điểm của giáo viên (tùy chọn)
 */
export function scorePronunciation(
  targetSentence: string,
  recognizedText: string,
  recognizedWords: AssemblyAIWord[] = [],
  passScore = 80,
  scoringCriteria?: string
): PronunciationScoreResult {
  const rawTargetWords = targetSentence.trim().split(/\s+/).filter(Boolean)

  if (rawTargetWords.length === 0) {
    return {
      score: 100,
      accuracyScore: 100,
      confidenceScore: 100,
      isPassed: true,
      evaluatedWords: [],
      spokenWords: [],
      matchedCount: 0,
      totalTargetWords: 0,
      recognizedText: '',
      feedback_vi: 'Không có nội dung câu cần đọc.',
      feedback_en: 'No target sentence to read.',
      suggestions: [],
    }
  }

  const hasRecognizedWords = Boolean(recognizedWords && recognizedWords.length > 0)
  const hasRecognizedText = Boolean(recognizedText && recognizedText.trim().length > 0)

  // Nếu không nhận diện được từ nào từ micro
  if (!hasRecognizedWords && !hasRecognizedText) {
    const evaluatedWords: EvaluatedWord[] = rawTargetWords.map((word) => ({
      targetWord: word,
      status: 'missing',
      confidence: 0,
      tip: 'Từ này bạn chưa đọc hoặc đã bỏ qua trong câu mẫu.',
    }))

    return {
      score: 0,
      accuracyScore: 0,
      confidenceScore: 0,
      isPassed: false,
      evaluatedWords,
      spokenWords: [],
      matchedCount: 0,
      totalTargetWords: rawTargetWords.length,
      recognizedText: '',
      feedback_vi: 'Chưa nghe rõ giọng của bạn. Hãy kiểm tra microphone và đọc to hơn nhé!',
      feedback_en: 'Could not hear your voice clearly. Please speak louder into the microphone.',
      suggestions: ['Nói to, rõ ràng và giữ khoảng cách micro khoảng 15–20cm.'],
    }
  }

  // Chuẩn bị mảng từ mà người dùng đã đọc (effectiveWords)
  const effectiveWords: AssemblyAIWord[] = hasRecognizedWords
    ? recognizedWords
    : recognizedText
        .trim()
        .split(/\s+/)
        .map((w, idx) => ({
          text: w,
          start: idx * 300,
          end: (idx + 1) * 300,
          confidence: 0.85,
        }))

  // Thực hiện so khớp từ vựng
  const alignment = alignWords(rawTargetWords, effectiveWords)

  const evaluatedWords: EvaluatedWord[] = []
  let matchedCount = 0
  let unclearCount = 0
  let mispronouncedCount = 0
  let missingCount = 0
  let extraCount = 0
  let totalConfidence = 0

  const suggestions: string[] = []

  for (const pair of alignment) {
    if (pair.targetIdx !== null) {
      const targetWord = rawTargetWords[pair.targetIdx]

      if (pair.heardIdx !== null) {
        const heardObj = effectiveWords[pair.heardIdx]
        const conf = heardObj.confidence ?? 0.8

        if (pair.isMatch) {
          if (conf >= 0.75) {
            // Khớp chuẩn xác và âm học tự tin (Xanh lá)
            evaluatedWords.push({
              targetWord,
              heardWord: heardObj.text,
              status: 'correct',
              confidence: conf,
              tip: 'Phát âm chuẩn xác ✓',
            })
            matchedCount++
            totalConfidence += conf
          } else if (conf >= 0.45) {
            // Khớp từ nhưng âm chưa thật tròn vành / Gần đúng (Vàng)
            evaluatedWords.push({
              targetWord,
              heardWord: heardObj.text,
              status: 'unclear',
              confidence: conf,
              tip: 'Phát âm gần đúng, cần nhấn âm rõ hơn một chút.',
            })
            unclearCount++
            matchedCount += 0.7
            totalConfidence += conf
            suggestions.push(`Cần phát âm rõ hơn từ "${targetWord}".`)
          } else {
            // Điểm confidence quá thấp / Đọc sai (Đỏ)
            evaluatedWords.push({
              targetWord,
              heardWord: heardObj.text,
              status: 'mispronounced',
              confidence: conf,
              tip: `Từ này nghe gần giống "${heardObj.text}". Hãy bật âm rõ hơn.`,
            })
            mispronouncedCount++
            suggestions.push(`Từ "${targetWord}" chưa chuẩn. Hãy nghe lại câu mẫu.`)
          }
        } else {
          // Bị nhận diện nhầm thành từ khác / Đọc sai (Đỏ)
          evaluatedWords.push({
            targetWord,
            heardWord: heardObj.text,
            status: 'mispronounced',
            confidence: conf,
            tip: `Hệ thống nghe thành "${heardObj.text}" thay vì "${targetWord}".`,
          })
          mispronouncedCount++
          suggestions.push(`Đọc nhầm "${targetWord}" thành "${heardObj.text}".`)
        }
      } else {
        // Chưa đọc hoặc bỏ qua từ trong câu mẫu (Xám / Tối màu)
        evaluatedWords.push({
          targetWord,
          status: 'missing',
          confidence: 0,
          tip: `Từ này bạn chưa đọc hoặc đã bỏ qua trong câu mẫu.`,
        })
        missingCount++
        suggestions.push(`Bỏ sót từ "${targetWord}". Hãy đọc trọn vẹn câu.`)
      }
    } else if (pair.heardIdx !== null) {
      // Đọc thừa từ bên ngoài (Gạch đỏ)
      const extraObj = effectiveWords[pair.heardIdx]
      evaluatedWords.push({
        targetWord: '',
        heardWord: extraObj.text,
        status: 'extra',
        confidence: extraObj.confidence ?? 0.5,
        tip: `Đọc thêm từ ngoài không có trong câu mẫu: "${extraObj.text}".`,
      })
      extraCount++
    }
  }

  // Xây dựng chuỗi các từ thực tế người dùng đã đọc (spokenWords), đánh dấu từ thừa (isExtra: true để gạch đỏ)
  const heardAlignmentMap = new Map<number, { targetIdx: number | null; isMatch: boolean }>()
  for (const pair of alignment) {
    if (pair.heardIdx !== null) {
      heardAlignmentMap.set(pair.heardIdx, { targetIdx: pair.targetIdx, isMatch: pair.isMatch })
    }
  }

  const spokenWords: SpokenWord[] = []
  for (let j = 0; j < effectiveWords.length; j++) {
    const heardObj = effectiveWords[j]
    const conf = heardObj.confidence ?? 0.8
    const alignInfo = heardAlignmentMap.get(j)

    if (!alignInfo || alignInfo.targetIdx === null) {
      // Từ này là TỪ ĐỌC THỪA (không có trong câu mẫu) -> isExtra: true (GẠCH ĐỎ)
      spokenWords.push({
        text: heardObj.text,
        isExtra: true,
        status: 'extra',
        confidence: conf,
        tip: `Từ đọc thừa không có trong câu mẫu: "${heardObj.text}" (Đã gạch đỏ).`,
      })
    } else {
      const targetWord = rawTargetWords[alignInfo.targetIdx]
      let wordStatus: WordPronunciationStatus = 'mispronounced'
      let wordTip = `Phát âm chưa chuẩn (nghe thành "${heardObj.text}" thay vì "${targetWord}").`

      if (alignInfo.isMatch) {
        if (conf >= 0.75) {
          wordStatus = 'correct'
          wordTip = 'Phát âm chuẩn xác ✓'
        } else if (conf >= 0.45) {
          wordStatus = 'unclear'
          wordTip = 'Phát âm gần đúng, cần nhấn âm rõ hơn một chút.'
        } else {
          wordStatus = 'mispronounced'
          wordTip = `Từ này nghe gần giống "${heardObj.text}". Hãy bật âm rõ hơn.`
        }
      }

      spokenWords.push({
        text: heardObj.text,
        isExtra: false,
        status: wordStatus,
        confidence: conf,
        matchedTargetWord: targetWord,
        tip: wordTip,
      })
    }
  }

  const N = rawTargetWords.length

  // Phân tích tiêu chí chấm điểm (nếu có)
  const normCriteria = (scoringCriteria || '').toLowerCase()
  const isLenient = normCriteria.includes('dễ') || normCriteria.includes('lenient') || normCriteria.includes('khuyến khích')
  const checkEndingSounds = normCriteria.includes('âm đuôi') || normCriteria.includes('ending') || normCriteria.includes('final')

  // Trọng số phạt nghiêm ngặt (Strict grading):
  // - Từ đọc sai (mispronounced): Phạt 0.7 (nếu đọc sai từ thì trừ 70% giá trị từ đó)
  // - Từ bỏ sót (missing): Phạt 0.85 (bỏ sót từ là lỗi rất nặng)
  // - Từ đọc thừa (extra): Phạt 0.45 (đọc thêm từ ngoài vào câu bị trừ rõ rệt)
  const mispronouncedWeight = isLenient ? 0.45 : 0.7
  const missingWeight = isLenient ? 0.6 : 0.85
  const extraWeight = isLenient ? 0.25 : 0.45

  // 1. Điểm chính xác từ vựng (Word Accuracy Score)
  const accuracyRaw =
    ((matchedCount - mispronouncedWeight * mispronouncedCount - missingWeight * missingCount - extraWeight * extraCount) / N) * 100
  const accuracyScore = Math.max(0, Math.min(100, Math.round(accuracyRaw)))

  // 2. Điểm âm học (Acoustic Confidence Score)
  const validConfCount = matchedCount + unclearCount
  // Nếu không có từ nào đọc đúng hoặc gần đúng -> Confidence phải là 0, TUYỆT ĐỐI KHÔNG cho điểm khống!
  const avgConfidence = validConfCount > 0 ? totalConfidence / validConfCount : 0
  const confidenceScore = Math.max(0, Math.min(100, Math.round(avgConfidence * 100)))

  // 3. Tổng điểm cuối cùng (Thang 100)
  // NGUYÊN TẮC SƯ PHẠM BẢO TOÀN ĐỘ CHÍNH XÁC:
  // Độ tin cậy âm học (confidence) CHỈ dùng để nhân hệ số cho các từ ĐỌC ĐÚNG.
  // TUYỆT ĐỐI KHÔNG được cộng dồn điểm âm học để kéo điểm lên khi người dùng đọc sai từ vựng!
  let finalScore = 0
  if (accuracyScore > 0 && validConfCount > 0) {
    const confFactor = Math.min(1.0, Math.max(0.4, avgConfidence))
    finalScore = Math.round(accuracyScore * (0.65 + 0.35 * confFactor))
  }
  finalScore = Math.max(0, Math.min(100, finalScore))

  // 4. TIÊU CHÍ TIÊN QUYẾT ĐỂ QUA BÀI (STRICT GATEKEEPING):
  // Người dùng đọc sai thành câu khác hoặc bỏ sót nhiều từ TUYỆT ĐỐI KHÔNG ĐƯỢC ĐẠT!
  const matchedRatio = matchedCount / N
  const hasEnoughMatchedWords = matchedRatio >= 0.7 // Phải đọc đúng ít nhất 70% số từ trong câu mẫu
  const notTooManyMispronounced = mispronouncedCount <= Math.max(1, Math.floor(N * 0.25)) // Không sai quá 25% từ
  const notTooManyMissing = missingCount <= Math.max(1, Math.floor(N * 0.25)) // Không bỏ sót quá 25% từ
  const notTooManyExtra = extraCount <= Math.max(1, Math.floor(N * 0.35)) // Không đọc thừa quá 35% từ ngoài

  const isPassed =
    finalScore >= passScore &&
    hasEnoughMatchedWords &&
    notTooManyMispronounced &&
    notTooManyMissing &&
    notTooManyExtra

  // Lời nhận xét sư phạm rõ ràng
  let feedback_vi = ''
  let feedback_en = ''

  if (checkEndingSounds && mispronouncedCount > 0) {
    suggestions.unshift('Lưu ý phát âm rõ âm đuôi (/s/, /z/, /ed/, /t/) theo tiêu chí chấm bài.')
  }

  if (!hasEnoughMatchedWords || matchedCount === 0) {
    feedback_vi = 'Bạn đã đọc sai hoặc nhầm sang một câu khác. Vui lòng nhìn kỹ câu mẫu và đọc lại đúng từng từ nhé!'
    feedback_en = 'You read a completely different sentence or missed most target words. Please look at the model and read again!'
  } else if (!notTooManyMissing) {
    feedback_vi = 'Bạn đã bỏ sót nhiều từ quan trọng trong câu mẫu. Hãy đọc trọn vẹn đầy đủ cả câu nhé!'
    feedback_en = 'You missed several target words. Please read the entire sentence!'
  } else if (!notTooManyExtra) {
    feedback_vi = 'Bạn đã đọc thừa nhiều từ không có trong câu mẫu. Hãy chỉ đọc đúng nội dung câu cho trước nhé!'
    feedback_en = 'You added too many extra words. Please stick to the target sentence!'
  } else if (finalScore >= 90 && isPassed) {
    feedback_vi = 'Xuất sắc! Bạn phát âm rất rõ ràng, tự tin và đáp ứng tốt tiêu chí bài đọc.'
    feedback_en = 'Excellent! Clear pronunciation, natural rhythm and confident delivery.'
  } else if (isPassed) {
    feedback_vi = 'Rất tốt! Bạn đã đọc đúng hầu hết các câu chữ, nghe tự nhiên và đạt yêu cầu.'
    feedback_en = 'Great job! Your reading was understandable and accurate.'
  } else if (finalScore >= 60) {
    feedback_vi = 'Khá tốt! Nhưng còn một vài từ bị bỏ sót hoặc phát âm chưa chuẩn. Hãy thử đọc lại nhé!'
    feedback_en = 'Good effort! A few words were missed or unclear. Try reading once more!'
  } else {
    feedback_vi = 'Cần luyện tập thêm! Hãy bấm nghe mẫu trước, sau đó phát âm từng từ thật rõ nhé.'
    feedback_en = 'More practice needed! Listen to the audio model, then speak clearly into the mic.'
  }

  return {
    score: finalScore,
    accuracyScore,
    confidenceScore,
    isPassed,
    evaluatedWords,
    spokenWords,
    matchedCount: Math.round(matchedCount),
    totalTargetWords: N,
    recognizedText: recognizedText.trim(),
    feedback_vi,
    feedback_en,
    suggestions: suggestions.slice(0, 3), // Lấy tối đa 3 góp ý quan trọng nhất
  }
}
