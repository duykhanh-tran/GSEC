-- ====================================================================
-- GSEC AI Tutor - Migration 07: Fix Admin Tasks Authoring RLS
-- Khắc phục lỗi: "new row violates row-level security policy for table tasks"
-- Cho phép Quản trị viên (ADMIN) toàn quyền Thêm (INSERT), Sửa (UPDATE),
-- Xóa (DELETE) bài tập và chính sách chấm điểm trong Studio.
-- ====================================================================

-- 1. Đảm bảo hàm kiểm tra vai trò Admin luôn khả dụng
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
GRANT EXECUTE ON FUNCTION public.is_admin TO anon;

-- 2. Thiết lập chính sách RLS cho bảng public.tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Xem task published" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_admin_all" ON public.tasks;

-- Mọi người dùng (kể cả khách) đều xem được bài tập đã xuất bản (is_published = true)
-- Riêng Admin có thể xem được tất cả các bài tập kể cả bản nháp
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT
USING (
    is_published = true OR public.is_admin()
);

-- Chỉ Admin mới có quyền Thêm, Sửa, Xóa bài tập trong hệ thống (Studio)
CREATE POLICY "tasks_admin_all" ON public.tasks
FOR ALL TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- 3. Thiết lập chính sách RLS cho bảng public.task_assessment_policies
-- (Chứa đáp án và gợi ý chấm điểm - BẢO MẬT TUYỆT ĐỐI)
ALTER TABLE public.task_assessment_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chỉ Admin mới có quyền xem chính sách chấm" ON public.task_assessment_policies;
DROP POLICY IF EXISTS "task_assessment_policies_admin_all" ON public.task_assessment_policies;

-- Chỉ tài khoản Admin mới có quyền Xem, Thêm, Sửa, Xóa đáp án & cấu hình chấm
CREATE POLICY "task_assessment_policies_admin_all" ON public.task_assessment_policies
FOR ALL TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);
