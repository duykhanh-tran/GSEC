import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

const questions = [
  { id: 1, key: 'A', level: 'M1', hints: ['Reread the situation and find the detail that tells you what the family is about to do.', 'Compare that detail with the three activities in your worksheet, then choose only the matching letter.'] },
  { id: 2, key: 'B', level: 'M1', hints: ['Find the object mentioned in Question 2 and think about how it is normally used.', 'Compare all three activities in your worksheet and choose the one that needs that object.'] },
  { id: 3, key: 'C', level: 'M2', hints: ['Reread the learner’s goal in Question 3 before looking at the choices.', 'Choose the activity in your worksheet that directly helps achieve that goal.'] },
  { id: 4, key: 'A', level: 'M2', hints: ['Find the subject clue in Question 4.', 'Compare the three choices and select the school subject that matches that clue.'] },
  { id: 5, key: 'B', level: 'M3', hints: ['Question 5 contains two different needs. Check them one at a time in your worksheet.', 'Choose only the option whose two activities satisfy both needs.'] },
] as const

export const TASK_60122_CONFIG = {
  className: 'task-60122', intro: <><strong>Check Task 2.</strong><br />Enter your A, B or C answers from the worksheet.</>, entrySubtitle: '5 items', entryNote: 'The worksheet remains the main task. The app captures your choices and gives targeted clues only when needed.', options: ['A','B','C'],
  items: questions.map((item) => ({ id: item.id, key: item.key, firstHint: item.hints[0], secondHint: item.hints[1], retryTag: item.level, bookCue: <>Open your worksheet and reread <strong>Question {item.id}</strong>.</>, summaryLabel: `Question ${item.id}` })), demoAnswers: { 1:'A',2:'B',3:'A',4:'A',5:'C' }, incompleteMessage: 'Choose all 5 answers first.', itemSingular: 'Question', itemPlural: 'Questions', retryDataAttribute: 'question', resultsTitle: 'Task 2 check', summaryTitle: 'Task 2 complete ✓', summarySubtitle: 'All 5 answers are correct.', evidenceTag: 'MEANING', evidenceNote: 'First-attempt errors and retry history can be stored for targeted review.', footerIdle: 'Check 5 answers.', footerComplete: 'Continue to Task 3.', continueLabel: 'Task 3', completeIndependent: 'Great work. Back to your book.', completeGuided: 'Great work. Back to your book.', backMessage: 'Keep going. I’ll be here when you need me.', maxAttempts: 2, guidedAtLimit: false, summaryMode: 'answers', celebration: true,
} satisfies GuidedChoiceTaskConfig
