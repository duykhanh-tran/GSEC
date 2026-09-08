import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

export const TASK_60141_CONFIG = {
  className: 'task-60141',
  intro: <><strong>Check Task 1.</strong><br />Use the phrase bank in your worksheet. Enter its A, B, C or D label for each blank.</>,
  entryTitle: 'Your worksheet answers', entrySubtitle: '4 blanks',
  entryNote: 'The phrases stay in the worksheet. The app only records their A–D labels and guides you back to the dialogue.',
  options: ['A', 'B', 'C', 'D'],
  items: [
    { id: 1, key: 'A', firstHint: 'You are introducing Ben to Mai. Which phrase goes before Ben’s name?', secondHint: 'Choose the phrase used to introduce another person.', retryTag: 'FUNCTION', bookCue: 'Read the dialogue line and phrase bank again.', retryContent: <div className="dialogue">Linh: Mai, <strong>(1)</strong> Ben, my new classmate.</div>, summaryLabel: 'Blank 1' },
    { id: 2, key: 'B', firstHint: 'Mai speaks to Ben for the first time. Start with a short greeting.', secondHint: 'Choose the simple greeting phrase.', retryTag: 'FUNCTION', bookCue: 'Read the dialogue line and phrase bank again.', retryContent: <div className="dialogue">Mai: <strong>(2)</strong>, Ben.</div>, summaryLabel: 'Blank 2' },
    { id: 3, key: 'C', firstHint: 'Mai is meeting Ben for the first time. Which polite phrase fits here?', secondHint: 'Choose the phrase used when meeting someone for the first time.', retryTag: 'FUNCTION', bookCue: 'Read the dialogue line and phrase bank again.', retryContent: <div className="dialogue">Mai: Hello, Ben. <strong>(3)</strong>.</div>, summaryLabel: 'Blank 3' },
    { id: 4, key: 'D', firstHint: 'Ben is responding after Mai greets him politely.', secondHint: 'Choose the matching response phrase from the worksheet.', retryTag: 'FUNCTION', bookCue: 'Read the dialogue line and phrase bank again.', retryContent: <div className="dialogue">Ben: Hi, Mai. <strong>(4)</strong>.</div>, summaryLabel: 'Blank 4' },
  ],
  demoAnswers: { 1: 'A', 2: 'C', 3: 'B', 4: 'D' },
  incompleteMessage: 'Choose one A–D label for all 4 blanks first.', itemSingular: 'Blank', itemPlural: 'Blanks', retryDataAttribute: 'blank',
  resultsTitle: 'Task 1 check', summaryTitle: 'Task 1 complete ✓', summarySubtitle: 'Everyday English', evidenceTag: 'FUNCTION',
  evidenceNote: 'First-attempt errors can be stored as functional-language evidence for later review.', footerIdle: 'Check 4 answers.', footerComplete: 'Continue to Task 2.', continueLabel: 'Task 2',
  completeIndependent: 'All correct. Back to your book for Task 2.', completeGuided: 'All correct. Back to your book for Task 2.', backMessage: 'Keep going. I’ll be here when you need me.',
  maxAttempts: 2, guidedAtLimit: false, summaryMode: 'answers', wrongSuffix: '',
} satisfies GuidedChoiceTaskConfig
