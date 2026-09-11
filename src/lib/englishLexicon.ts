/**
 * Bộ kiểm tra từ điển tiếng Anh và phát hiện chữ viết dính liền (Concatenated Words & Spelling Detector)
 * Dành cho đối tượng học sinh tiểu học & THCS (CEFR A1 - B2)
 */

// Danh sách từ vựng tiếng Anh thông dụng
export const COMMON_ENGLISH_WORDS = new Set<string>([
  // Đại từ (Pronouns)
  'i', 'me', 'my', 'mine', 'myself',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those',
  'who', 'whom', 'whose', 'which', 'what', 'where', 'when', 'why', 'how',
  'everyone', 'everybody', 'everything', 'someone', 'somebody', 'something',
  'anyone', 'anybody', 'anything', 'no one', 'nobody', 'nothing',

  // Mạo từ & Giới từ (Articles & Prepositions)
  'a', 'an', 'the',
  'in', 'on', 'at', 'to', 'for', 'with', 'from', 'of', 'about', 'by',
  'under', 'behind', 'near', 'next', 'into', 'over', 'out', 'up', 'down',
  'between', 'among', 'through', 'before', 'after', 'during', 'without', 'against',

  // Liên từ & Trạng từ (Conjunctions & Adverbs)
  'and', 'but', 'or', 'so', 'because', 'if', 'when', 'while', 'although', 'though',
  'also', 'too', 'either', 'neither', 'very', 'quite', 'really', 'so', 'such',
  'always', 'usually', 'often', 'sometimes', 'rarely', 'seldom', 'never',
  'now', 'then', 'here', 'there', 'today', 'yesterday', 'tomorrow', 'tonight',
  'every', 'all', 'some', 'any', 'many', 'much', 'more', 'most', 'only', 'just',
  'well', 'fast', 'hard', 'early', 'late', 'together', 'again', 'already', 'still',

  // Số đếm & Số thứ tự (Numbers & Ordinals)
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',

  // Động từ to be & Trợ động từ & Khiếm khuyết
  'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'done', 'doing',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',

  // Động từ hành động & Cảm xúc thông dụng (Action & State Verbs)
  'feel', 'feels', 'felt', 'feeling',
  'look', 'looks', 'looked', 'looking',
  'sound', 'sounds', 'sounded', 'sounding',
  'smell', 'smells', 'smelled', 'smelling',
  'taste', 'tastes', 'tasted', 'tasting',
  'like', 'likes', 'liked', 'liking',
  'love', 'loves', 'loved', 'loving',
  'hate', 'hates', 'hated', 'hating',
  'enjoy', 'enjoys', 'enjoyed', 'enjoying',
  'want', 'wants', 'wanted', 'wanting',
  'need', 'needs', 'needed', 'needing',
  'hope', 'hopes', 'hoped', 'hoping',
  'wish', 'wishes', 'wished', 'wishing',
  'play', 'plays', 'played', 'playing',
  'go', 'goes', 'went', 'gone', 'going',
  'come', 'comes', 'came', 'coming',
  'see', 'sees', 'saw', 'seen', 'seeing',
  'watch', 'watches', 'watched', 'watching',
  'listen', 'listens', 'listened', 'listening',
  'hear', 'hears', 'heard', 'hearing',
  'speak', 'speaks', 'spoke', 'spoken', 'speaking',
  'talk', 'talks', 'talked', 'talking',
  'say', 'says', 'said', 'saying',
  'tell', 'tells', 'told', 'telling',
  'ask', 'asks', 'asked', 'asking',
  'answer', 'answers', 'answered', 'answering',
  'read', 'reads', 'reading',
  'write', 'writes', 'wrote', 'written', 'writing',
  'draw', 'draws', 'drew', 'drawn', 'drawing',
  'paint', 'paints', 'painted', 'painting',
  'sing', 'sings', 'sang', 'sung', 'singing',
  'dance', 'dances', 'danced', 'dancing',
  'swim', 'swims', 'swam', 'swum', 'swimming',
  'run', 'runs', 'ran', 'run', 'running',
  'walk', 'walks', 'walked', 'walking',
  'jump', 'jumps', 'jumped', 'jumping',
  'ride', 'rides', 'rode', 'ridden', 'riding',
  'drive', 'drives', 'drove', 'driven', 'driving',
  'fly', 'flies', 'flew', 'flown', 'flying',
  'study', 'studies', 'studied', 'studying',
  'learn', 'learns', 'learned', 'learning',
  'teach', 'teaches', 'taught', 'teaching',
  'help', 'helps', 'helped', 'helping',
  'make', 'makes', 'made', 'making',
  'take', 'takes', 'took', 'taken', 'taking',
  'give', 'gives', 'gave', 'given', 'giving',
  'get', 'gets', 'got', 'gotten', 'getting',
  'put', 'puts', 'putting',
  'keep', 'keeps', 'kept', 'keeping',
  'bring', 'brings', 'brought', 'bringing',
  'buy', 'buys', 'bought', 'buying',
  'sell', 'sells', 'sold', 'selling',
  'eat', 'eats', 'ate', 'eaten', 'eating',
  'drink', 'drinks', 'drank', 'drunk', 'drinking',
  'cook', 'cooks', 'cooked', 'cooking',
  'sleep', 'sleeps', 'slept', 'sleeping',
  'wake', 'wakes', 'woke', 'waking',
  'live', 'lives', 'lived', 'living',
  'stay', 'stays', 'stayed', 'staying',
  'work', 'works', 'worked', 'working',
  'open', 'opens', 'opened', 'opening',
  'close', 'closes', 'closed', 'closing',
  'start', 'starts', 'started', 'starting',
  'finish', 'finishes', 'finished', 'finishing',
  'stop', 'stops', 'stopped', 'stopping',
  'clean', 'cleans', 'cleaned', 'cleaning',
  'wash', 'washes', 'washed', 'washing',
  'wear', 'wears', 'wore', 'worn', 'wearing',
  'use', 'uses', 'used', 'using',
  'find', 'finds', 'found', 'finding',
  'lose', 'loses', 'lost', 'losing',
  'remember', 'remembers', 'remembered', 'remembering',
  'forget', 'forgets', 'forgot', 'forgetting',
  'think', 'thinks', 'thought', 'thinking',
  'know', 'knows', 'knew', 'known', 'knowing',
  'understand', 'understands', 'understood', 'understanding',
  'meet', 'meets', 'met', 'meeting',
  'visit', 'visits', 'visited', 'visiting',
  'travel', 'travels', 'traveled', 'traveling',

  // Trường học & Đồ dùng học tập (School & Stationery)
  'school', 'schools', 'class', 'classes', 'classroom', 'classrooms',
  'teacher', 'teachers', 'student', 'students', 'pupil', 'pupils',
  'friend', 'friends', 'classmate', 'classmates',
  'pen', 'pens', 'pencil', 'pencils', 'ruler', 'rulers', 'eraser', 'erasers', 'rubber', 'rubbers',
  'sharpener', 'sharpeners', 'case', 'cases', 'pencilcase',
  'book', 'books', 'notebook', 'notebooks', 'paper', 'papers',
  'bag', 'bags', 'schoolbag', 'schoolbags', 'backpack', 'backpacks',
  'desk', 'desks', 'table', 'tables', 'chair', 'chairs', 'board', 'boards',
  'blackboard', 'whiteboard', 'crayon', 'crayons', 'marker', 'markers',
  'scissors', 'glue', 'calculator', 'compass', 'clock', 'uniform', 'uniforms',
  'lesson', 'lessons', 'homework', 'exercise', 'exercises', 'test', 'tests', 'exam', 'exams',
  'subject', 'subjects', 'grade', 'grades', 'mark', 'marks',
  'math', 'maths', 'science', 'english', 'art', 'music', 'history', 'geography', 'physics', 'chemistry', 'biology', 'pe',
  'library', 'libraries', 'yard', 'playground', 'gym', 'canteen', 'lab', 'laboratory',

  // Thời gian & Lịch trình (Time & Calendar)
  'time', 'times', 'minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years',
  'morning', 'mornings', 'afternoon', 'afternoons', 'evening', 'evenings', 'night', 'nights',
  'noon', 'midnight', 'weekend', 'weekends',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'spring', 'summer', 'autumn', 'fall', 'winter',

  // Tính từ mô tả & Cảm xúc (Adjectives & Feelings)
  'good', 'great', 'fine', 'nice', 'bad', 'terrible', 'awful',
  'big', 'small', 'large', 'little', 'huge', 'tiny', 'short', 'tall', 'long',
  'happy', 'sad', 'excited', 'tired', 'bored', 'busy', 'hungry', 'thirsty', 'ready',
  'angry', 'scared', 'afraid', 'proud', 'nervous', 'lucky',
  'beautiful', 'pretty', 'handsome', 'cute', 'ugly',
  'clean', 'dirty', 'neat', 'messy',
  'easy', 'hard', 'difficult', 'simple',
  'interesting', 'boring', 'funny', 'fun',
  'hot', 'cold', 'warm', 'cool', 'sunny', 'rainy', 'windy', 'cloudy', 'snowy',
  'fast', 'slow', 'quick', 'loud', 'quiet',
  'new', 'old', 'young', 'rich', 'poor',
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'pink', 'purple', 'brown', 'gray', 'grey',

  // Gia đình & Con người (Family & People)
  'family', 'families', 'father', 'mother', 'parent', 'parents', 'dad', 'mom',
  'brother', 'brothers', 'sister', 'sisters', 'sibling', 'siblings',
  'grandfather', 'grandmother', 'grandparent', 'grandparents', 'grandpa', 'grandma',
  'uncle', 'aunt', 'cousin', 'cousins', 'son', 'daughter', 'baby', 'babies',
  'child', 'children', 'kid', 'kids', 'boy', 'boys', 'girl', 'girls', 'man', 'men', 'woman', 'women', 'person', 'people',

  // Nơi chốn & Nhà cửa (Places & Home)
  'home', 'house', 'houses', 'room', 'rooms', 'bedroom', 'living room', 'kitchen', 'bathroom',
  'door', 'doors', 'window', 'windows', 'floor', 'wall', 'garden',
  'city', 'cities', 'town', 'village', 'country', 'countries', 'park', 'street', 'road',
  'store', 'shop', 'market', 'supermarket', 'hospital', 'cinema', 'restaurant', 'bank',

  // Thể thao & Hoạt động (Sports & Activities)
  'game', 'games', 'sport', 'sports', 'football', 'soccer', 'badminton', 'basketball', 'volleyball', 'tennis',
  'swimming', 'running', 'cycling', 'table tennis', 'chess', 'music', 'song', 'movie', 'film', 'photo', 'picture',

  // Thức ăn & Đồ uống (Food & Drinks)
  'food', 'rice', 'bread', 'meat', 'chicken', 'fish', 'egg', 'eggs', 'noodle', 'noodles',
  'water', 'milk', 'tea', 'coffee', 'juice', 'apple', 'banana', 'orange', 'pizza', 'cake',
])

// Tên riêng tiếng Việt hợp lệ được chấp nhận trong bài làm
export const ACCEPTABLE_PROPER_NOUNS = new Set<string>([
  'tran', 'quoc', 'nguyen', 'du', 'le', 'loi', 'minh', 'khai', 'ha', 'noi',
  'da', 'nang', 'hue', 'saigon', 'viet', 'nam', 'vietnam', 'ho', 'chi',
  'quang', 'trung', 'phan', 'chu', 'trinh', 'vo', 'thi', 'sau', 'kim', 'dong',
  'an', 'binh', 'chi', 'dung', 'giang', 'hoa', 'hung', 'khanh', 'linh', 'mai',
  'nam', 'nga', 'phuong', 'quan', 'son', 'thao', 'tuan', 'viet', 'yen',
])

/**
 * Kiểm tra xem một từ đơn có phải là từ tiếng Anh hợp lệ hoặc tên riêng được chấp nhận không
 */
export function isKnownWord(word: string): boolean {
  const w = word.toLowerCase().trim()
  if (!w) return true

  // Kiểm tra trực tiếp trong danh mục từ điển hoặc tên riêng
  if (COMMON_ENGLISH_WORDS.has(w) || ACCEPTABLE_PROPER_NOUNS.has(w)) return true

  // Kiểm tra các biến thể đuôi thông dụng:
  // 1. Số nhiều và ngôi thứ 3 số ít (-s, -es)
  if (w.endsWith('s') && COMMON_ENGLISH_WORDS.has(w.slice(0, -1))) return true
  if (w.endsWith('es') && COMMON_ENGLISH_WORDS.has(w.slice(0, -2))) return true
  if (w.endsWith('ies') && COMMON_ENGLISH_WORDS.has(w.slice(0, -3) + 'y')) return true

  // 2. Quá khứ / Phân từ (-ed)
  if (w.endsWith('ed') && COMMON_ENGLISH_WORDS.has(w.slice(0, -1))) return true
  if (w.endsWith('ed') && COMMON_ENGLISH_WORDS.has(w.slice(0, -2))) return true
  if (w.endsWith('ied') && COMMON_ENGLISH_WORDS.has(w.slice(0, -3) + 'y')) return true

  // 3. Tiếp diễn (-ing)
  if (w.endsWith('ing') && COMMON_ENGLISH_WORDS.has(w.slice(0, -3))) return true
  if (w.endsWith('ing') && COMMON_ENGLISH_WORDS.has(w.slice(0, -3) + 'e')) return true
  if (w.endsWith('ing') && w.length > 5 && COMMON_ENGLISH_WORDS.has(w.slice(0, -4))) return true

  // 4. Trạng từ (-ly)
  if (w.endsWith('ly') && COMMON_ENGLISH_WORDS.has(w.slice(0, -2))) return true

  // 5. So sánh hơn / hơn nhất (-er, -est)
  if (w.endsWith('er') && COMMON_ENGLISH_WORDS.has(w.slice(0, -2))) return true
  if (w.endsWith('est') && COMMON_ENGLISH_WORDS.has(w.slice(0, -3))) return true

  return false
}

export interface LexiconCheckResult {
  hasError: boolean
  errorType: 'none' | 'concatenated' | 'concatenated_typo' | 'spelling' | 'plural_agreement'
  token?: string
  feedback_vi?: string
  feedback_en?: string
  suggestion?: string
}

/**
 * Phân tích một từ xem có phải là từ viết dính liền không có dấu cách hoặc dính chữ bị lỗi gõ nhầm không
 */
export function checkConcatenatedToken(token: string): LexiconCheckResult {
  const clean = token.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean || clean.length <= 1 || /^\d+$/.test(clean)) {
    return { hasError: false, errorType: 'none' }
  }

  // Nếu từ này đã có trong từ điển -> hợp lệ
  if (isKnownWord(clean)) {
    return { hasError: false, errorType: 'none' }
  }

  // 1. Kiểm tra dính liền 2 từ hoàn chỉnh không có dấu cách (e.g. fourpen, myschool, inmy, havefour, gotoschool)
  for (let i = 2; i <= clean.length - 2; i++) {
    const part1 = clean.slice(0, i)
    const part2 = clean.slice(i)
    if (isKnownWord(part1) && isKnownWord(part2)) {
      return {
        hasError: true,
        errorType: 'concatenated',
        token,
        feedback_vi: `Từ "${token}" bị viết dính liền 2 từ mà thiếu dấu cách ("${part1}" và "${part2}"). Em hãy viết tách rời: "${part1} ${part2}".`,
        feedback_en: `The word "${token}" is written together without a space. Please separate into "${part1} ${part2}".`,
        suggestion: `${part1} ${part2}`,
      }
    }
  }

  // 2. Kiểm tra dính liền 2 từ nhưng có kèm ký tự thừa/gõ nhầm ở giữa (e.g. fourlpen -> four + l + pen)
  for (let i = 2; i <= clean.length - 3; i++) {
    for (let j = i + 1; j <= clean.length - 2; j++) {
      const part1 = clean.slice(0, i)
      const middle = clean.slice(i, j)
      const part2 = clean.slice(j)
      if (isKnownWord(part1) && isKnownWord(part2) && middle.length <= 2) {
        // Gợi ý danh từ số nhiều nếu sau số đếm
        const isPluralCandidate = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'many'].includes(part1)
        const adjustedPart2 = isPluralCandidate && !part2.endsWith('s') ? `${part2}s` : part2
        return {
          hasError: true,
          errorType: 'concatenated_typo',
          token,
          feedback_vi: `Từ "${token}" bị viết dính chữ và thừa ký tự "${middle}". Em hãy tách dấu cách và viết lại thành "${part1} ${adjustedPart2}" nhé.`,
          feedback_en: `The word "${token}" has concatenated words with an extra letter "${middle}". Write "${part1} ${adjustedPart2}" instead.`,
          suggestion: `${part1} ${adjustedPart2}`,
        }
      }
    }
  }

  // 3. Từ không xác định trong từ điển tiếng Anh (Spelling Error)
  return {
    hasError: true,
    errorType: 'spelling',
    token,
    feedback_vi: `Từ "${token}" không phải là từ tiếng Anh hợp lệ hoặc bị viết sai chính tả. Em hãy kiểm tra và viết lại từ này nhé!`,
    feedback_en: `The word "${token}" is not a recognized English word or is misspelled. Please check your spelling.`,
  }
}

/**
 * Quét toàn bộ câu để phát hiện lỗi viết dính chữ, sai từ vựng, hoặc lỗi hòa hợp số đếm + danh từ số ít
 */
export function checkSentenceLexicon(sentence: string): LexiconCheckResult {
  const trimmed = sentence.trim()
  if (!trimmed) return { hasError: false, errorType: 'none' }

  // 1. Kiểm tra hòa hợp số đếm + danh từ số ít (e.g. four pen, two pen, three book)
  const numberCountableMatch = trimmed.match(
    /\b(two|three|four|five|six|seven|eight|nine|ten|many|several|a few)\s+(pen|pencil|ruler|eraser|rubber|sharpener|case|book|notebook|bag|schoolbag|backpack|desk|table|chair|student|teacher|friend|classmate|room|class|boy|girl)\b/i,
  )
  if (numberCountableMatch) {
    const numWord = numberCountableMatch[1]
    const singularNoun = numberCountableMatch[2]
    const pluralNoun = singularNoun.endsWith('s') ? `${singularNoun}es` : `${singularNoun}s`
    return {
      hasError: true,
      errorType: 'plural_agreement',
      token: `${numWord} ${singularNoun}`,
      feedback_vi: `Sau số đếm "${numWord}", danh từ "${singularNoun}" phải ở dạng số nhiều là "${numWord} ${pluralNoun}". Em hãy thêm "-s" nhé!`,
      feedback_en: `After "${numWord}", use the plural noun "${pluralNoun}". For example: "${numWord} ${pluralNoun}".`,
      suggestion: `${numWord} ${pluralNoun}`,
    }
  }

  // 2. Tách từng từ trong câu để kiểm tra từ điển và dính chữ
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  for (const rawToken of tokens) {
    const clean = rawToken.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    if (!clean || clean.length <= 1 || /^\d+$/.test(clean)) continue

    const check = checkConcatenatedToken(clean)
    if (check.hasError) {
      return check
    }
  }

  return { hasError: false, errorType: 'none' }
}
