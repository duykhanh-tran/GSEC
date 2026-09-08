import type { ListeningChoiceTaskConfig } from '../../components/assessment/ListeningChoiceTask'
import { EMILY_SCHOOL_TALK } from '../60161/data'

export const TASK_60162_CONFIG: ListeningChoiceTaskConfig = {
  className: 'task-60162',
  intro: <><strong>Task 2.</strong><br />Listen to Emily’s full talk one more time. Then check your A/B/C answers from the worksheet.</>,
  entryTitle: 'Your answers', entrySubtitle: '5 questions', entryNote: 'The questions and choices stay in the worksheet. The app only records A/B/C and gives listening support when needed.',
  options: ['A', 'B', 'C'], demoAnswers: { 1: 'B', 2: 'A', 3: 'C', 4: 'A', 5: 'C' },
  items: [
    { id: 1, key: 'B', speechText: "Hello. My name's Emily. I'm eleven, and I'm in Year 6 at Riverdale School in Australia.", firstHint: 'Replay the beginning of Emily’s talk.', secondHint: 'Focus on the number Emily says for her age.', retryTag: 'M1', bookCue: <>Look at <strong>Question 1</strong> and its A/B/C options in your worksheet.</>, summaryLabel: 'Question 1' },
    { id: 2, key: 'C', speechText: 'I usually have lunch in the school garden.', firstHint: 'Replay the part where Emily talks about lunch.', secondHint: 'Focus on the place after “I usually have lunch in …”.', retryTag: 'M1', bookCue: <>Look at <strong>Question 2</strong> and its A/B/C options in your worksheet.</>, summaryLabel: 'Question 2' },
    { id: 3, key: 'A', speechText: 'Science is my favourite subject because we do exciting activities.', firstHint: 'Replay the sentence about Emily’s favourite subject.', secondHint: 'Listen for the reason after “because”.', retryTag: 'M2', bookCue: <>Look at <strong>Question 3</strong> and its A/B/C options in your worksheet.</>, summaryLabel: 'Question 3' },
    { id: 4, key: 'B', speechText: "We wear blue uniforms from Monday to Thursday. Today is Friday, so I'm in my sports clothes. This afternoon, my class has an art lesson at the city museum.", firstHint: 'Replay the Friday part carefully.', secondHint: 'Check the three linked details: uniform, today’s clothes, and the art lesson.', retryTag: 'M3', bookCue: <>Look at <strong>Question 4</strong> and its A/B/C options in your worksheet.</>, summaryLabel: 'Question 4' },
    { id: 5, key: 'A', speechText: EMILY_SCHOOL_TALK, firstHint: 'Think about Emily’s whole talk, not one detail.', secondHint: 'Most of the talk is about her school, subjects, lunch, clothes and activities.', retryTag: 'M2', bookCue: <>Look at <strong>Question 5</strong> and its A/B/C options in your worksheet.</>, summaryLabel: 'Question 5' },
  ],
  playback: { title: 'Emily’s school', subtitle: 'Full replay', text: EMILY_SCHOOL_TALK, prompt: 'Listen to the complete talk again', statusText: 'Normal speed • one full replay', note: 'Use the questions in your worksheet while you listen.', completedMessage: 'Now enter the A/B/C answers you chose in your worksheet.', requiredMessage: 'Listen to the full replay first.', lang: 'en-AU', rate: 0.9 },
  incompleteMessage: 'Choose all 5 answers first.', itemSingular: 'Question', itemPlural: 'Questions', retryDataAttribute: 'question',
  resultsTitle: 'Task 2 check', summaryTitle: 'Task 2 complete ✓', summarySubtitle: 'Listening', evidenceTag: 'LISTEN-DETAIL',
  evidenceNote: <>Questions 1–4 contribute to <strong>LISTEN-DETAIL</strong>. Question 5 also contributes to <strong>LISTEN-MAIN-IDEA</strong>. Transcript is not shown during supported retry.</>,
  footerIdle: 'Full replay, then check 5 answers.', footerComplete: 'Continue to Task 3.', continueLabel: 'Back to book', completeIndependent: 'You completed the listening section independently.', completeGuided: 'You finished the listening section. Guided questions can be reviewed later.', backMessage: 'Keep going. Task 3 moves from listening to sentence building.', maxAttempts: 3,
}
