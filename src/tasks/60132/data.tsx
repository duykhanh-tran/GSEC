import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

const questions = [
  { id: 1, key: 'B', level: 'M1', hints: ['Reread the subject and compare the three verb forms in Question 1.', 'Identify the subject pronoun, apply present-simple agreement, then select the matching letter in your worksheet.'] },
  { id: 2, key: 'C', level: 'M1', hints: ['Reread the original sentence and identify how often the activity happens.', 'Match that frequency meaning with one of the three sentences in your worksheet.'] },
  { id: 3, key: 'A', level: 'M1', hints: ['Identify the subject in Question 3 before comparing the auxiliaries.', 'Apply the present-simple question rule, then choose the matching letter from your worksheet.'] },
  { id: 4, key: 'B', level: 'M2', hints: ['Find the phrase in Question 4 that tells you how often the activity happens.', 'Match that frequency with the correct sentence in your worksheet.'] },
  { id: 5, key: 'C', level: 'M2', hints: ['Check three things in each worksheet option: meaning, adverb position and verb agreement.', 'Select the letter only after one option passes all three checks.'] },
  { id: 6, key: 'A', level: 'M3', hints: ['Question 6 describes two routines. Check each routine separately in your worksheet.', 'Match both frequencies, then choose the only option where both parts are correct.'] },
] as const

export const TASK_60132_CONFIG = {
  className: 'task-60132', intro: <><strong>Check Task 2.</strong><br />Enter your A, B or C answers from the worksheet.</>, entrySubtitle: '6 items', entryNote: 'The worksheet remains the main task. The app only captures your choices and gives targeted help if needed.', options: ['A', 'B', 'C'],
  items: questions.map((item) => ({ id: item.id, key: item.key, firstHint: item.hints[0], secondHint: item.hints[1], retryTag: item.level, bookCue: <>Open your worksheet and reread <strong>Question {item.id}</strong>.</>, summaryLabel: `Question ${item.id}` })),
  demoAnswers: { 1: 'B', 2: 'A', 3: 'A', 4: 'B', 5: 'A', 6: 'C' }, incompleteMessage: 'Choose all 6 answers first.', itemSingular: 'Question', itemPlural: 'Questions', retryDataAttribute: 'question', resultsTitle: 'Task 2 check', summaryTitle: 'Task 2 complete ✓', summarySubtitle: 'Form & Meaning', evidenceTag: 'GRAMMAR', evidenceNote: 'First-attempt errors and retry history can be stored by error tag for later review in Task 6.', footerIdle: 'Check 6 answers.', footerComplete: 'Continue to Task 3.', continueLabel: 'Task 3', completeIndependent: 'Great work. Back to your book for Task 3.', completeGuided: 'Great work. Back to your book for Task 3.', backMessage: 'Keep going. I’ll be here when you need me.', maxAttempts: 2, guidedAtLimit: false, summaryMode: 'answers', celebration: true,
} satisfies GuidedChoiceTaskConfig
