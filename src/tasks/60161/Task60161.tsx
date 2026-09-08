import type { TaskComponentProps } from '../../app/task-types'
import { ListeningChoiceTask } from '../../components/assessment/ListeningChoiceTask'
import { TASK_60161_CONFIG } from './data'

export function Task60161(props: TaskComponentProps) {
  return <ListeningChoiceTask {...props} config={TASK_60161_CONFIG} />
}
