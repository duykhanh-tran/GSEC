import type { TaskComponentProps } from '../../app/task-types'
import { GuidedChoiceTask, type GuidedChoiceTaskConfig } from './GuidedChoiceTask'

export interface ListeningChoiceTaskConfig extends GuidedChoiceTaskConfig {
  playback: NonNullable<GuidedChoiceTaskConfig['playback']>
}

export function ListeningChoiceTask(props: TaskComponentProps & { config: ListeningChoiceTaskConfig }) {
  return <GuidedChoiceTask {...props} config={props.config} />
}
