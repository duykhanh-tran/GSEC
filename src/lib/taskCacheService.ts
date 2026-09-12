import type { TaskDefinition } from '../app/task-types'
import { DynamicTaskRunner } from '../task-engine/DynamicTaskRunner'
import { supabase } from './supabaseClient'

const DB_NAME = 'gsec_tasks_cache_db'
const DB_VERSION = 1
const STORE_NAME = 'tasks'

export interface CachedTaskRecord {
  code: string
  dynamicTask: TaskDefinition | null
  rawDbTask: any | null
  updated_at?: string
  cached_at: number
}

// Layer 1: In-Memory RAM Cache for 0ms instantaneous access
const memoryCache = new Map<string, CachedTaskRecord>()

// Layer 2: Audio Blob URL cache to avoid massive base64 re-parsing
const audioBlobCache = new Map<string, string>()

/**
 * Chuyển đổi base64 audio sang Blob Object URL để browser giải mã nhanh qua C++ native audio engine,
 * tránh làm đơ main thread của React và tiết kiệm bộ nhớ RAM.
 */
export function getOptimizedAudioSrc(src?: string): string {
  if (!src) return ''
  if (!src.startsWith('data:audio')) return src

  const cached = audioBlobCache.get(src)
  if (cached) return cached

  try {
    const parts = src.split(',')
    const mimeMatch = parts[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'audio/mpeg'
    const bstr = atob(parts[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    const blob = new Blob([u8arr], { type: mime })
    const objUrl = URL.createObjectURL(blob)
    audioBlobCache.set(src, objUrl)
    return objUrl
  } catch {
    return src
  }
}

/**
 * Mở kết nối IndexedDB (hỗ trợ lưu trữ hàng trăm MB dữ liệu audio lâu dài trong trình duyệt)
 */
function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'code' })
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        console.warn('IndexedDB open error, using in-memory cache fallback.')
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })
}

/**
 * Lưu bản ghi task vào IndexedDB
 */
async function saveToIndexedDB(record: CachedTaskRecord): Promise<void> {
  try {
    const db = await openIndexedDB()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        // Không lưu component function trực tiếp vào IndexedDB (tránh DataCloneError)
        const serializableRecord = {
          code: record.code,
          rawDbTask: record.rawDbTask,
          hasDynamic: Boolean(record.dynamicTask),
          dynamicMeta: record.dynamicTask
            ? {
                code: record.dynamicTask.code,
                unit: record.dynamicTask.unit,
                worksheet: record.dynamicTask.worksheet,
                lesson: record.dynamicTask.lesson,
                taskNumber: record.dynamicTask.taskNumber,
                title: record.dynamicTask.title,
                subtitle: record.dynamicTask.subtitle,
                status: record.dynamicTask.status,
                archetypes: record.dynamicTask.archetypes,
                legacyUrl: record.dynamicTask.legacyUrl,
              }
            : null,
          updated_at: record.updated_at,
          cached_at: record.cached_at,
        }

        const putReq = store.put(serializableRecord)
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  } catch {
    // ignore
  }
}

/**
 * Đọc bản ghi task từ IndexedDB (< 15ms)
 */
async function getFromIndexedDB(code: string): Promise<CachedTaskRecord | null> {
  try {
    const db = await openIndexedDB()
    if (!db) return null

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const getReq = store.get(code)

        getReq.onsuccess = () => {
          const res = getReq.result
          if (!res) {
            resolve(null)
            return
          }

          let dynamicTask: TaskDefinition | null = null
          if (res.hasDynamic && res.dynamicMeta) {
            dynamicTask = {
              ...res.dynamicMeta,
              component: DynamicTaskRunner,
            }
          }

          const record: CachedTaskRecord = {
            code: res.code,
            dynamicTask,
            rawDbTask: res.rawDbTask,
            updated_at: res.updated_at,
            cached_at: res.cached_at || Date.now(),
          }
          resolve(record)
        }

        getReq.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

/**
 * Chuyển đổi dữ liệu DB Supabase thành TaskDefinition
 */
function buildDynamicTaskDefinition(dbTask: any): TaskDefinition {
  return {
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
}

class TaskCacheService {
  /**
   * Đọc tức thì từ RAM (0ms) nếu đã tải
   */
  getFromMemory(code: string): CachedTaskRecord | undefined {
    return memoryCache.get(code)
  }

  /**
   * Tải Task siêu tốc: RAM (0ms) -> IndexedDB (5-15ms) -> Supabase Network (fallback)
   */
  async getTaskFast(code: string): Promise<{ dynamicTask: TaskDefinition | null; rawDbTask: any | null }> {
    const cleanCode = code.trim()

    // 1. Kiểm tra RAM cache (0ms)
    const mem = memoryCache.get(cleanCode)
    if (mem) {
      // Background revalidate nếu cache đã quá 5 phút
      if (Date.now() - mem.cached_at > 5 * 60 * 1000) {
        this.revalidateInBackground(cleanCode)
      }
      return { dynamicTask: mem.dynamicTask, rawDbTask: mem.rawDbTask }
    }

    // 2. Kiểm tra IndexedDB cache (< 15ms)
    const idbRecord = await getFromIndexedDB(cleanCode)
    if (idbRecord) {
      memoryCache.set(cleanCode, idbRecord)
      // Background revalidate kiểm tra xem admin có sửa bài không
      this.revalidateInBackground(cleanCode)
      return { dynamicTask: idbRecord.dynamicTask, rawDbTask: idbRecord.rawDbTask }
    }

    // 3. Tải từ Supabase Network
    return this.fetchAndCacheTask(cleanCode)
  }

  /**
   * Tải dữ liệu từ Supabase và ghi vào cả RAM và IndexedDB
   */
  async fetchAndCacheTask(code: string): Promise<{ dynamicTask: TaskDefinition | null; rawDbTask: any | null }> {
    const cleanCode = code.trim()
    try {
      const { data: dbTask, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle()

      if (!error && dbTask && dbTask.content && Object.keys(dbTask.content).length > 0) {
        const dyn = buildDynamicTaskDefinition(dbTask)
        const record: CachedTaskRecord = {
          code: cleanCode,
          dynamicTask: dyn,
          rawDbTask: dbTask,
          updated_at: dbTask.updated_at,
          cached_at: Date.now(),
        }

        // Lưu vào RAM và IndexedDB
        memoryCache.set(cleanCode, record)
        saveToIndexedDB(record).catch(() => undefined)

        return { dynamicTask: dyn, rawDbTask: dbTask }
      }

      const emptyRecord: CachedTaskRecord = {
        code: cleanCode,
        dynamicTask: null,
        rawDbTask: null,
        cached_at: Date.now(),
      }
      memoryCache.set(cleanCode, emptyRecord)
      return { dynamicTask: null, rawDbTask: null }
    } catch (err) {
      console.warn(`Lỗi tải task ${cleanCode}:`, err)
      return { dynamicTask: null, rawDbTask: null }
    }
  }

  /**
   * Kiểm tra ngầm trong background xem bài có cập nhật mới ở DB không
   */
  async revalidateInBackground(code: string): Promise<void> {
    try {
      const { data } = await supabase
        .from('tasks')
        .select('code, updated_at')
        .eq('code', code)
        .maybeSingle()

      if (data && data.updated_at) {
        const current = memoryCache.get(code)
        if (current && current.updated_at !== data.updated_at) {
          // Có thay đổi mới -> nạp lại bản mới vào cache
          await this.fetchAndCacheTask(code)
          window.dispatchEvent(new CustomEvent('gsec-task-cache-updated', { detail: { code } }))
        }
      }
    } catch {
      // bỏ qua lỗi revalidate ngầm
    }
  }

  /**
   * Tải trước ngầm 1 task (khi học sinh đang gõ mã hoặc di chuột)
   */
  prefetchTask(code: string): void {
    if (!code || code.length < 3) return
    const cleanCode = code.trim()
    if (memoryCache.has(cleanCode)) return

    // Gọi ngầm không chặn luồng giao diện
    setTimeout(() => {
      this.getTaskFast(cleanCode).catch(() => undefined)
    }, 50)
  }

  /**
   * Tải trước danh sách các bài tập quan trọng hoặc bài tập được giao
   */
  preloadTasksBatch(codes: string[]): void {
    if (!codes || codes.length === 0) return
    const unique = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)))

    // Tải tuần tự hoặc chia nhỏ để không chiếm dụng băng thông
    let delay = 100
    for (const code of unique) {
      if (!memoryCache.has(code)) {
        setTimeout(() => {
          this.prefetchTask(code)
        }, delay)
        delay += 250
      }
    }
  }

  /**
   * Xóa cache khi Admin lưu hoặc sửa bài mới
   */
  async invalidateTask(code: string): Promise<void> {
    const cleanCode = code.trim()
    memoryCache.delete(cleanCode)

    try {
      const db = await openIndexedDB()
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(cleanCode)
      }
    } catch {
      // ignore
    }
  }
}

export const taskCacheService = new TaskCacheService()
