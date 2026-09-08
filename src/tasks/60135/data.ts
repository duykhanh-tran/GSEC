export const SENTENCES_60135 = [
  { spoken: 'I always do my homework after dinner.', frequency: 'always', valid: true },
  { spoken: 'I usually go to school by bus.', frequency: 'usually', valid: true },
  { spoken: 'I play often football after school.', frequency: 'often', valid: false, repair: 'The frequency word should go before the main verb.', fixed: 'I often play football after school.' },
  { spoken: 'My friend sometimes plays chess after school.', frequency: 'sometimes', valid: true },
] as const
