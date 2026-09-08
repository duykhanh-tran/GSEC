export const PARAGRAPH_ORDER_KEY = [4, 2, 5, 1, 3] as const

export const PARAGRAPH_LINK_HINTS: Readonly<Record<number, { first: string; second: string }>> = {
  1: { first: 'Sentence 4 introduces the school. Which sentence can refer back to the school with “It”?', second: 'Look for the sentence that continues from the school introduction and gives a school facility.' },
  2: { first: 'Now follow the new noun in that sentence.', second: 'The previous sentence introduces the playground. Which sentence refers to that place directly?' },
  3: { first: 'Look for the sentence that uses “there”.', second: '“There” should refer to the playground that has just been mentioned.' },
  4: { first: 'The last sentence should connect to the activity just mentioned.', second: 'Look for the sentence that uses “This activity” to refer back to playing badminton.' },
}
