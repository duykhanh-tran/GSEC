-- ====================================================================
-- GSEC AI Tutor - Initial Database Schema & Row Level Security (RLS)
-- Project: xxprhphtmchbknmmaddv
-- ====================================================================

-- 1. Định nghĩa ENUM cho vai trò người dùng (RBAC)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Bảng hồ sơ người dùng (liên kết với bảng auth.users của Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger tự động đồng bộ khi người dùng đăng ký qua Form Email hoặc SSO (Google/Facebook)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        'STUDENT'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Bảng Lớp học (Quản lý bởi Giáo viên)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(8) UNIQUE NOT NULL, -- Mã mời vào lớp (ví dụ: 'GSEC6A1')
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Học sinh tham gia Lớp học
CREATE TABLE IF NOT EXISTS public.class_students (
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (class_id, student_id)
);

-- 5. Bảng Nhiệm vụ học tập (Công khai cho học sinh xem - KHÔNG chứa đáp án bí mật)
CREATE TABLE IF NOT EXISTS public.tasks (
    code VARCHAR(5) PRIMARY KEY, -- '60111' đến '60166'
    worksheet INT NOT NULL,
    task_number INT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    archetypes TEXT[] NOT NULL,
    content_version INT NOT NULL DEFAULT 1,
    content JSONB NOT NULL DEFAULT '{}'::jsonb, -- Flow blocks giao diện
    is_published BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng Chính sách Chấm điểm & Gợi ý (BẢO MẬT TUYỆT ĐỐI - CHỈ SERVER ĐỌC)
CREATE TABLE IF NOT EXISTS public.task_assessment_policies (
    task_code VARCHAR(5) PRIMARY KEY REFERENCES public.tasks(code) ON DELETE CASCADE,
    max_attempts INT DEFAULT 2,
    keys_data JSONB NOT NULL,     -- Đáp án đúng chuẩn
    hints_data JSONB NOT NULL,    -- Gợi ý h1, gợi ý h2, quy tắc ngữ pháp rule
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng Bài tập được giao (Assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    task_code VARCHAR(5) REFERENCES public.tasks(code),
    assigned_by UUID REFERENCES public.profiles(id),
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Bảng Lần làm bài & Lịch sử học tập của Học sinh
DO $$ BEGIN
    CREATE TYPE support_mode AS ENUM ('INDEPENDENT', 'GUIDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.student_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_code VARCHAR(5) NOT NULL REFERENCES public.tasks(code),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
    score INT DEFAULT 0,
    max_score INT NOT NULL DEFAULT 100,
    support_mode support_mode DEFAULT 'INDEPENDENT',
    attempt_count INT DEFAULT 1,
    answers_payload JSONB DEFAULT '{}'::jsonb,
    feedback_history JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- KÍCH HOẠT VÀ THIẾT LẬP ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assessment_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Mọi người dùng đã đăng nhập có thể xem profile của mình và người khác
DROP POLICY IF EXISTS "Xem profile cá nhân" ON public.profiles;
CREATE POLICY "Xem profile cá nhân" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Cập nhật profile cá nhân" ON public.profiles;
CREATE POLICY "Cập nhật profile cá nhân" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- 2. Tasks: Ai cũng xem được task đã publish (kể cả khách chưa đăng nhập)
DROP POLICY IF EXISTS "Xem task published" ON public.tasks;
CREATE POLICY "Xem task published" ON public.tasks FOR SELECT USING (is_published = true);

-- 3. Task Assessment Policies: CẤM HỌC SINH ĐỌC (Chỉ Admin và Service Role mới đọc được)
DROP POLICY IF EXISTS "Chỉ Admin mới có quyền xem chính sách chấm" ON public.task_assessment_policies;
CREATE POLICY "Chỉ Admin mới có quyền xem chính sách chấm" ON public.task_assessment_policies FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 4. Classes:
DROP POLICY IF EXISTS "Giáo viên quản lý lớp của mình" ON public.classes;
CREATE POLICY "Giáo viên quản lý lớp của mình" ON public.classes FOR ALL TO authenticated
USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Học sinh xem lớp mình tham gia" ON public.classes;
CREATE POLICY "Học sinh xem lớp mình tham gia" ON public.classes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.class_students WHERE class_id = classes.id AND student_id = auth.uid()));

-- 5. Student Attempts:
DROP POLICY IF EXISTS "Học sinh xem bài của chính mình" ON public.student_attempts;
CREATE POLICY "Học sinh xem bài của chính mình" ON public.student_attempts FOR SELECT TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Học sinh nộp bài của mình" ON public.student_attempts;
CREATE POLICY "Học sinh nộp bài của mình" ON public.student_attempts FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Giáo viên xem bài học sinh lớp mình" ON public.student_attempts;
CREATE POLICY "Giáo viên xem bài học sinh lớp mình" ON public.student_attempts FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.class_students cs ON cs.class_id = c.id
    WHERE c.teacher_id = auth.uid() AND cs.student_id = student_attempts.student_id
));

-- 6. Assignments:
DROP POLICY IF EXISTS "Xem assignment của lớp mình" ON public.assignments;
CREATE POLICY "Xem assignment của lớp mình" ON public.assignments FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.class_students WHERE class_id = assignments.class_id AND student_id = auth.uid()
) OR assigned_by = auth.uid());

-- 7. Kích hoạt Realtime trên student_attempts để Giáo viên theo dõi trực tiếp
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_attempts;
