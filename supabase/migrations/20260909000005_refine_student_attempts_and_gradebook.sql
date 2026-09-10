-- ====================================================================
-- GSEC AI Tutor - Migration 05: Refine Student Attempts & Gradebook
-- 1. Lưu điểm lần 1 (first_score) cố định, hợp nhất 1 dòng / task
-- 2. Khắc phục ngày 1970 với updated_at và trạng thái hoàn thành
-- 3. Phân quyền RLS: Giáo viên chỉ xem học sinh lớp mình, Admin xem toàn bộ
-- ====================================================================

-- 1. Bổ sung các cột mới vào student_attempts
ALTER TABLE public.student_attempts 
ADD COLUMN IF NOT EXISTS first_score INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cập nhật dữ liệu cũ nếu đang NULL
UPDATE public.student_attempts 
SET first_score = score 
WHERE first_score IS NULL;

UPDATE public.student_attempts 
SET updated_at = COALESCE(completed_at, created_at, NOW()) 
WHERE updated_at IS NULL;

-- 2. Dọn dẹp các dòng trùng lặp trước khi đặt ràng buộc UNIQUE
-- (Tổng hợp bản ghi tốt nhất: điểm lần 1 từ bản ghi đầu tiên, điểm cao nhất, trạng thái hoàn thành)
DO $$
DECLARE
    r RECORD;
    v_target_id UUID;
BEGIN
    FOR r IN 
        SELECT student_id, task_code, 
               (ARRAY_AGG(score ORDER BY created_at ASC))[1] AS early_score,
               MAX(score) AS max_sc,
               MAX(attempt_count) AS max_att,
               BOOL_OR(status = 'completed') AS is_comp,
               MAX(completed_at) AS comp_at,
               MAX(created_at) AS last_act
        FROM public.student_attempts
        GROUP BY student_id, task_code
        HAVING COUNT(*) > 1
    LOOP
        -- Chọn 1 bản ghi chính để giữ lại
        SELECT id INTO v_target_id 
        FROM public.student_attempts 
        WHERE student_id = r.student_id AND task_code = r.task_code 
        ORDER BY (status = 'completed') DESC, score DESC, created_at DESC 
        LIMIT 1;

        -- Cập nhật bản ghi chính với dữ liệu tổng hợp
        UPDATE public.student_attempts
        SET first_score = r.early_score,
            score = r.max_sc,
            attempt_count = GREATEST(r.max_att, 1),
            status = CASE WHEN r.is_comp THEN 'completed' ELSE 'in_progress' END,
            completed_at = r.comp_at,
            updated_at = r.last_act
        WHERE id = v_target_id;

        -- Xóa các bản ghi trùng thừa còn lại
        DELETE FROM public.student_attempts
        WHERE student_id = r.student_id 
          AND task_code = r.task_code
          AND id != v_target_id;
    END LOOP;
END $$;

-- Tạo ràng buộc UNIQUE cho (student_id, task_code)
ALTER TABLE public.student_attempts 
DROP CONSTRAINT IF EXISTS student_attempts_student_task_unique;

ALTER TABLE public.student_attempts 
ADD CONSTRAINT student_attempts_student_task_unique UNIQUE (student_id, task_code);

-- 3. Hàm hỗ trợ phân quyền vai trò (Admin & Giáo viên)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.class_students cs ON cs.class_id = c.id
    WHERE c.teacher_id = auth.uid()
      AND cs.student_id = p_student_id
  );
$$;

-- 4. Cập nhật Row Level Security (RLS) cho student_attempts
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Giáo viên xem bài học sinh lớp mình" ON public.student_attempts;
DROP POLICY IF EXISTS "Học sinh xem bài của chính mình" ON public.student_attempts;
DROP POLICY IF EXISTS "Học sinh nộp bài của mình" ON public.student_attempts;
DROP POLICY IF EXISTS "student_attempts_select" ON public.student_attempts;
DROP POLICY IF EXISTS "student_attempts_insert" ON public.student_attempts;
DROP POLICY IF EXISTS "student_attempts_update" ON public.student_attempts;

-- SELECT:
-- 1. Học sinh chỉ xem bài của chính mình (student_id = auth.uid())
-- 2. Giáo viên chỉ xem điểm học sinh thuộc lớp mình dạy (is_teacher_of_student)
-- 3. Admin có toàn quyền xem toàn bộ bảng điểm trong hệ thống (is_admin)
CREATE POLICY "student_attempts_select" ON public.student_attempts
FOR SELECT TO authenticated
USING (
    student_id = auth.uid() 
    OR public.is_admin() 
    OR public.is_teacher_of_student(student_id)
);

CREATE POLICY "student_attempts_insert" ON public.student_attempts
FOR INSERT TO authenticated
WITH CHECK (
    student_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "student_attempts_update" ON public.student_attempts
FOR UPDATE TO authenticated
USING (
    student_id = auth.uid() OR public.is_admin()
)
WITH CHECK (
    student_id = auth.uid() OR public.is_admin()
);

-- 5. Nâng cấp Hàm Chấm Điểm & Lưu Tiến Độ Tự Động (grade_student_attempt)
CREATE OR REPLACE FUNCTION public.grade_student_attempt(
    p_task_code TEXT,
    p_answers JSONB,
    p_attempt_count INT DEFAULT 1,
    p_assignment_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_student_id UUID;
    v_form_type TEXT;
    v_keys_data JSONB;
    v_hints_data JSONB;
    v_max_attempts INT := 2;
    v_key TEXT;
    v_expected_val JSONB;
    v_user_val TEXT;
    v_is_correct BOOLEAN;
    v_hint TEXT;
    v_results JSONB := '{}'::jsonb;
    v_total INT := 0;
    v_correct INT := 0;
    v_score INT := 0;
    v_is_completed BOOLEAN := FALSE;
    v_first_wrong_idx INT := -1;
    v_seq_idx INT;
    v_expected_seq INT;
    v_user_seq INT;

    -- Biến theo dõi tiến độ & điểm lần 1
    v_existing_id UUID;
    v_existing_first_score INT;
    v_existing_attempt_count INT;
    v_effective_attempt INT;
    v_first_score INT;
BEGIN
    -- Xác thực học sinh
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để nộp bài.');
    END IF;

    -- Tìm xem học sinh đã có kết quả bài này trước đó chưa
    SELECT id, first_score, attempt_count 
    INTO v_existing_id, v_existing_first_score, v_existing_attempt_count
    FROM public.student_attempts
    WHERE student_id = v_student_id AND task_code = p_task_code;

    IF v_existing_id IS NOT NULL THEN
        v_effective_attempt := COALESCE(v_existing_attempt_count, 1) + 1;
    ELSE
        v_effective_attempt := COALESCE(p_attempt_count, 1);
    END IF;

    -- Lấy thông tin bài tập và chính sách chấm bảo mật
    SELECT form_type INTO v_form_type FROM public.tasks WHERE code = p_task_code;
    IF v_form_type IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã bài tập không tồn tại.');
    END IF;

    SELECT keys_data, hints_data, COALESCE(max_attempts, 2)
    INTO v_keys_data, v_hints_data, v_max_attempts
    FROM public.task_assessment_policies
    WHERE task_code = p_task_code;

    IF v_keys_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Chưa có cấu hình chấm điểm cho bài tập này.');
    END IF;

    -- ================================================================
    -- LOGIC CHẤM CHO FORM 1: TRẮC NGHIỆM (A/B/C hoặc T/F)
    -- ================================================================
    IF v_form_type = 'FORM_1_CHOICE' THEN
        FOR v_key IN SELECT jsonb_object_keys(v_keys_data)
        LOOP
            v_total := v_total + 1;
            v_user_val := UPPER(TRIM(COALESCE(p_answers->>v_key, '')));
            
            IF jsonb_typeof(v_keys_data->v_key) = 'object' THEN
                v_expected_val := v_keys_data->v_key->'key';
            ELSE
                v_expected_val := v_keys_data->v_key;
            END IF;

            IF v_user_val = UPPER(TRIM(TRIM(both '"' from v_expected_val::text))) THEN
                v_is_correct := TRUE;
                v_correct := v_correct + 1;
                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object('correct', true));
            ELSE
                v_is_correct := FALSE;
                IF v_effective_attempt <= 1 THEN
                    v_hint := COALESCE(v_hints_data->v_key->>'h1', 'Hãy xem lại câu hỏi và kiểm tra dữ kiện trong bài.');
                ELSE
                    v_hint := COALESCE(v_hints_data->v_key->>'h2', v_hints_data->v_key->>'h1', 'Hãy đọc kỹ lại gợi ý.');
                END IF;

                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object(
                    'correct', false,
                    'hint', v_hint
                ));
            END IF;
        END LOOP;

    -- ================================================================
    -- LOGIC CHẤM CHO FORM 2: ĐIỀN TỪ / CỤM TỪ
    -- ================================================================
    ELSIF v_form_type = 'FORM_2_FILL' THEN
        FOR v_key IN SELECT jsonb_object_keys(v_keys_data)
        LOOP
            v_total := v_total + 1;
            v_user_val := LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_answers->>v_key, '')), '\s+', ' ', 'g'));
            v_expected_val := v_keys_data->v_key;

            IF jsonb_typeof(v_expected_val) = 'array' THEN
                v_is_correct := (v_expected_val @> to_jsonb(v_user_val));
            ELSE
                v_is_correct := (v_user_val = LOWER(TRIM(TRIM(both '"' from v_expected_val::text))));
            END IF;

            IF v_is_correct THEN
                v_correct := v_correct + 1;
                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object('correct', true));
            ELSE
                IF v_effective_attempt <= 1 THEN
                    v_hint := COALESCE(v_hints_data->v_key->>'h1', 'Xem lại từ vựng cần điền.');
                ELSE
                    v_hint := COALESCE(v_hints_data->v_key->>'h2', v_hints_data->v_key->>'h1', 'Xem kỹ quy tắc ngữ pháp.');
                END IF;

                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object(
                    'correct', false,
                    'hint', v_hint
                ));
            END IF;
        END LOOP;

    -- ================================================================
    -- LOGIC CHẤM CHO FORM 4: SỬA LỖI CÂU & NGỮ PHÁP
    -- ================================================================
    ELSIF v_form_type = 'FORM_4_SENTENCE_REPAIR' THEN
        FOR v_key IN SELECT jsonb_object_keys(v_keys_data)
        LOOP
            v_total := v_total + 1;
            v_user_val := LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_answers->>v_key, '')), '\s+', ' ', 'g'));
            v_user_val := RTRIM(v_user_val, '.?!');

            v_expected_val := v_keys_data->v_key->'fixed';
            IF v_expected_val IS NULL THEN
                v_expected_val := v_keys_data->v_key;
            END IF;

            IF v_user_val = LOWER(RTRIM(TRIM(both '"' from v_expected_val::text), '.?!')) THEN
                v_correct := v_correct + 1;
                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object('correct', true));
            ELSE
                IF v_effective_attempt <= 1 THEN
                    v_hint := COALESCE(v_hints_data->v_key->>'h1', v_keys_data->v_key->>'cue', 'Chú ý cấu trúc câu.');
                ELSE
                    v_hint := COALESCE(v_hints_data->v_key->>'h2', v_hints_data->v_key->>'h1', 'Xem lại quy tắc chia động từ.');
                END IF;

                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object(
                    'correct', false,
                    'hint', v_hint
                ));
            END IF;
        END LOOP;

    -- ================================================================
    -- LOGIC CHẤM CHO FORM 5: SẮP XẾP TRẬT TỰ ĐOẠN VĂN
    -- ================================================================
    ELSIF v_form_type = 'FORM_5_SEQUENCE' THEN
        v_total := jsonb_array_length(v_keys_data);
        FOR v_seq_idx IN 0..(v_total - 1)
        LOOP
            v_expected_seq := (v_keys_data->>v_seq_idx)::INT;
            v_user_seq := (p_answers->>v_seq_idx)::INT;

            IF v_expected_seq = v_user_seq THEN
                v_correct := v_correct + 1;
                v_results := jsonb_set(v_results, ARRAY[v_seq_idx::text], jsonb_build_object('correct', true));
            ELSE
                IF v_first_wrong_idx = -1 AND v_seq_idx > 0 THEN
                    v_first_wrong_idx := v_seq_idx;
                END IF;
                v_results := jsonb_set(v_results, ARRAY[v_seq_idx::text], jsonb_build_object('correct', false));
            END IF;
        END LOOP;

        IF v_first_wrong_idx != -1 THEN
            IF v_effective_attempt <= 1 THEN
                v_hint := COALESCE(v_hints_data->v_first_wrong_idx::text->>'first', 'Chú ý từ nối liên kết ý giữa các câu.');
            ELSE
                v_hint := COALESCE(v_hints_data->v_first_wrong_idx::text->>'second', 'Xem lại danh từ hoặc đại từ thay thế ở câu trước.');
            END IF;
            v_results := jsonb_set(v_results, ARRAY['active_repair'], jsonb_build_object(
                'position', v_first_wrong_idx,
                'hint', v_hint
            ));
        END IF;
    END IF;

    -- Tính điểm phần trăm
    IF v_total > 0 THEN
        v_score := ROUND((v_correct::numeric / v_total::numeric) * 100);
    ELSE
        v_score := 0;
    END IF;

    v_is_completed := (v_correct = v_total) OR (v_effective_attempt >= v_max_attempts);

    -- Xác định điểm lần 1: nếu đã có từ trước thì giữ nguyên, nếu chưa có thì gán v_score
    IF v_existing_first_score IS NOT NULL THEN
        v_first_score := v_existing_first_score;
    ELSE
        v_first_score := v_score;
    END IF;

    -- Tự động Lưu hoặc Cập nhật duy nhất 1 bản ghi vào student_attempts (Upsert)
    INSERT INTO public.student_attempts (
        student_id,
        task_code,
        assignment_id,
        status,
        first_score,
        score,
        max_score,
        attempt_count,
        answers_payload,
        completed_at,
        updated_at
    ) VALUES (
        v_student_id,
        p_task_code,
        p_assignment_id,
        CASE WHEN v_is_completed THEN 'completed' ELSE 'in_progress' END,
        v_first_score,
        v_score,
        100,
        v_effective_attempt,
        p_answers,
        CASE WHEN v_is_completed THEN NOW() ELSE NULL END,
        NOW()
    )
    ON CONFLICT (student_id, task_code) DO UPDATE SET
        assignment_id = COALESCE(EXCLUDED.assignment_id, student_attempts.assignment_id),
        first_score = COALESCE(student_attempts.first_score, EXCLUDED.first_score),
        score = EXCLUDED.score,
        attempt_count = EXCLUDED.attempt_count,
        status = CASE 
            WHEN student_attempts.status = 'completed' OR EXCLUDED.status = 'completed' THEN 'completed' 
            ELSE 'in_progress' 
        END,
        answers_payload = EXCLUDED.answers_payload,
        completed_at = CASE 
            WHEN student_attempts.completed_at IS NOT NULL THEN student_attempts.completed_at
            WHEN EXCLUDED.status = 'completed' THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'task_code', p_task_code,
        'form_type', v_form_type,
        'score', v_score,
        'first_score', v_first_score,
        'max_score', 100,
        'correct_count', v_correct,
        'total_count', v_total,
        'is_completed', v_is_completed,
        'attempt_count', v_effective_attempt,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.grade_student_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student TO authenticated;

-- Đảm bảo publication Realtime cho student_attempts
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_attempts;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
