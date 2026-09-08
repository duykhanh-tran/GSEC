import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

export const TASK_60152_CONFIG = {
  className: 'task-60152',
  intro: <><strong>Check Task 2.</strong><br />Enter your A, B or C answers from the worksheet.</>,
  entrySubtitle: '6 questions',
  entryNote: 'All questions and answer choices stay in the worksheet. The app only checks your choices and guides you back to the right reading evidence.',
  options: ['A', 'B', 'C'],
  items: [
    { id: 1, key: 'A', firstHint: 'Look again at the Pine Hill School profile.', secondHint: 'Find the sentence that tells you how many classes the school has.', retryTag: 'M1', bookCue: 'Look back at Pine Hill School and Question 1 in your worksheet.', summaryLabel: 'Question 1' },
    { id: 2, key: 'B', firstHint: 'Look again at the Pine Hill School profile.', secondHint: 'Focus on what students do in the afternoon.', retryTag: 'M1', bookCue: 'Look back at Pine Hill School and Question 2 in your worksheet.', summaryLabel: 'Question 2' },
    { id: 3, key: 'C', firstHint: 'Look again at the Kim Dong Secondary School profile.', secondHint: 'Find the sentence that tells you about the number of students.', retryTag: 'M1', bookCue: 'Look back at Kim Dong Secondary School and Question 3 in your worksheet.', summaryLabel: 'Question 3' },
    { id: 4, key: 'B', firstHint: 'Look again at the Kim Dong Secondary School profile.', secondHint: 'Lan needs to use a computer. Find the school facility that matches that need.', retryTag: 'M2', bookCue: 'Look back at Kim Dong Secondary School and Question 4 in your worksheet.', summaryLabel: 'Question 4' },
    { id: 5, key: 'C', firstHint: 'Look again at the Green World School profile.', secondHint: 'Focus on which languages are used for subjects at this school.', retryTag: 'M2', bookCue: 'Look back at Green World School and Question 5 in your worksheet.', summaryLabel: 'Question 5' },
    { id: 6, key: 'A', firstHint: 'Look again at the Green World School profile.', secondHint: 'Mai wants to study with international students. Find the school where teachers and students come from different countries.', retryTag: 'M2', bookCue: 'Look back at Green World School and Question 6 in your worksheet.', summaryLabel: 'Question 6' },
  ],
  demoAnswers: { 1: 'A', 2: 'C', 3: 'C', 4: 'A', 5: 'B', 6: 'C' },
  incompleteMessage: 'Choose all 6 answers first.',
  itemSingular: 'Question', itemPlural: 'Questions', retryDataAttribute: 'question',
  resultsTitle: 'Task 2 check', summaryTitle: 'Task 2 complete ✓', summarySubtitle: 'Reading Details', evidenceTag: 'READ-DETAIL',
  evidenceNote: <>Evidence stored as <strong>READ-DETAIL</strong>. Guided answers do not count as independently mastered reading evidence.</>,
  footerIdle: 'Check 6 answers.', footerComplete: 'Continue to Task 3.', continueLabel: 'Task 3',
  completeIndependent: 'You answered all six questions independently. Back to your book for Task 3.',
  completeGuided: 'You finished the task. Guided items can be reviewed later. Back to your book for Task 3.',
  backMessage: 'Keep going. I’ll be here when you need help.',
} satisfies GuidedChoiceTaskConfig
