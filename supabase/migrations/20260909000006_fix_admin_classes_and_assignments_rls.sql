-- ====================================================================
-- GSEC AI Tutor - Migration 06: Fix Admin Classes & Assignments RLS
-- Đảm bảo Quản trị viên (ADMIN) có toàn quyền xem và quản lý
-- tất cả các lớp học do bất kỳ Giáo viên nào tạo ra, cùng các bài tập được giao
-- ====================================================================

-- 1. Đảm bảo hàm public.is_admin() luôn khả dụng và an toàn
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

GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- 2. Cập nhật RLS cho bảng public.classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_teacher_all" ON public.classes;
DROP POLICY IF EXISTS "Giáo viên quản lý lớp của mình" ON public.classes;
DROP POLICY IF EXISTS "Học sinh xem lớp mình tham gia" ON public.classes;
DROP POLICY IF EXISTS "classes_student_select" ON public.classes;
DROP POLICY IF EXISTS "classes_teacher_admin_all" ON public.classes;

-- Admin có toàn quyền với mọi lớp; Giáo viên quản lý lớp của mình
CREATE POLICY "classes_teacher_admin_all" ON public.classes
FOR ALL TO authenticated
USING (
    teacher_id = auth.uid() 
    OR public.is_admin()
)
WITH CHECK (
    teacher_id = auth.uid() 
    OR public.is_admin()
);

-- Học sinh xem các lớp mà mình đã tham gia
CREATE POLICY "classes_student_select" ON public.classes
FOR SELECT TO authenticated
USING (
    public.is_class_student(id)
);

-- 3. Cập nhật RLS cho bảng public.assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Xem assignment của lớp mình" ON public.assignments;
DROP POLICY IF EXISTS "assignments_all" ON public.assignments;
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_admin_teacher_all" ON public.assignments;

CREATE POLICY "assignments_admin_teacher_all" ON public.assignments
FOR ALL TO authenticated
USING (
    public.is_admin()
    OR assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes WHERE id = assignments.class_id AND teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.class_students WHERE class_id = assignments.class_id AND student_id = auth.uid())
)
WITH CHECK (
    public.is_admin()
    OR assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes WHERE id = assignments.class_id AND teacher_id = auth.uid())
);

-- 4. Cập nhật RLS cho bảng public.class_students
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_students_teacher_all" ON public.class_students;
DROP POLICY IF EXISTS "Giáo viên quản lý học sinh trong lớp" ON public.class_students;
DROP POLICY IF EXISTS "class_students_admin_teacher_all" ON public.class_students;

CREATE POLICY "class_students_admin_teacher_all" ON public.class_students
FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.is_class_teacher(class_id)
)
WITH CHECK (
    public.is_admin()
    OR public.is_class_teacher(class_id)
);

-- 5. Đảm bảo toàn bộ 32 bài tập trong catalog có trong bảng public.tasks
-- để không bị lỗi Foreign Key khi Admin hoặc Giáo viên giao bài
INSERT INTO public.tasks (code, worksheet, task_number, title, subtitle, archetypes, form_type)
VALUES
    ('60111', 1, 1, 'AI Tutor • WS 1 - Task 1', 'Unit 1 · My New School', ARRAY['answer-entry', 'retry-coaching'], 'FORM_2_FILL'),
    ('60112', 1, 2, 'AI Tutor • WS 1 - Task 2', 'Unit 1 · My New School', ARRAY['listening', 'speech-recording', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60113', 1, 3, 'AI Tutor • WS 1 - Task 3', 'Unit 1 · My New School', ARRAY['listening', 'choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60114', 1, 4, 'AI Tutor • WS 1 - Task 4', 'Unit 1 · My New School', ARRAY['listening', 'choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60115', 1, 5, 'AI Tutor • WS 1 - Task 5', 'Writing', ARRAY['writing-repair', 'listening'], 'FORM_4_SENTENCE_REPAIR'),
    ('60116', 1, 6, 'AI Tutor • WS 1 - Task 6', 'Study with AI', ARRAY['speech-recording', 'transcript-repair', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60121', 2, 1, 'AI Tutor • WS 2 - Task 1', 'Unit 1 · My New School', ARRAY['answer-entry', 'retry-coaching'], 'FORM_2_FILL'),
    ('60122', 2, 2, 'AI Tutor • WS 2 - Task 2', 'Unit 1 · My New School', ARRAY['choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60123', 2, 3, 'AI Tutor • WS 2 - Task 3', 'Listening & Pronunciation', ARRAY['listening', 'choice-assessment', 'speech-recording'], 'FORM_1_CHOICE'),
    ('60124', 2, 4, 'AI Tutor • WS 2 - Task 4', 'Sentence Fluency', ARRAY['speech-recording', 'transcript-repair'], 'FORM_4_SENTENCE_REPAIR'),
    ('60125', 2, 5, 'AI Tutor • WS 2 - Task 5', 'Read from your book · AI checks your sentences', ARRAY['speech-recording', 'transcript-repair'], 'FORM_4_SENTENCE_REPAIR'),
    ('60126', 2, 6, 'AI Tutor • WS 2 - Task 6', 'Priority Review · Mastery Check', ARRAY['choice-assessment', 'retry-coaching', 'mastery-review'], 'FORM_1_CHOICE'),
    ('60131', 3, 1, 'AI Tutor • WS 3 - Task 1', 'Present Simple · Form First', ARRAY['answer-entry', 'retry-coaching'], 'FORM_2_FILL'),
    ('60132', 3, 2, 'AI Tutor • WS 3 - Task 2', 'Form & Meaning in Context', ARRAY['choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60133', 3, 3, 'AI Tutor • WS 3 - Task 3', 'Frequency Words · Position', ARRAY['choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60134', 3, 4, 'AI Tutor • WS 3 - Task 4', 'Frequency Meaning · School Week', ARRAY['choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60135', 3, 5, 'AI Tutor • WS 3 - Task 5', 'Personal Writing · STT Grammar Check', ARRAY['speech-recording', 'transcript-repair', 'writing-repair'], 'FORM_4_SENTENCE_REPAIR'),
    ('60141', 4, 1, 'AI Tutor • WS 4 - Task 1', 'Everyday English · Functional Phrases', ARRAY['answer-entry', 'retry-coaching'], 'FORM_2_FILL'),
    ('60142', 4, 2, 'AI Tutor • WS 4 - Task 2', 'Meaning & Appropriacy', ARRAY['choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60143', 4, 3, 'AI Tutor • WS 4 - Task 3', 'Supported Dialogue · STT Check', ARRAY['role-play', 'speech-recording', 'transcript-repair'], 'FORM_1_CHOICE'),
    ('60144', 4, 4, 'AI Tutor • WS 4 - Task 4', 'AI Role-play · Communication', ARRAY['role-play', 'speech-recording', 'transcript-repair', 'mastery-review'], 'FORM_1_CHOICE'),
    ('60151', 5, 1, 'AI Tutor • WS 5 - Task 1', 'Read for the Big Idea', ARRAY['reading-comprehension', 'choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60152', 5, 2, 'AI Tutor • WS 5 - Task 2', 'Reading Comprehension · Details & Meaning', ARRAY['reading-comprehension', 'choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60153', 5, 3, 'AI Tutor • WS 5 - Task 3', 'Conversation · Discourse Cohesion', ARRAY['reading-comprehension', 'answer-entry', 'retry-coaching'], 'FORM_2_FILL'),
    ('60154', 5, 4, 'AI Tutor • WS 5 - Task 4', 'Speaking Plan · Readiness Check', ARRAY['readiness-checklist'], 'FORM_1_CHOICE'),
    ('60155', 5, 5, 'AI Tutor • WS 5 - Task 5', 'AI Speaking · My School Choice', ARRAY['role-play', 'speech-recording', 'transcript-repair', 'mastery-review'], 'FORM_1_CHOICE'),
    ('60161', 6, 1, 'AI Tutor • WS 6 - Task 1', 'Listening · True or False', ARRAY['listening', 'listening-assessment', 'choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60162', 6, 2, 'AI Tutor • WS 6 - Task 2', 'Listening · Meaning & Detail', ARRAY['listening', 'listening-assessment', 'choice-assessment', 'retry-coaching'], 'FORM_1_CHOICE'),
    ('60163', 6, 3, 'AI Tutor • WS 6 - Task 3', 'Sentence Building · STT Check', ARRAY['speech-recording', 'transcript-repair', 'writing-repair'], 'FORM_4_SENTENCE_REPAIR'),
    ('60164', 6, 4, 'AI Tutor • WS 6 - Task 4', 'Paragraph Organisation · Cohesion', ARRAY['sequence-ordering', 'retry-coaching', 'writing-repair'], 'FORM_5_SEQUENCE'),
    ('60165', 6, 5, 'AI Tutor • WS 6 - Task 5', 'Independent Writing · My School', ARRAY['writing-readiness', 'readiness-checklist'], 'FORM_1_CHOICE'),
    ('60166', 6, 6, 'AI Tutor • WS 6 - Task 6', 'AI Writing Coach · Feedback & Revision', ARRAY['writing-coach', 'speech-recording', 'transcript-repair', 'writing-repair', 'mastery-review'], 'FORM_4_SENTENCE_REPAIR')
ON CONFLICT (code) DO NOTHING;
