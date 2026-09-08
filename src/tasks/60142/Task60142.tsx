import type { TaskComponentProps } from '../../app/task-types'
import { GuidedChoiceTask } from '../../components/assessment/GuidedChoiceTask'
import { TASK_60142_CONFIG } from './data'

export function Task60142(props: TaskComponentProps) {
  return <GuidedChoiceTask {...props} config={TASK_60142_CONFIG} />
}
