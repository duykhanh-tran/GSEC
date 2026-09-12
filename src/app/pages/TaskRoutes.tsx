import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import type { TaskDefinition } from '../task-types'
import { getTask, getTaskPath } from '../registry'
import { taskCacheService } from '../../lib/taskCacheService'
import { NotFoundPage } from './NotFoundPage'

export function TaskRoute() {
  const { code } = useParams()
  const staticTask = code ? getTask(code) : null

  // Đọc tức thì từ RAM cache nếu có (0ms - không chờ đợi)
  const initialCache = code ? taskCacheService.getFromMemory(code) : undefined
  const [dynamicTask, setDynamicTask] = useState<TaskDefinition | null>(
    initialCache ? initialCache.dynamicTask : null,
  )
  const [rawDbTask, setRawDbTask] = useState<any | null>(
    initialCache ? initialCache.rawDbTask : null,
  )
  const [loading, setLoading] = useState(() => {
    if (import.meta.env.MODE === 'test') return false
    if (!code) return false
    if (initialCache) return false
    return true
  })

  useEffect(() => {
    if (!code) {
      setLoading(false)
      return
    }

    // Trong môi trường unit test vitest, không gọi DB mà dùng trực tiếp staticTask
    if (import.meta.env.MODE === 'test') {
      setLoading(false)
      return
    }

    let ignore = false

    // Nếu đã có sẵn trong bộ nhớ RAM, hiển thị ngay lập tức (0ms)
    const mem = taskCacheService.getFromMemory(code)
    if (mem) {
      setDynamicTask(mem.dynamicTask)
      setRawDbTask(mem.rawDbTask)
      setLoading(false)
      // Kiểm tra ngầm trong background xem giáo viên/admin có vừa chỉnh sửa bài không
      taskCacheService.revalidateInBackground(code).catch(() => undefined)
    } else {
      setLoading(true)
      // Tải siêu tốc qua đa tầng: RAM -> IndexedDB (<15ms) -> Supabase Network
      taskCacheService
        .getTaskFast(code)
        .then(({ dynamicTask: dyn, rawDbTask: raw }) => {
          if (ignore) return
          setDynamicTask(dyn)
          setRawDbTask(raw)
          setLoading(false)
        })
        .catch(() => {
          if (ignore) return
          setDynamicTask(null)
          setRawDbTask(null)
          setLoading(false)
        })
    }

    // Lắng nghe sự kiện cập nhật ngầm nếu bài tập trên Supabase có thay đổi mới
    const handleCacheUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ code: string }>
      if (customEvent.detail?.code === code && !ignore) {
        const updated = taskCacheService.getFromMemory(code)
        if (updated) {
          setDynamicTask(updated.dynamicTask)
          setRawDbTask(updated.rawDbTask)
        }
      }
    }
    window.addEventListener('gsec-task-cache-updated', handleCacheUpdated)

    return () => {
      ignore = true
      window.removeEventListener('gsec-task-cache-updated', handleCacheUpdated)
    }
  }, [code])

  const [remountKey, setRemountKey] = useState(0)

  useEffect(() => {
    const handleRestartTask = () => {
      setRemountKey((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('restart-task', handleRestartTask)
    return () => window.removeEventListener('restart-task', handleRestartTask)
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: '15px' }}>
        Đang tải bài tập {code}...
      </div>
    )
  }

  // 1. Ưu tiên bài tập thực tế từ Supabase (nếu Admin đã tạo bài mới thay thế)
  if (dynamicTask) {
    const TaskComponent = dynamicTask.component as any
    return <TaskComponent key={`${code}-${remountKey}`} task={dynamicTask} initialData={rawDbTask} />
  }

  // 2. Fallback: Nếu bài chưa có trong DB nhưng có component mẫu tĩnh
  if (staticTask) {
    const TaskComponent = staticTask.component
    return <TaskComponent key={`${code}-${remountKey}`} task={staticTask} />
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
