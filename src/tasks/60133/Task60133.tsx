import type { TaskComponentProps } from '../../app/task-types'
import { GuidedChoiceTask } from '../../components/assessment/GuidedChoiceTask'
import { TASK_60133_CONFIG } from './data'

export function Task60133(props: TaskComponentProps) { return <GuidedChoiceTask {...props} config={TASK_60133_CONFIG} /> }
