import type { VerificationItemConfig } from '../../task-engine/schema'

export const WRITING_DEMO = {
  first: 'My school is Nguyen Du Secondary School. It is in Ha Noi. It has a big library and a large playground. Students play football after school. I like my school because my teachers is friendly.',
  revised: 'My school is Nguyen Du Secondary School. It is in Ha Noi. It has a big library and a large playground. Students play football on the playground after school. I like my school because my teachers are friendly.',
} as const

export const MECHANICS_ITEMS: readonly VerificationItemConfig[] = [
  { id: 'caps', label: 'Every sentence begins with a capital letter.' },
  { id: 'endmark', label: 'Every sentence ends with a full stop, question mark or exclamation mark.' },
  { id: 'spelling', label: 'I checked these words in my book.' },
]

export const CHECK_WORDS = ['secondary', 'playground', 'friendly'] as const
