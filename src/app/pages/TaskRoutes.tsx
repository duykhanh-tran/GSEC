import { Navigate, useParams } from 'react-router-dom'

import { getTask, getTaskPath } from '../registry'
import { NotFoundPage } from './NotFoundPage'

export function TaskRoute() {
  const { code } = useParams()
  const task = getTask(code)

  if (!task) {
    return <NotFoundPage requestedCode={code} />
  }

  const TaskComponent = task.component
  return <TaskComponent task={task} />
}

export function LegacyTaskRoute() {
  const { code } = useParams()
  const path = getTaskPath(code)

  return path ? (
    <Navigate replace to={path} />
  ) : (
    <NotFoundPage requestedCode={code} />
  )
}
