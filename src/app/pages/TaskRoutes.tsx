import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import type { TaskDefinition } from '../task-types'
import { getTask, getTaskPath } from '../registry'
import { DynamicTaskRunner } from '../../task-engine/DynamicTaskRunner'
import { supabase } from '../../lib/supabaseClient'
import { NotFoundPage } from './NotFoundPage'

export function TaskRoute() {
  const { code } = useParams()
  const staticTask = code ? getTask(code) : null
  const [dynamicTask, setDynamicTask] = useState<TaskDefinition | null>(null)
  const [rawDbTask, setRawDbTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(!staticTask)

  useEffect(() => {
    if (staticTask || !code) {
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)

    // Tra cứu bài tập từ Supabase (dành cho bài tập do Admin tạo trong Studio như 60118, 60171)
    supabase
      .from('tasks')
      .select('*')
      .eq('code', code)
      .maybeSingle()
      .then(({ data: dbTask, error }) => {
        if (ignore) return
        if (!error && dbTask) {
          const dyn: TaskDefinition = {
            code: dbTask.code,
            unit: dbTask.unit || dbTask.content?.unit || 1,
            worksheet: dbTask.worksheet || dbTask.lesson || dbTask.content?.lesson || 1,
            lesson: dbTask.lesson || dbTask.content?.lesson || dbTask.worksheet || 1,
            taskNumber: dbTask.task_number || 1,
            title: dbTask.title,
            subtitle: dbTask.subtitle || '',
            status: 'migrated',
            archetypes: (dbTask.archetypes || ['standardized']) as any,
            component: DynamicTaskRunner,
            legacyUrl: `/tasks/${dbTask.code}/index.html`,
          }
          setRawDbTask(dbTask)
          setDynamicTask(dyn)
        } else {
          setDynamicTask(null)
          setRawDbTask(null)
        }
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [code, staticTask])

  const [remountKey, setRemountKey] = useState(0)

  useEffect(() => {
    const handleRestartTask = () => {
      setRemountKey((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('restart-task', handleRestartTask)
    return () => window.removeEventListener('restart-task', handleRestartTask)
  }, [])

  if (staticTask) {
    const TaskComponent = staticTask.component
    return <TaskComponent key={`${code}-${remountKey}`} task={staticTask} />
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: '15px' }}>
        Đang tải bài tập {code}...
      </div>
    )
  }

  if (dynamicTask) {
    const TaskComponent = dynamicTask.component as any
    return <TaskComponent key={`${code}-${remountKey}`} task={dynamicTask} initialData={rawDbTask} />
  }

  return <NotFoundPage requestedCode={code} />
}

export function LegacyTaskRoute() {
  const { code } = useParams()
  const path = getTaskPath(code)

  return path ? (
    <Navigate replace to={path} />
  ) : (
    <Navigate replace to={`/tasks/${code}`} />
  )
}
