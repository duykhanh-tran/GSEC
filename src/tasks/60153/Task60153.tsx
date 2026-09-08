import type { TaskComponentProps } from '../../app/task-types'
import { GuidedChoiceTask } from '../../components/assessment/GuidedChoiceTask'
import { TASK_60153_CONFIG } from './data'

export function Task60153(props: TaskComponentProps) {
  return <GuidedChoiceTask {...props} config={TASK_60153_CONFIG} />
}
