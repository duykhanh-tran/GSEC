import type { ListeningChoiceTaskConfig } from '../../components/assessment/ListeningChoiceTask'

export const EMILY_SCHOOL_TALK = `Hello. My name's Emily. I'm eleven, and I'm in Year 6 at Riverdale School in Australia. My school is small, but I like it very much. The teachers are kind, and my classmates often help each other. Science is my favourite subject because we do exciting activities. I have English every day and Japanese twice a week. I usually have lunch in the school garden. We wear blue uniforms from Monday to Thursday. Today is Friday, so I'm in my sports clothes. This afternoon, my class has an art lesson at the city museum. After school, I play basketball with my friend Zoe.`

export const TASK_60161_CONFIG: ListeningChoiceTaskConfig = {
  className: 'task-60161',
  intro: <><strong>Task 1.</strong><br />Listen to Emily’s full talk first. Then complete the True/False statements in your worksheet.</>,
  entryTitle: 'Your answers', entrySubtitle: '5 items', entryNote: 'The statements stay in the worksheet. The app only records T/F and gives listening support when needed.',
  options: ['T', 'F'], demoAnswers: { 1: 'T', 2: 'T', 3: 'T', 4: 'F', 5: 'T' },
  items: [
    { id: 1, key: 'T', speechText: "I'm eleven, and I'm in Year 6 at Riverdale School in Australia.", firstHint: 'Replay the part where Emily says what year she is in.', secondHint: 'Year 6 and Grade 6 refer to the same school level.', retryTag: 'LISTEN-DETAIL', bookCue: <>Look at <strong>Item 1</strong> in your worksheet. The statement stays on the page.</>, summaryLabel: 'Item 1' },
    { id: 2, key: 'F', speechText: "I'm eleven, and I'm in Year 6 at Riverdale School in Australia.", firstHint: 'Replay the sentence where Emily says where Riverdale School is.', secondHint: 'Focus on the country name Emily says.', retryTag: 'LISTEN-DETAIL', bookCue: <>Look at <strong>Item 2</strong> in your worksheet. The statement stays on the page.</>, summaryLabel: 'Item 2' },
    { id: 3, key: 'F', speechText: 'I have English every day and Japanese twice a week.', firstHint: 'Replay the part about English and Japanese lessons.', secondHint: 'Which subject is twice a week?', retryTag: 'LISTEN-DETAIL', bookCue: <>Look at <strong>Item 3</strong> in your worksheet. The statement stays on the page.</>, summaryLabel: 'Item 3' },
    { id: 4, key: 'T', speechText: 'The teachers are kind, and my classmates often help each other.', firstHint: 'Replay the part about Emily’s classmates.', secondHint: '“help each other” means the same as “help one another.”', retryTag: 'LISTEN-DETAIL', bookCue: <>Look at <strong>Item 4</strong> in your worksheet. The statement stays on the page.</>, summaryLabel: 'Item 4' },
    { id: 5, key: 'T', speechText: 'After school, I play basketball with my friend Zoe.', firstHint: 'Replay the final sentence of Emily’s talk.', secondHint: 'Focus on what Emily does after school.', retryTag: 'LISTEN-DETAIL', bookCue: <>Look at <strong>Item 5</strong> in your worksheet. The statement stays on the page.</>, summaryLabel: 'Item 5' },
  ],
  playback: { title: 'Emily’s school', subtitle: 'Full audio', text: EMILY_SCHOOL_TALK, prompt: 'Listen to the full talk', statusText: 'Normal speed • one full play', note: 'Complete the T/F statements in your worksheet while you listen.', completedMessage: 'Now enter the T/F answers you wrote in your worksheet.', requiredMessage: 'Listen to the full audio first.', lang: 'en-AU', rate: 0.9 },
  incompleteMessage: 'Choose True or False for all 5 items first.', itemSingular: 'Item', itemPlural: 'Items', retryDataAttribute: 'question',
  resultsTitle: 'Task 1 check', summaryTitle: 'Task 1 complete ✓', summarySubtitle: 'Listening', evidenceTag: 'LISTEN-DETAIL',
  evidenceNote: <>Evidence stored as <strong>LISTEN-DETAIL</strong>. Transcript is not shown during supported retry; shown keys do not count as independent mastery.</>,
  footerIdle: 'Listen, then check 5 answers.', footerComplete: 'Continue to Task 2.', continueLabel: 'Back to book', completeIndependent: 'You completed all five items independently.', completeGuided: 'You finished the task. Guided items can be reviewed later.', backMessage: 'Keep going. Task 2 uses one full replay of the same talk.', maxAttempts: 3,
}
