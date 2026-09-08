import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

export const TASK_60142_CONFIG = {
  className: 'task-60142',
  intro: <><strong>Check Task 2.</strong><br />Enter your A, B or C answers from the worksheet.</>,
  entrySubtitle: '5 items', entryNote: 'All question content stays in the worksheet. The app only records your choices and gives targeted clues when needed.', options: ['A', 'B', 'C'],
  items: [
    { id: 1, key: 'B', firstHint: 'What is Minh trying to do?', secondHint: 'He needs to introduce Hoa to Tom. Look for the option that directly introduces another person.', retryTag: 'M1', bookCue: 'Look back at Question 1 and its A/B/C options in your worksheet.', summaryLabel: 'Question 1' },
    { id: 2, key: 'A', firstHint: 'Lan is responding to a first-meeting greeting.', secondHint: 'Look for the polite matching response to “Nice to meet you.”', retryTag: 'M1', bookCue: 'Look back at Question 2 and its A/B/C options in your worksheet.', summaryLabel: 'Question 2' },
    { id: 3, key: 'C', firstHint: 'Focus on the information you want: favourite school subject.', secondHint: 'Look for the option that asks directly about the subject the classmate likes.', retryTag: 'M2', bookCue: 'Look back at Question 3 and its A/B/C options in your worksheet.', summaryLabel: 'Question 3' },
    { id: 4, key: 'B', firstHint: 'You want to know more about the classmate’s interest in drawing.', secondHint: 'Look for the follow-up question that asks for more detail about drawing.', retryTag: 'M2', bookCue: 'Look back at Question 4 and its A/B/C options in your worksheet.', summaryLabel: 'Question 4' },
    { id: 5, key: 'A', firstHint: 'Look at Nam’s answer in the book: “Phong.” What kind of information is Phong?', secondHint: 'Phong is a person. Look for the option that asks who the person is.', retryTag: 'M3', bookCue: 'Look back at Question 5 and its A/B/C options in your worksheet.', summaryLabel: 'Question 5' },
  ],
  demoAnswers: { 1: 'B', 2: 'C', 3: 'C', 4: 'A', 5: 'C' }, incompleteMessage: 'Choose all 5 answers first.', itemSingular: 'Question', itemPlural: 'Questions', retryDataAttribute: 'question',
  resultsTitle: 'Task 2 check', summaryTitle: 'Task 2 complete ✓', summarySubtitle: 'Meaning & Appropriacy', evidenceTag: 'FUNCTION', evidenceNote: 'First-attempt errors can be stored under FUNCTION-INTRODUCE, FUNCTION-RESPOND or QUESTION-SUITABILITY.',
  footerIdle: 'Check 5 answers.', footerComplete: 'Continue to Task 3.', continueLabel: 'Task 3', completeIndependent: 'All correct. Back to your book for Task 3.', completeGuided: 'All correct. Back to your book for Task 3.', backMessage: 'Keep going. I’ll be here when you need me.',
  maxAttempts: 2, guidedAtLimit: false, summaryMode: 'answers', repeatFeedback: 'Not yet.',
} satisfies GuidedChoiceTaskConfig
