import type { TaskComponentProps } from '../../app/task-types'
import { GuidedChoiceTask } from '../../components/assessment/GuidedChoiceTask'
import { TASK_60122_CONFIG } from './data'
export function Task60122(props: TaskComponentProps) { return <GuidedChoiceTask {...props} config={TASK_60122_CONFIG} /> }
