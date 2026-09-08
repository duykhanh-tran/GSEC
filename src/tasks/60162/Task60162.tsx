import type { TaskComponentProps } from '../../app/task-types'
import { ListeningChoiceTask } from '../../components/assessment/ListeningChoiceTask'
import { TASK_60162_CONFIG } from './data'

export function Task60162(props: TaskComponentProps) {
  return <ListeningChoiceTask {...props} config={TASK_60162_CONFIG} />
}
