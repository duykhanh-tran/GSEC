-- ================================================================
-- MIGRATION: Nâng cấp Hàm Chấm Điểm (grade_student_attempt)
-- 1. Thêm SECURITY DEFINER để học sinh gọi RPC có thể đọc cấu hình chấm
-- 2. Tự động fallback sang tasks.content nếu chưa có task_assessment_policies
-- 3. Chuẩn hóa so khớp đáp án Form 2 (bỏ dấu câu đuôi, nháy cong, chữ hoa/thường)
-- ================================================================

CREATE OR REPLACE FUNCTION public.grade_student_attempt(
    p_task_code TEXT,
    p_answers JSONB,
    p_attempt_count INT DEFAULT 1,
    p_assignment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_form_type TEXT;
    v_keys_data JSONB := '{}'::jsonb;
    v_hints_data JSONB := '{}'::jsonb;
    v_max_attempts INT := 2;
    v_task_content JSONB;
    v_item JSONB;
    v_idx INT;
    v_key TEXT;
    v_expected_val JSONB;
    v_user_val TEXT;
    v_user_val_clean TEXT;
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
    v_elem JSONB;
    v_elem_str TEXT;
BEGIN
    -- 1. Xác thực học sinh
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để nộp bài.');
    END IF;

    -- 2. Tìm xem học sinh đã có kết quả bài này trước đó chưa
    SELECT id, first_score, attempt_count 
    INTO v_existing_id, v_existing_first_score, v_existing_attempt_count
    FROM public.student_attempts
    WHERE student_id = v_student_id AND task_code = p_task_code;

    IF v_existing_id IS NOT NULL THEN
        v_effective_attempt := COALESCE(v_existing_attempt_count, 1) + 1;
    ELSE
        v_effective_attempt := COALESCE(p_attempt_count, 1);
    END IF;

    -- 3. Lấy thông tin bài tập và chính sách chấm bảo mật
    SELECT form_type, content INTO v_form_type, v_task_content FROM public.tasks WHERE code = p_task_code;
    IF v_form_type IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã bài tập không tồn tại.');
    END IF;

    SELECT keys_data, hints_data, COALESCE(max_attempts, 2)
    INTO v_keys_data, v_hints_data, v_max_attempts
    FROM public.task_assessment_policies
    WHERE task_code = p_task_code;

    -- 4. Tự động phục hồi keys_data từ tasks.content nếu policies chưa cấu hình
    IF v_keys_data IS NULL OR v_keys_data = '{}'::jsonb THEN
        v_keys_data := '{}'::jsonb;
        v_hints_data := COALESCE(v_hints_data, '{}'::jsonb);

        IF v_task_content IS NOT NULL THEN
            IF v_task_content ? 'fields' AND jsonb_typeof(v_task_content->'fields') = 'array' THEN
                v_idx := 1;
                FOR v_item IN SELECT * FROM jsonb_array_elements(v_task_content->'fields')
                LOOP
                    v_key := COALESCE(v_item->>'id', v_idx::text);
                    IF v_item ? 'accepted' THEN
                        v_keys_data := jsonb_set(v_keys_data, ARRAY[v_key], v_item->'accepted');
                    ELSIF v_item ? 'correct' THEN
                        v_keys_data := jsonb_set(v_keys_data, ARRAY[v_key], jsonb_build_array(v_item->>'correct'));
                    ELSIF v_item ? 'correctAnswers' THEN
                        v_keys_data := jsonb_set(v_keys_data, ARRAY[v_key], jsonb_build_array(v_item->>'correctAnswers'));
                    END IF;
                    v_idx := v_idx + 1;
                END LOOP;
            ELSIF v_task_content ? 'items' AND jsonb_typeof(v_task_content->'items') = 'array' THEN
                v_idx := 1;
                FOR v_item IN SELECT * FROM jsonb_array_elements(v_task_content->'items')
                LOOP
                    v_key := COALESCE(v_item->>'id', v_idx::text);
                    IF v_item ? 'accepted' THEN
                        v_keys_data := jsonb_set(v_keys_data, ARRAY[v_key], v_item->'accepted');
                    ELSIF v_item ? 'correct' THEN
                        v_keys_data := jsonb_set(v_keys_data, ARRAY[v_key], jsonb_build_array(v_item->>'correct'));
                    ELSIF v_item ? 'correctAnswers' THEN
                        v_keys_data := jsonb_set(v_keys_data, ARRAY[v_key], jsonb_build_array(v_item->>'correctAnswers'));
                    END IF;
                    v_idx := v_idx + 1;
                END LOOP;
            END IF;
        END IF;
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
    -- LOGIC CHẤM CHO FORM 2: ĐIỀN TỪ / CỤM TỪ (FORM_2_FILL)
    -- ================================================================
    ELSIF v_form_type = 'FORM_2_FILL' THEN
        FOR v_key IN SELECT jsonb_object_keys(v_keys_data)
        LOOP
            v_total := v_total + 1;
            v_user_val := LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_answers->>v_key, '')), '\s+', ' ', 'g'));
            v_user_val := REPLACE(v_user_val, '’', '''');
            v_user_val_clean := RTRIM(v_user_val, '.?!,;:');

            v_expected_val := v_keys_data->v_key;
            v_is_correct := FALSE;

            IF jsonb_typeof(v_expected_val) = 'array' THEN
                FOR v_elem IN SELECT * FROM jsonb_array_elements(v_expected_val)
                LOOP
                    v_elem_str := LOWER(REGEXP_REPLACE(TRIM(TRIM(both '"' from v_elem::text)), '\s+', ' ', 'g'));
                    v_elem_str := REPLACE(v_elem_str, '’', '''');
                    
                    IF v_user_val = v_elem_str OR v_user_val_clean = RTRIM(v_elem_str, '.?!,;:') THEN
                        v_is_correct := TRUE;
                        EXIT;
                    END IF;
                END LOOP;
            ELSE
                v_elem_str := LOWER(REGEXP_REPLACE(TRIM(TRIM(both '"' from v_expected_val::text)), '\s+', ' ', 'g'));
                v_elem_str := REPLACE(v_elem_str, '’', '''');
                IF v_user_val = v_elem_str OR v_user_val_clean = RTRIM(v_elem_str, '.?!,;:') THEN
                    v_is_correct := TRUE;
                END IF;
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
    -- LOGIC CHẤM CHO FORM 5: SẮP XẾP THỨ TỰ (SEQUENCE)
    -- ================================================================
    ELSIF v_form_type = 'FORM_5_SEQUENCE' THEN
        v_total := jsonb_array_length(v_keys_data->'expected_order');
        v_is_correct := TRUE;

        FOR v_seq_idx IN 0..(v_total - 1)
        LOOP
            v_expected_seq := (v_keys_data->'expected_order'->>v_seq_idx)::INT;
            v_user_seq := (p_answers->>v_seq_idx::text)::INT;

            IF v_user_seq IS NULL OR v_user_seq != v_expected_seq THEN
                v_is_correct := FALSE;
                IF v_first_wrong_idx = -1 THEN
                    v_first_wrong_idx := v_seq_idx;
                END IF;
            END IF;
        END LOOP;

        IF v_is_correct THEN
            v_correct := v_total;
            v_results := jsonb_build_object('all_correct', true);
        ELSE
            v_correct := 0;
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

    -- Xác định điểm lần 1
    IF v_existing_first_score IS NOT NULL THEN
        v_first_score := v_existing_first_score;
    ELSE
        v_first_score := v_score;
    END IF;

    -- Lưu tiến độ vào student_attempts
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
            WHEN (student_attempts.status = 'completed' OR EXCLUDED.status = 'completed') 
                 AND student_attempts.completed_at IS NULL THEN NOW() 
            ELSE student_attempts.completed_at 
        END,
        updated_at = NOW();

    -- Trả kết quả JSON cho frontend
    RETURN jsonb_build_object(
        'success', true,
        'task_code', p_task_code,
        'form_type', v_form_type,
        'score', v_score,
        'max_score', 100,
        'correct_count', v_correct,
        'total_count', v_total,
        'is_completed', v_is_completed,
        'attempt_count', v_effective_attempt,
        'results', v_results
    );
END;
$$;

-- Phân quyền thực thi
GRANT EXECUTE ON FUNCTION public.grade_student_attempt TO authenticated, anon;
