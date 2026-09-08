export const PLAN_ITEMS = [
  { id: 'school', title: 'School chosen', help: 'You chose one school from the reading.' },
  { id: 'fact', title: 'One fact from the text', help: 'You noted one true fact about that school.' },
  { id: 'reason', title: 'Why it is good for you', help: 'You wrote one personal reason.' },
  { id: 'activity', title: 'One activity you would like to do', help: 'You noted one activity for your talk.' },
] as const

export type PlanId = (typeof PLAN_ITEMS)[number]['id']

export const EMPTY_CHECKS: Record<PlanId, boolean> = {
  school: false,
  fact: false,
  reason: false,
  activity: false,
}

export const DEMO_CHECKS: Record<PlanId, boolean> = {
  school: true,
  fact: true,
  reason: true,
  activity: false,
}
