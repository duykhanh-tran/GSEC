export interface SentenceCheckItem {
  type: string
  first: string
  correct: boolean
  cue: string
  fixed: string
  model: string
}

export const SENTENCE_CHECK_ITEMS: readonly SentenceCheckItem[] = [
  { type: 'Statement', first: 'Our school has a large playground.', correct: true, cue: 'Check the basic statement order: subject → verb → object/complement.', fixed: 'Our school has a large playground.', model: 'Our school has a large playground.' },
  { type: 'Negative', first: 'We not have classes on Sunday.', correct: false, cue: 'For a present-simple negative with “we”, use do not + base verb.', fixed: 'We do not have classes on Sunday.', model: 'We do not have classes on Sunday.' },
  { type: 'Yes/No Question', first: 'Does your school have a computer room?', correct: true, cue: 'A present-simple yes/no question starts with Does, then subject, then base verb.', fixed: 'Does your school have a computer room?', model: 'Does your school have a computer room?' },
  { type: 'Frequency Position', first: 'I do my homework usually after school.', correct: false, cue: 'The frequency word usually goes before the main verb.', fixed: 'I usually do my homework after school.', model: 'I usually do my homework after school.' },
  { type: 'Wh-question', first: 'What do students do at break time?', correct: true, cue: 'Use: question word → do → subject → base verb.', fixed: 'What do students do at break time?', model: 'What do students do at break time?' },
]
