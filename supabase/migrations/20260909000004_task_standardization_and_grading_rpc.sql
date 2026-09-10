-- ====================================================================
-- GSEC AI Tutor - Task Standardization, Assessment Policies & Grading RPC
-- ====================================================================

-- 1. Cập nhật bảng public.tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS form_type TEXT DEFAULT 'FORM_1_CHOICE';

-- 2. Đảm bảo bảo mật tối mật cho public.task_assessment_policies
-- CHỈ ADMIN và Server-side (SECURITY DEFINER) mới được phép đọc đáp án
ALTER TABLE public.task_assessment_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chỉ Admin mới có quyền xem chính sách chấm" ON public.task_assessment_policies;
DROP POLICY IF EXISTS "task_assessment_admin_only" ON public.task_assessment_policies;

CREATE POLICY "task_assessment_admin_only" ON public.task_assessment_policies
FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 3. Hàm Chấm Điểm & Phân Phối Gợi Ý Sư Phạm Bảo Mật (grade_student_attempt)
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
BEGIN
    -- Xác thực học sinh
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để nộp bài.');
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
            
            -- Lấy đáp án đúng (hỗ trợ cả dạng string "A" hoặc object {"key": "A"})
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
                -- Cấp gợi ý h1 (lần 1) hoặc h2 (lần 2 trở đi)
                IF p_attempt_count <= 1 THEN
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

            -- Hỗ trợ mảng các từ đồng nghĩa (ví dụ: ["school", "a school"]) hoặc từ đơn
            IF jsonb_typeof(v_expected_val) = 'array' THEN
                v_is_correct := (v_expected_val @> to_jsonb(v_user_val));
            ELSE
                v_is_correct := (v_user_val = LOWER(TRIM(TRIM(both '"' from v_expected_val::text))));
            END IF;

            IF v_is_correct THEN
                v_correct := v_correct + 1;
                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object('correct', true));
            ELSE
                IF p_attempt_count <= 1 THEN
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
            -- Chuẩn hóa bỏ dấu chấm câu cuối khi so sánh
            v_user_val := RTRIM(v_user_val, '.?!');

            -- Expected sentence
            v_expected_val := v_keys_data->v_key->'fixed';
            IF v_expected_val IS NULL THEN
                v_expected_val := v_keys_data->v_key;
            END IF;

            IF v_user_val = LOWER(RTRIM(TRIM(both '"' from v_expected_val::text), '.?!')) THEN
                v_correct := v_correct + 1;
                v_results := jsonb_set(v_results, ARRAY[v_key], jsonb_build_object('correct', true));
            ELSE
                IF p_attempt_count <= 1 THEN
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

        -- Gán gợi ý liên kết cho vị trí sai đầu tiên
        IF v_first_wrong_idx != -1 THEN
            IF p_attempt_count <= 1 THEN
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

    v_is_completed := (v_correct = v_total) OR (p_attempt_count >= v_max_attempts);

    -- Tự động lưu hoặc cập nhật tiến độ vào student_attempts
    INSERT INTO public.student_attempts (
        student_id,
        task_code,
        assignment_id,
        status,
        score,
        max_score,
        attempt_count,
        answers_payload,
        completed_at
    ) VALUES (
        v_student_id,
        p_task_code,
        p_assignment_id,
        CASE WHEN v_is_completed THEN 'completed' ELSE 'in_progress' END,
        v_score,
        100,
        p_attempt_count,
        p_answers,
        CASE WHEN v_is_completed THEN NOW() ELSE NULL END
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_code', p_task_code,
        'form_type', v_form_type,
        'score', v_score,
        'max_score', 100,
        'correct_count', v_correct,
        'total_count', v_total,
        'is_completed', v_is_completed,
        'attempt_count', p_attempt_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.grade_student_attempt TO authenticated;

-- ====================================================================
-- NẠP DỮ LIỆU MẪU ĐẠI DIỆN CHO CÁC FORM CHUẨN HÓA
-- ====================================================================

-- 1. Bài 60113 (FORM 1: Trắc nghiệm A/B/C)
INSERT INTO public.tasks (code, worksheet, task_number, title, subtitle, archetypes, form_type, content)
VALUES (
    '60113', 1, 3, 'AI Tutor • WS 1 - Task 3', 'Unit 1 · My New School',
    ARRAY['listening', 'choice-assessment', 'retry-coaching'],
    'FORM_1_CHOICE',
    '{
        "intro": "Check Task 3. Enter your A, B or C answers.",
        "note": "Use the worksheet questions while entering your choices.",
        "options": ["A", "B", "C"],
        "items": [
            { "id": 1, "label": "Question 1", "cue": "Look back at Question 1." },
            { "id": 2, "label": "Question 2", "cue": "Look back at Question 2." },
            { "id": 3, "label": "Question 3", "cue": "Look back at Question 3." },
            { "id": 4, "label": "Question 4", "cue": "Look back at Question 4." },
            { "id": 5, "label": "Question 5", "cue": "Look back at Question 5." },
            { "id": 6, "label": "Question 6", "cue": "Look back at Question 6." }
        ]
    }'::jsonb
) ON CONFLICT (code) DO UPDATE SET 
    form_type = EXCLUDED.form_type,
    content = EXCLUDED.content;

INSERT INTO public.task_assessment_policies (task_code, max_attempts, keys_data, hints_data)
VALUES (
    '60113', 2,
    '{ "1": "A", "2": "B", "3": "B", "4": "B", "5": "C", "6": "C" }'::jsonb,
    '{
        "1": { "h1": "What do we use to draw a straight line?", "h2": "A ruler helps us draw a straight line." },
        "2": { "h1": "What removes a pencil mark?", "h2": "A rubber removes pencil marks." },
        "3": { "h1": "Where do we keep pens and pencils?", "h2": "A pencil case keeps pens and pencils together." },
        "4": { "h1": "Mai wants to add two large numbers quickly. What tool helps with calculations?", "h2": "A calculator helps with calculations." },
        "5": { "h1": "What is the problem with Nam’s pencil?", "h2": "Which school thing makes a pencil sharp?" },
        "6": { "h1": "What does Mai already have for the straight line?", "h2": "A ruler is for the straight line. What does she still need for the circle?" }
    }'::jsonb
) ON CONFLICT (task_code) DO UPDATE SET 
    keys_data = EXCLUDED.keys_data,
    hints_data = EXCLUDED.hints_data;

-- 2. Bài 60114 (FORM 1: Trắc nghiệm True / False)
INSERT INTO public.tasks (code, worksheet, task_number, title, subtitle, archetypes, form_type, content)
VALUES (
    '60114', 1, 4, 'AI Tutor • WS 1 - Task 4', 'Unit 1 · My New School',
    ARRAY['choice-assessment', 'retry-coaching'],
    'FORM_1_CHOICE',
    '{
        "intro": "Check Task 4. Enter your True or False answers.",
        "note": "Use evidence from the reading passage.",
        "options": ["T", "F"],
        "items": [
            { "id": 1, "label": "Question 1", "cue": "Look back at statement 1." },
            { "id": 2, "label": "Question 2", "cue": "Look back at statement 2." },
            { "id": 3, "label": "Question 3", "cue": "Look back at statement 3." },
            { "id": 4, "label": "Question 4", "cue": "Look back at statement 4." }
        ]
    }'::jsonb
) ON CONFLICT (code) DO UPDATE SET 
    form_type = EXCLUDED.form_type,
    content = EXCLUDED.content;

INSERT INTO public.task_assessment_policies (task_code, max_attempts, keys_data, hints_data)
VALUES (
    '60114', 2,
    '{ "1": "T", "2": "F", "3": "T", "4": "F" }'::jsonb,
    '{
        "1": { "h1": "Find the sentence about Nam’s first day.", "h2": "Check whether the statement says the same thing as the text." },
        "2": { "h1": "Find the sentence about how Nam feels.", "h2": "The text says Nam is excited. Does that match the statement?" },
        "3": { "h1": "Find the sentence about the things in Nam’s school bag.", "h2": "Compare the statement with the items named in the text." },
        "4": { "h1": "Find the sentence near the end of the passage.", "h2": "The statement changes one detail from the text. Check that detail again." }
    }'::jsonb
) ON CONFLICT (task_code) DO UPDATE SET 
    keys_data = EXCLUDED.keys_data,
    hints_data = EXCLUDED.hints_data;

-- 3. Bài 60111 (FORM 2: Điền từ & Cụm từ)
INSERT INTO public.tasks (code, worksheet, task_number, title, subtitle, archetypes, form_type, content)
VALUES (
    '60111', 1, 1, 'AI Tutor • WS 1 - Task 1', 'Unit 1 · My New School',
    ARRAY['answer-entry', 'retry-coaching'],
    'FORM_2_FILL',
    '{
        "intro": "Check Task 1. Enter your answers from the worksheet.",
        "note": "Enter your answers below.",
        "fields": [
            { "id": "q1", "label": "1", "placeholder": "Your answer" },
            { "id": "q2", "label": "2", "placeholder": "Your answer", "inputMode": "numeric" },
            { "id": "q3", "label": "3", "placeholder": "Your answer" },
            { "id": "q4a", "label": "4a", "placeholder": "Thing 1" },
            { "id": "q4b", "label": "4b", "placeholder": "Thing 2" }
        ]
    }'::jsonb
) ON CONFLICT (code) DO UPDATE SET 
    form_type = EXCLUDED.form_type,
    content = EXCLUDED.content;

INSERT INTO public.task_assessment_policies (task_code, max_attempts, keys_data, hints_data)
VALUES (
    '60111', 2,
    '{
        "q1": ["school", "a school"],
        "q2": ["3", "three"],
        "q3": ["excited"],
        "q4a": ["ruler", "compass", "pencil sharpener", "rubber", "pencil case", "calculator", "school bag", "notebook", "book", "textbook", "pen", "pencil"],
        "q4b": ["ruler", "compass", "pencil sharpener", "rubber", "pencil case", "calculator", "school bag", "notebook", "book", "textbook", "pen", "pencil"]
    }'::jsonb,
    '{
        "q1": { "h1": "Where are the students on their first day?", "h2": "Find the place word in Getting Started." },
        "q2": { "h1": "Count the students who are speaking.", "h2": "Count the speakers again." },
        "q3": { "h1": "Find the feeling word about their first day.", "h2": "Look for the feeling word in the lesson." },
        "q4a": { "h1": "Choose one school thing from the lesson.", "h2": "Use a school thing from the lesson." },
        "q4b": { "h1": "Choose a different school thing.", "h2": "Use another school thing." }
    }'::jsonb
) ON CONFLICT (task_code) DO UPDATE SET 
    keys_data = EXCLUDED.keys_data,
    hints_data = EXCLUDED.hints_data;

-- 4. Bài 60163 (FORM 4: Sửa lỗi câu & Ngữ pháp)
INSERT INTO public.tasks (code, worksheet, task_number, title, subtitle, archetypes, form_type, content)
VALUES (
    '60163', 6, 3, 'AI Tutor • WS 6 - Task 3', 'Sentence Building · Grammar Check',
    ARRAY['writing-repair'],
    'FORM_4_SENTENCE_REPAIR',
    '{
        "intro": "Sentence Building. Read the sentence with mistakes and type the correct sentence.",
        "items": [
            { "id": "1", "first": "Our school has a large playground.", "type": "Statement" },
            { "id": "2", "first": "We not have classes on Sunday.", "type": "Negative" },
            { "id": "3", "first": "Does your school have a computer room?", "type": "Yes/No Question" },
            { "id": "4", "first": "I do my homework usually after school.", "type": "Frequency Position" },
            { "id": "5", "first": "What do students do at break time?", "type": "Wh-question" }
        ]
    }'::jsonb
) ON CONFLICT (code) DO UPDATE SET 
    form_type = EXCLUDED.form_type,
    content = EXCLUDED.content;

INSERT INTO public.task_assessment_policies (task_code, max_attempts, keys_data, hints_data)
VALUES (
    '60163', 2,
    '{
        "1": { "fixed": "Our school has a large playground." },
        "2": { "fixed": "We do not have classes on Sunday." },
        "3": { "fixed": "Does your school have a computer room?" },
        "4": { "fixed": "I usually do my homework after school." },
        "5": { "fixed": "What do students do at break time?" }
    }'::jsonb,
    '{
        "1": { "h1": "Check the basic statement order: subject → verb → complement.", "h2": "Our school + has + a large playground." },
        "2": { "h1": "For a present-simple negative with “we”, use do not + base verb.", "h2": "We do not have classes on Sunday." },
        "3": { "h1": "A present-simple yes/no question starts with Does, then subject, then base verb.", "h2": "Does your school have a computer room?" },
        "4": { "h1": "The frequency word usually goes before the main verb.", "h2": "I usually do my homework after school." },
        "5": { "h1": "Use: question word → do → subject → base verb.", "h2": "What do students do at break time?" }
    }'::jsonb
) ON CONFLICT (task_code) DO UPDATE SET 
    keys_data = EXCLUDED.keys_data,
    hints_data = EXCLUDED.hints_data;

-- 5. Bài 60164 (FORM 5: Sắp xếp trật tự đoạn văn)
INSERT INTO public.tasks (code, worksheet, task_number, title, subtitle, archetypes, form_type, content)
VALUES (
    '60164', 6, 4, 'AI Tutor • WS 6 - Task 4', 'Paragraph Organisation · Cohesion',
    ARRAY['sequence-ordering', 'retry-coaching'],
    'FORM_5_SEQUENCE',
    '{
        "intro": "Arrange the paragraph in your worksheet first. Sentence 4 is already first. Then enter your order here.",
        "fixed_first": 4,
        "total_slots": 5,
        "choices": [1, 2, 3, 5]
    }'::jsonb
) ON CONFLICT (code) DO UPDATE SET 
    form_type = EXCLUDED.form_type,
    content = EXCLUDED.content;

INSERT INTO public.task_assessment_policies (task_code, max_attempts, keys_data, hints_data)
VALUES (
    '60164', 2,
    '[4, 2, 5, 1, 3]'::jsonb,
    '{
        "1": { "first": "Sentence 4 introduces the school. Which sentence can refer back to the school with “It”?", "second": "Look for the sentence that continues from the school introduction." },
        "2": { "first": "Now follow the new noun in that sentence.", "second": "The previous sentence introduces the playground. Which sentence refers to that place directly?" },
        "3": { "first": "Look for the sentence that uses “there”.", "second": "“There” should refer to the playground that has just been mentioned." },
        "4": { "first": "The last sentence should connect to the activity just mentioned.", "second": "Look for the sentence that uses “This activity” to refer back to playing badminton." }
    }'::jsonb
) ON CONFLICT (task_code) DO UPDATE SET 
    keys_data = EXCLUDED.keys_data,
    hints_data = EXCLUDED.hints_data;
