-- ====================================================================
-- GSEC AI Tutor - Class Codes & Hybrid Student Management Migration
-- ====================================================================

-- 1. Thêm cột username và is_managed vào bảng profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT FALSE;

-- 2. Hàm cho phép học sinh tham gia lớp học bằng mã Class Code
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_class_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_class_id UUID;
    v_class_name TEXT;
    v_teacher_name TEXT;
    v_student_id UUID;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để tham gia lớp học.');
    END IF;

    -- Tìm lớp theo mã code (không phân biệt hoa thường)
    SELECT c.id, c.name, p.full_name 
    INTO v_class_id, v_class_name, v_teacher_name
    FROM public.classes c
    JOIN public.profiles p ON p.id = c.teacher_id
    WHERE UPPER(c.code) = UPPER(TRIM(p_class_code));

    IF v_class_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã lớp không tồn tại hoặc đã hết hạn.');
    END IF;

    -- Thêm học sinh vào lớp (nếu chưa có)
    INSERT INTO public.class_students (class_id, student_id)
    VALUES (v_class_id, v_student_id)
    ON CONFLICT (class_id, student_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true, 
        'class_id', v_class_id, 
        'class_name', v_class_name, 
        'teacher_name', v_teacher_name,
        'message', 'Tham gia lớp ' || v_class_name || ' thành công!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cập nhật chính sách RLS cho bảng classes
DROP POLICY IF EXISTS "Giáo viên quản lý lớp của mình" ON public.classes;
CREATE POLICY "Giáo viên quản lý lớp của mình" ON public.classes FOR ALL TO authenticated
USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Học sinh xem lớp mình tham gia" ON public.classes;
CREATE POLICY "Học sinh xem lớp mình tham gia" ON public.classes FOR SELECT TO authenticated
USING (
    teacher_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.class_students WHERE class_id = classes.id AND student_id = auth.uid())
);

-- 4. Cập nhật chính sách RLS cho bảng class_students
DROP POLICY IF EXISTS "Xem danh sách học sinh của lớp" ON public.class_students;
CREATE POLICY "Xem danh sách học sinh của lớp" ON public.class_students FOR SELECT TO authenticated
USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_students.class_id AND teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "Giáo viên quản lý học sinh trong lớp" ON public.class_students;
CREATE POLICY "Giáo viên quản lý học sinh trong lớp" ON public.class_students FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_students.class_id AND teacher_id = auth.uid())
);
