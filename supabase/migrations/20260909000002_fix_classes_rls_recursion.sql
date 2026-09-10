-- ====================================================================
-- GSEC AI Tutor - Fix Infinite Recursion in Classes & Class Students RLS
-- ====================================================================

-- 1. Hàm hỗ trợ kiểm tra xem user hiện tại có phải Giáo viên của lớp không (hoặc là Admin)
-- Dùng SECURITY DEFINER để bypass RLS nội bộ, tránh vòng lặp đệ quy vô tận giữa classes và class_students
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = p_class_id 
      AND (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  );
$$;

-- 2. Hàm hỗ trợ kiểm tra xem user hiện tại có phải Học sinh trong lớp không
CREATE OR REPLACE FUNCTION public.is_class_student(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_students 
    WHERE class_id = p_class_id AND student_id = auth.uid()
  );
$$;

-- 3. Hàm hỗ trợ kiểm tra xem user hiện tại có phải Giáo viên dạy học sinh này không
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
    WHERE (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
      AND cs.student_id = p_student_id
  );
$$;

-- ====================================================================
-- THIẾT LẬP LẠI CHÍNH SÁCH RLS CHO BẢNG classes
-- ====================================================================
DROP POLICY IF EXISTS "Giáo viên quản lý lớp của mình" ON public.classes;
DROP POLICY IF EXISTS "Học sinh xem lớp mình tham gia" ON public.classes;
DROP POLICY IF EXISTS "classes_teacher_all" ON public.classes;
DROP POLICY IF EXISTS "classes_student_select" ON public.classes;

-- Giáo viên và Admin toàn quyền quản lý lớp của mình (Tạo, Sửa, Xóa, Xem)
CREATE POLICY "classes_teacher_all" ON public.classes
FOR ALL TO authenticated
USING (
    teacher_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
    teacher_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Học sinh chỉ có quyền xem lớp mà mình đã tham gia (Dùng hàm SECURITY DEFINER - Không lo đệ quy)
CREATE POLICY "classes_student_select" ON public.classes
FOR SELECT TO authenticated
USING (
    public.is_class_student(id)
);

-- ====================================================================
-- THIẾT LẬP LẠI CHÍNH SÁCH RLS CHO BẢNG class_students
-- ====================================================================
DROP POLICY IF EXISTS "Xem danh sách học sinh của lớp" ON public.class_students;
DROP POLICY IF EXISTS "Giáo viên quản lý học sinh trong lớp" ON public.class_students;
DROP POLICY IF EXISTS "class_students_student_select" ON public.class_students;
DROP POLICY IF EXISTS "class_students_teacher_all" ON public.class_students;

-- Học sinh xem thông tin tham gia lớp của chính mình
CREATE POLICY "class_students_student_select" ON public.class_students
FOR SELECT TO authenticated
USING (
    student_id = auth.uid()
);

-- Giáo viên toàn quyền xem và quản lý học sinh trong lớp mình phụ trách
CREATE POLICY "class_students_teacher_all" ON public.class_students
FOR ALL TO authenticated
USING (
    public.is_class_teacher(class_id)
)
WITH CHECK (
    public.is_class_teacher(class_id)
);

-- ====================================================================
-- CẬP NHẬT CHÍNH SÁCH CHO student_attempts ĐỂ TỐI ƯU HIỆU NĂNG
-- ====================================================================
DROP POLICY IF EXISTS "Giáo viên xem bài học sinh lớp mình" ON public.student_attempts;
CREATE POLICY "Giáo viên xem bài học sinh lớp mình" ON public.student_attempts 
FOR SELECT TO authenticated
USING (
    student_id = auth.uid() 
    OR public.is_teacher_of_student(student_id)
);
