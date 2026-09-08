import type { ChecklistItemConfig } from '../../task-engine/schema'

export const WRITING_CHECKLIST: readonly ChecklistItemConfig[] = [
  { id: 'length', title: '40–50 words', help: 'Your paragraph is about 40 to 50 words long.' },
  { id: 'name', title: 'School name and place', help: 'You say the school name and where it is.' },
  { id: 'facilities', title: 'Facilities and an activity', help: 'You describe school facilities and one activity students do.' },
  { id: 'like', title: 'One thing you like', help: 'You say one thing you like about the school.' },
]

export const WRITING_LANGUAGE_HELP = ['My school is …', 'It is in …', 'It has …', 'Students …', 'I like … because …'] as const
