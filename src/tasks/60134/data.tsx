import type { GuidedChoiceTaskConfig } from '../../components/assessment/GuidedChoiceTask'

const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const items = [
  { id: 1, key: 'Sometimes', activity: 'clean the board after class', days: [0,1,0,1,0], hints: ['Look again: An does this on 2 of 5 school days.', '2 of 5 means some days → sometimes.'] },
  { id: 2, key: 'Never', activity: 'arrive late for school', days: [0,0,0,0,0], hints: ['An does this on 0 of 5 school days.', '0 days means no days → never.'] },
  { id: 3, key: 'Usually', activity: 'practise English with a classmate', days: [1,1,0,1,1], hints: ['An does this on 4 of 5 school days.', '4 of 5 means most days → usually.'] },
  { id: 4, key: 'Always', activity: 'say hello to his teachers', days: [1,1,1,1,1], hints: ['An does this on all 5 school days.', '5 of 5 means every day → always.'] },
  { id: 5, key: 'Sometimes', activity: 'play word games at break time', days: [1,0,0,0,1], hints: ['An does this on 2 of 5 school days.', '2 of 5 means some days → sometimes.'] },
]

export const TASK_60134_CONFIG = {
  className: 'task-60134', intro: <><strong>Check Task 4.</strong><br />Enter the frequency words you chose from the school-week chart.</>, entryTitle: 'Your worksheet answers', entrySubtitle: '5 items', entryNote: 'Do the thinking and full-sentence writing in the worksheet. The app only records the frequency word for each sentence.', options: ['Always', 'Usually', 'Sometimes', 'Never'],
  items: items.map((item) => ({ id: item.id, key: item.key, firstHint: item.hints[0], secondHint: item.hints[1], retryTag: 'FREQUENCY-MEANING', bookCue: item.activity, summaryLabel: `Sentence ${item.id}`, summaryValue: `${item.key} ✓`, retryContent: <><div className="activity">{item.activity}</div><div className="days">{item.days.map((on, index) => <div className={`day ${on ? 'on' : ''}`} key={names[index]}>{names[index]}<br />{on ? '✓' : '–'}</div>)}</div></> })),
  demoAnswers: { 1: 'Sometimes', 2: 'Always', 3: 'Sometimes', 4: 'Always', 5: 'Usually' }, incompleteMessage: 'Choose one frequency word for all 5 items first.', itemSingular: 'Sentence', itemPlural: 'Sentences', retryDataAttribute: 'sentence', resultsTitle: 'Task 4 check', summaryTitle: 'Task 4 complete ✓', summarySubtitle: 'Frequency meaning', evidenceTag: 'FREQUENCY-MEANING', evidenceNote: 'First-attempt errors are stored under FREQUENCY-MEANING. The full sentences remain in the worksheet.', footerIdle: 'Check 5 answers.', footerComplete: 'Continue to Task 5.', continueLabel: 'Task 5', completeIndependent: 'You can read a weekly routine and choose the right frequency word. Back to your book for Task 5.', completeGuided: 'You can read a weekly routine and choose the right frequency word. Back to your book for Task 5.', backMessage: 'Keep going. I’ll be here when you need me.', maxAttempts: 2, guidedAtLimit: false, summaryMode: 'answers', celebration: true,
} satisfies GuidedChoiceTaskConfig
