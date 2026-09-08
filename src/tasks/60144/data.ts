export const ROLEPLAY_STAGES_60144 = {
  greet: { label: 'Greet Sam', bad: 'Hello.', good: 'Hi, Sam. Nice to meet you.', cue: 'You greeted Sam, but you did not use the first-meeting phrase. Try again with the phrase used when meeting someone for the first time.', success: 'You greeted Sam and responded appropriately.', next: 'Continue' },
  question: { label: 'Ask Sam a question', bad: 'How much money do you have?', good: 'What subject do you like?', cue: 'Ask about school or an activity. Avoid private questions about money or family.', success: 'Your question is suitable for a new classmate.', next: 'Continue' },
  introduce: { label: 'Introduce An', bad: 'An is class 6A.', good: 'This is An, my new classmate.', cue: 'You are introducing another person. Begin with the phrase used before the person’s name.', success: 'You introduced An clearly using the target language.', next: 'Finish round' },
} as const

export type RoleplayStage60144 = keyof typeof ROLEPLAY_STAGES_60144
