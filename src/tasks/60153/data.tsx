import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

export const TASK_60153_CONFIG = {
  className: 'task-60153',
  intro: <><strong>Check Task 3.</strong><br />Enter the letters you used for blanks 1–5 in the worksheet.</>,
  entrySubtitle: '5 blanks',
  entryNote: 'The full conversation and responses a–f stay in the worksheet. The app only records your letters and helps you follow the conversation when a blank is wrong.',
  options: ['a', 'b', 'c', 'd', 'e', 'f'],
  items: [
    { id: 1, key: 'c', firstHint: 'Look at what Mai asks Ben at the start of the conversation.', secondHint: 'Ben needs to respond to the question about whether he likes his new school.', retryTag: 'DISCOURSE', bookCue: 'Look back at blank 1, the line before it, and the next line in your worksheet.', summaryLabel: 'Blank 1' },
    { id: 2, key: 'a', firstHint: 'Look at Mai’s next question in the worksheet.', secondHint: 'Mai asks which school Ben goes to. Choose the response that gives the school name.', retryTag: 'DISCOURSE', bookCue: 'Look back at blank 2, the line before it, and the next line in your worksheet.', summaryLabel: 'Blank 2' },
    { id: 3, key: 'd', firstHint: 'Look at Mai’s sentence just before blank 3.', secondHint: 'Mai says her cousin studies there too. Ben should react to that new information and ask a follow-up question.', retryTag: 'DISCOURSE', bookCue: 'Look back at blank 3, the line before it, and the next line in your worksheet.', summaryLabel: 'Blank 3' },
    { id: 4, key: 'e', firstHint: 'Look at Mai’s question just before blank 4.', secondHint: 'Mai asks what Ben does after lessons. Choose the response about an after-school activity.', retryTag: 'DISCOURSE', bookCue: 'Look back at blank 4, the line before it, and the next line in your worksheet.', summaryLabel: 'Blank 4' },
    { id: 5, key: 'b', firstHint: 'Look at Mai’s sentence just before blank 5.', secondHint: 'Mai says she loves music too. Ben should respond with a suitable invitation or shared activity.', retryTag: 'DISCOURSE', bookCue: 'Look back at blank 5, the line before it, and the next line in your worksheet.', summaryLabel: 'Blank 5' },
  ],
  demoAnswers: { 1: 'c', 2: 'f', 3: 'a', 4: 'e', 5: 'd' },
  incompleteMessage: 'Choose a response for all 5 blanks first.',
  itemSingular: 'Blank', itemPlural: 'Blanks', retryDataAttribute: 'blank',
  resultsTitle: 'Task 3 check', summaryTitle: 'Task 3 complete ✓', summarySubtitle: 'Conversation', evidenceTag: 'DISCOURSE-COHESION',
  evidenceNote: <>Evidence stored as <strong>DISCOURSE-COHESION</strong>. The extra response remains unused, as in the worksheet.</>,
  footerIdle: 'Check 5 answers.', footerComplete: 'Continue to Task 4.', continueLabel: 'Task 4',
  completeIndependent: 'You followed the conversation independently. Back to your book for Task 4.',
  completeGuided: 'You finished the conversation. Guided blanks can be reviewed later. Back to your book for Task 4.',
  backMessage: 'Keep going. Task 4 is your speaking plan.',
} satisfies GuidedChoiceTaskConfig
