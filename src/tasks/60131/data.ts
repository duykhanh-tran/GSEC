export type GrammarTag = 'FORM-AGREEMENT' | 'FORM-AUXILIARY'

export interface GrammarItem {
  prompt: string
  key: readonly string[]
  tag: GrammarTag
  h1: string
  h2: string
  rule: string
}

export const GRAMMAR_ITEMS: Record<number, GrammarItem> = {
  1: { prompt: 'I ___ (live) near Minh Khai Secondary School.', key: ['live'], tag: 'FORM-AGREEMENT', h1: 'Look at the subject: I.', h2: 'With I / you / we / they, use the base verb.', rule: 'I / you / we / they + base verb.' },
  2: { prompt: 'My brother ___ (go) to school by bus.', key: ['goes'], tag: 'FORM-AGREEMENT', h1: 'My brother means he.', h2: 'With he / she / it, the verb takes -s or -es.', rule: 'he / she / it + verb-s/-es.' },
  3: { prompt: 'We ___ (have) science on Monday.', key: ['have'], tag: 'FORM-AGREEMENT', h1: 'Look at the subject: We.', h2: 'With I / you / we / they, use the base verb.', rule: 'I / you / we / they + base verb.' },
  4: { prompt: 'Our first lesson ___ (start) at 7 a.m.', key: ['starts'], tag: 'FORM-AGREEMENT', h1: 'Our first lesson means it.', h2: 'With he / she / it, add -s or -es.', rule: 'he / she / it + verb-s/-es.' },
  5: { prompt: 'I ___ (not study) art on Tuesday.', key: ["don't study"], tag: 'FORM-AUXILIARY', h1: 'This is a negative sentence with I.', h2: "Use don't + the base verb.", rule: "I / you / we / they → don't + base verb." },
  6: { prompt: 'Nam ___ (not play) football at break time.', key: ["doesn't play"], tag: 'FORM-AUXILIARY', h1: 'Nam means he.', h2: "Use doesn't, and keep the next verb in the base form.", rule: "he / she / it → doesn't + base verb." },
  7: { prompt: '___ you ___ (wear) a uniform every day?', key: ['Do', 'wear'], tag: 'FORM-AUXILIARY', h1: 'The subject is you.', h2: 'Questions with you use Do + subject + base verb.', rule: 'Do + I / you / we / they + base verb?' },
  8: { prompt: '___ Mai ___ (like) her new classroom?', key: ['Does', 'like'], tag: 'FORM-AUXILIARY', h1: 'Mai means she.', h2: 'Use Does, then keep like in the base form.', rule: 'Does + he / she / it + base verb?' },
}

export const ITEM_IDS = Object.keys(GRAMMAR_ITEMS).map(Number)
export type Answers = Record<number, string[]>
export const EMPTY_ANSWERS: Answers = Object.fromEntries(ITEM_IDS.map((id) => [id, GRAMMAR_ITEMS[id].key.map(() => '')]))
export const DEMO_ANSWERS: Answers = { 1: ['live'], 2: ['go'], 3: ['have'], 4: ['starts'], 5: ["don't study"], 6: ["doesn't play"], 7: ['Do', 'wear'], 8: ['Does', 'likes'] }

export function normalizeAnswer(value: string) {
  return value.trim().replace(/[’]/g, "'").replace(/\s+/g, ' ').toLowerCase()
}

export function itemIsCorrect(answers: Answers, id: number) {
  return GRAMMAR_ITEMS[id].key.every((value, part) => normalizeAnswer(answers[id][part]) === normalizeAnswer(value))
}

export const TRANSFER_ITEMS: Record<GrammarTag, { text: string; options: readonly string[]; key: string }> = {
  'FORM-AGREEMENT': { text: 'My sister ___ to school at 7 a.m.', options: ['go', 'goes', 'going'], key: 'goes' },
  'FORM-AUXILIARY': { text: '___ Tom ___ chess after school?', options: ['Do / plays', 'Does / play', 'Does / plays'], key: 'Does / play' },
}
