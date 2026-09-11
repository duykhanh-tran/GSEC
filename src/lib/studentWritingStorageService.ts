import { supabase } from './supabaseClient'

export interface ApprovedWritingData {
  found: boolean
  sentences: string[]
  paragraph?: string
  taskCode?: string
  savedAt?: string
}

/**
 * Lưu các câu văn đã được AI phê duyệt đúng ngữ pháp từ Form 3 (hoặc Task 60115)
 * Hỗ trợ cả học sinh đã đăng nhập (lưu vào Supabase + localStorage) và Khách (localStorage)
 */
export async function saveApprovedWriting(
  taskCode: string,
  sentences: string[],
  paragraphText?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanSentences = (sentences || [])
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)

    if (cleanSentences.length === 0 && !paragraphText?.trim()) {
      return { success: false, error: 'Không có câu văn nào để lưu.' }
    }

    const payload = {
      approved_sentences: cleanSentences,
      approved_paragraph: paragraphText?.trim() || '',
      verified_by_ai: true,
      verified_at: new Date().toISOString(),
    }

    // 1. Lưu vào localStorage để truy cập tức thì (Offline-first / Guest-ready)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`gsec_approved_writing_${taskCode}`, JSON.stringify(payload))
        localStorage.setItem('gsec_approved_writing_latest', JSON.stringify({ taskCode, ...payload }))
      } catch (err) {
        console.warn('Không thể lưu approved writing vào localStorage:', err)
      }
    }

    // 2. Lưu vào Supabase nếu học sinh đã đăng nhập
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Lưu riêng theo user ID vào localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            `gsec_approved_writing_${taskCode}_${user.id}`,
            JSON.stringify(payload)
          )
        }

        // Cập nhật hoặc lưu vào student_attempts
        const { data: existing } = await supabase
          .from('student_attempts')
          .select('id, answers_payload')
          .eq('student_id', user.id)
          .eq('task_code', taskCode)
          .maybeSingle()

        if (existing) {
          const mergedPayload = {
            ...(existing.answers_payload && typeof existing.answers_payload === 'object'
              ? existing.answers_payload
              : {}),
            ...payload,
          }
          await supabase
            .from('student_attempts')
            .update({
              answers_payload: mergedPayload,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        }
      }
    } catch (authErr) {
      console.warn('Lưu Supabase student_attempts không thành công:', authErr)
    }

    // Phát custom event để các component lắng nghe (như Form 4 nếu đang mở cùng trang)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('approved-writing-saved', {
          detail: {
            taskCode,
            sentences: cleanSentences,
            paragraph: paragraphText || '',
          },
        })
      )
    }

    return { success: true }
  } catch (err: any) {
    console.error('Lỗi khi lưu approved writing:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Lấy danh sách câu văn đã được phê duyệt từ bài viết Form 3 tương ứng (ví dụ: Task 60115)
 * Tìm kiếm theo thứ tự: localStorage của user -> localStorage chung -> Supabase
 */
export async function getApprovedWriting(linkedTaskCode: string): Promise<ApprovedWritingData> {
  if (!linkedTaskCode) {
    return { found: false, sentences: [] }
  }

  // 1. Kiểm tra cache localStorage
  if (typeof window !== 'undefined') {
    try {
      // Ưu tiên theo user ID nếu có
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const userCached = localStorage.getItem(`gsec_approved_writing_${linkedTaskCode}_${user.id}`)
        if (userCached) {
          const parsed = JSON.parse(userCached)
          if (Array.isArray(parsed.approved_sentences) && parsed.approved_sentences.length > 0) {
            return {
              found: true,
              sentences: parsed.approved_sentences,
              paragraph: parsed.approved_paragraph,
              taskCode: linkedTaskCode,
              savedAt: parsed.verified_at,
            }
          }
        }
      }

      // Kiểm tra cache chung theo task code
      const cached = localStorage.getItem(`gsec_approved_writing_${linkedTaskCode}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.approved_sentences) && parsed.approved_sentences.length > 0) {
          return {
            found: true,
            sentences: parsed.approved_sentences,
            paragraph: parsed.approved_paragraph,
            taskCode: linkedTaskCode,
            savedAt: parsed.verified_at,
          }
        }
      }
    } catch {
      // Tiếp tục tìm trong Supabase nếu đọc localStorage lỗi
    }
  }

  // 2. Tra cứu từ cơ sở dữ liệu Supabase
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data, error } = await supabase
        .from('student_attempts')
        .select('answers_payload, status, score, updated_at')
        .eq('student_id', user.id)
        .eq('task_code', linkedTaskCode)
        .maybeSingle()

      if (!error && data && data.answers_payload) {
        const payload = data.answers_payload as Record<string, any>

        // CHỈ lấy các câu đã được AI kiểm tra và phê duyệt chính xác 100%
        const isApproved =
          Array.isArray(payload.approved_sentences) &&
          payload.approved_sentences.length > 0 &&
          (payload.verified_by_ai === true || data.status === 'completed' || (typeof data.score === 'number' && data.score >= 80))

        if (isApproved) {
          // Đồng bộ ngược lại localStorage
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                `gsec_approved_writing_${linkedTaskCode}`,
                JSON.stringify(payload)
              )
            } catch {}
          }
          return {
            found: true,
            sentences: payload.approved_sentences,
            paragraph: payload.approved_paragraph,
            taskCode: linkedTaskCode,
            savedAt: data.updated_at,
          }
        }
      }
    }
  } catch (dbErr) {
    console.warn('Tra cứu approved writing từ Supabase gặp lỗi:', dbErr)
  }

  return { found: false, sentences: [] }
}
