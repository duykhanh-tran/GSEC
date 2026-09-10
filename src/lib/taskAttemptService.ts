import { supabase } from './supabaseClient'

export interface SaveTaskAttemptOptions {
  taskCode: string
  score: number
  firstScore?: number
  status?: 'in_progress' | 'completed'
  supportMode?: 'INDEPENDENT' | 'GUIDED'
  answersPayload?: any
}

export interface SaveTaskAttemptResult {
  success: boolean
  isGuest?: boolean
  message?: string
  error?: string | null
  attempt?: any
}

// In-memory cache to debounce rapid identical saves within 800ms
const pendingSaves = new Map<string, Promise<SaveTaskAttemptResult>>()

/**
 * Lưu hoặc cập nhật kết quả làm bài của học sinh vào bảng public.student_attempts
 * Đảm bảo:
 * 1. Lưu giữ điểm lần 1 (first_score) cố định, không bị ghi đè khi làm lại
 * 2. Lưu điểm cao nhất (score)
 * 3. Tăng số lần thử (attempt_count)
 * 4. Tự động liên kết assignment_id nếu bài này đang được giao cho lớp
 * 5. Kích hoạt Supabase Realtime thông báo ngay lập tức cho Admin và Giáo viên
 */
export async function saveTaskAttempt(options: SaveTaskAttemptOptions): Promise<SaveTaskAttemptResult> {
  const {
    taskCode,
    score,
    firstScore,
    status = 'completed',
    supportMode,
    answersPayload = {},
  } = options

  // 1. Kiểm tra tài khoản đăng nhập
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('task-attempt-saved', {
          detail: {
            taskCode,
            score,
            status,
            isGuest: true,
          },
        })
      )
    }
    return {
      success: true,
      isGuest: true,
      message: 'Khách chưa đăng nhập: Không lưu vào cơ sở dữ liệu.',
    }
  }

  const cacheKey = `${user.id}_${taskCode}_${status}_${score}`
  if (pendingSaves.has(cacheKey)) {
    return pendingSaves.get(cacheKey)!
  }

  const savePromise = (async (): Promise<SaveTaskAttemptResult> => {
    try {
      // 2. Tìm bản ghi trước đó của học sinh cho bài tập này
      const { data: existing, error: fetchError } = await supabase
        .from('student_attempts')
        .select('id, score, first_score, attempt_count, status, completed_at, assignment_id')
        .eq('student_id', user.id)
        .eq('task_code', taskCode)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.warn('Lỗi kiểm tra student_attempts cũ:', fetchError)
      }

      // 3. Tự động dò tìm assignment_id nếu bài này đang được giao cho lớp của học sinh
      let assignmentId = existing?.assignment_id || null
      if (!assignmentId) {
        try {
          const { data: cs } = await supabase
            .from('class_students')
            .select('class_id')
            .eq('student_id', user.id)

          if (cs && cs.length > 0) {
            const classIds = cs.map((item: any) => item.class_id).filter(Boolean)
            if (classIds.length > 0) {
              const { data: assign } = await supabase
                .from('assignments')
                .select('id')
                .in('class_id', classIds)
                .eq('task_code', taskCode)
                .order('due_date', { ascending: false })
                .limit(1)
                .maybeSingle()

              if (assign?.id) {
                assignmentId = assign.id
              }
            }
          }
        } catch {
          // Bỏ qua nếu không tra được assignment_id
        }
      }

      const nowIso = new Date().toISOString()

      // 4. Thực hiện Cập nhật (UPDATE) nếu đã có, hoặc Thêm mới (INSERT) nếu là lần đầu
      if (existing) {
        const preservedFirstScore =
          existing.first_score !== null && existing.first_score !== undefined
            ? existing.first_score
            : (firstScore ?? score)

        const bestScore = Math.max(existing.score ?? 0, score)
        const finalStatus =
          existing.status === 'completed' || status === 'completed'
            ? 'completed'
            : (status || 'in_progress')
        const completedAt =
          finalStatus === 'completed' ? (existing.completed_at || nowIso) : null
        const nextAttemptCount = (existing.attempt_count || 1) + 1

        const { data: updated, error: updateError } = await supabase
          .from('student_attempts')
          .update({
            score: bestScore,
            first_score: preservedFirstScore,
            attempt_count: nextAttemptCount,
            status: finalStatus,
            support_mode:
              supportMode || (bestScore === 100 ? 'INDEPENDENT' : 'GUIDED'),
            answers_payload: answersPayload,
            assignment_id: assignmentId,
            completed_at: completedAt,
            updated_at: nowIso,
          })
          .eq('id', existing.id)
          .select()

        if (updateError) {
          console.error('Lỗi khi cập nhật student_attempts:', updateError)
          return { success: false, error: updateError.message }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('task-attempt-saved', {
              detail: {
                taskCode,
                score: bestScore,
                firstScore: preservedFirstScore,
                status: finalStatus,
                isCompleted: finalStatus === 'completed',
                isGuest: false,
              },
            })
          )
        }

        return { success: true, attempt: updated?.[0] || existing }
      } else {
        const finalFirstScore = firstScore ?? score
        const finalStatus = status || 'in_progress'
        const completedAt = finalStatus === 'completed' ? nowIso : null

        const { data: inserted, error: insertError } = await supabase
          .from('student_attempts')
          .insert({
            student_id: user.id,
            task_code: taskCode,
            score: score,
            first_score: finalFirstScore,
            attempt_count: 1,
            status: finalStatus,
            support_mode:
              supportMode || (score === 100 ? 'INDEPENDENT' : 'GUIDED'),
            answers_payload: answersPayload,
            assignment_id: assignmentId,
            completed_at: completedAt,
            updated_at: nowIso,
          })
          .select()

        if (insertError) {
          console.error('Lỗi khi thêm mới student_attempts:', insertError)
          return { success: false, error: insertError.message }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('task-attempt-saved', {
              detail: {
                taskCode,
                score,
                firstScore: finalFirstScore,
                status: finalStatus,
                isCompleted: finalStatus === 'completed',
                isGuest: false,
              },
            })
          )
        }

        return { success: true, attempt: inserted?.[0] }
      }
    } catch (err: any) {
      console.error('Lỗi khi lưu kết quả bài tập:', err)
      return { success: false, error: err?.message || String(err) }
    } finally {
      setTimeout(() => pendingSaves.delete(cacheKey), 800)
    }
  })()

  pendingSaves.set(cacheKey, savePromise)
  return savePromise
}

/**
 * Lấy lịch sử làm bài gần nhất của học sinh đối với bài tập cụ thể
 */
export async function getStudentAttempt(taskCode: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('student_attempts')
      .select('*')
      .eq('student_id', user.id)
      .eq('task_code', taskCode)
      .maybeSingle()

    if (error) return null
    return data
  } catch {
    return null
  }
}
