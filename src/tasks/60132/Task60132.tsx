import type { TaskComponentProps } from '../../app/task-types'
import { GuidedChoiceTask } from '../../components/assessment/GuidedChoiceTask'
import { TASK_60132_CONFIG } from './data'

export function Task60132(props: TaskComponentProps) { return <GuidedChoiceTask {...props} config={TASK_60132_CONFIG} /> }
