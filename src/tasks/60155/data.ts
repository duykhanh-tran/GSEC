export const SPEAKING_DEMO = {
  first: "I'd like to go to Green World School because students learn some subjects in English and Vietnamese. The school has a smart board in every classroom. I think it is good for me because I want to use more English. I like art.",
  follow: "I'd like to join the art club because I like drawing.",
  revised: "I'd like to go to Green World School because students learn some subjects in English and Vietnamese. It is good for me because I want to use more English and meet students from different countries. I'd also like to join the art club because I like drawing.",
} as const

export type SpeakingPhase = 'first' | 'first-feedback' | 'follow' | 'follow-feedback' | 'revision-ready' | 'revised' | 'revised-feedback' | 'complete'
