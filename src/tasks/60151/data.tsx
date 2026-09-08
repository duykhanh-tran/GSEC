import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

export const TASK_60151_CONFIG = {
  className: 'task-60151',
  intro: <><strong>Check Task 1.</strong><br />Use the summaries you matched in the worksheet. Enter A, B or C for each school.</>,
  entrySubtitle: '3 schools',
  entryNote: 'The school profiles and summaries stay in the worksheet. The app only checks your choices and guides you back to the right evidence.',
  options: ['A', 'B', 'C'],
  items: [
    { id: 1, key: 'B', firstHint: 'Look again at the Pine Hill School profile in your worksheet.', secondHint: 'Find the part that tells you where students live from Monday to Friday.', retryTag: 'READ-MAIN-IDEA', bookCue: 'Look back at Pine Hill School and the summaries A/B/C in your worksheet.', summaryLabel: 'Pine Hill School' },
    { id: 2, key: 'C', firstHint: 'Look again at the Kim Dong Secondary School profile in your worksheet.', secondHint: 'Find the sentence that tells you what students do after lessons.', retryTag: 'READ-MAIN-IDEA', bookCue: 'Look back at Kim Dong Secondary School and the summaries A/B/C in your worksheet.', summaryLabel: 'Kim Dong Secondary School' },
    { id: 3, key: 'A', firstHint: 'Look again at the Green World School profile in your worksheet.', secondHint: 'Focus on the school day and the activities students can join after lessons.', retryTag: 'READ-MAIN-IDEA', bookCue: 'Look back at Green World School and the summaries A/B/C in your worksheet.', summaryLabel: 'Green World School' },
  ],
  demoAnswers: { 1: 'A', 2: 'C', 3: 'C' },
  incompleteMessage: 'Choose one summary for all 3 schools first.',
  itemSingular: 'School', itemPlural: 'Schools', retryDataAttribute: 'school',
  resultsTitle: 'Task 1 check', summaryTitle: 'Task 1 complete ✓', summarySubtitle: 'Main Idea', evidenceTag: 'READ-MAIN-IDEA',
  evidenceNote: <>Evidence stored as <strong>READ-MAIN-IDEA</strong>. Answers shown by the Tutor do not count as independently mastered.</>,
  footerIdle: 'Check 3 answers.', footerComplete: 'Continue to Task 2.', continueLabel: 'Task 2',
  completeIndependent: 'You matched all three school profiles independently. Back to your book for Task 2.',
  completeGuided: 'You finished the task. Guided items can be reviewed again later. Back to your book for Task 2.',
  backMessage: 'Keep going. I’ll be here when you need help.',
} satisfies GuidedChoiceTaskConfig
