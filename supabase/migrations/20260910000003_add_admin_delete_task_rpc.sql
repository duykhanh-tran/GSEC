-- ====================================================================
-- GSEC AI Tutor - Migration 09: Add Admin Delete Task RPC and RLS
-- Hỗ trợ tính năng Xóa bài tập hoàn toàn khỏi CSDL Supabase cho Admin
-- Xóa an toàn từ student_attempts, assignments, task_assessment_policies đến tasks.
-- ====================================================================

-- 1. Đảm bảo hàm public.is_admin() luôn khả dụng
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

-- 2. Thêm policy DELETE cho student_attempts
DROP POLICY IF EXISTS "student_attempts_delete" ON public.student_attempts;
CREATE POLICY "student_attempts_delete" ON public.student_attempts
FOR DELETE TO authenticated
USING (
    student_id = auth.uid() OR public.is_admin()
);

-- 3. Thêm policy DELETE cho assignments
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;
CREATE POLICY "assignments_delete" ON public.assignments
FOR DELETE TO authenticated
USING (
    public.is_admin()
);

-- 4. Thêm policy DELETE cho task_assessment_policies (nếu chưa có)
DROP POLICY IF EXISTS "task_assessment_policies_delete" ON public.task_assessment_policies;
CREATE POLICY "task_assessment_policies_delete" ON public.task_assessment_policies
FOR DELETE TO authenticated
USING (
    public.is_admin()
);

-- 5. Thêm policy DELETE cho tasks (nếu chưa có)
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE TO authenticated
USING (
    public.is_admin()
);

-- 6. Tạo hàm RPC an toàn xóa bài tập dành riêng cho Admin (SECURITY DEFINER)
-- Bỏ qua RLS và xóa nguyên tử trong 1 transaction duy nhất
CREATE OR REPLACE FUNCTION public.delete_task_by_admin(p_task_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task_exists BOOLEAN;
BEGIN
    -- Kiểm tra quyền Admin
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Chỉ Quản trị viên (Admin) mới có quyền xóa bài tập.');
    END IF;

    -- Kiểm tra sự tồn tại của bài tập
    SELECT EXISTS (SELECT 1 FROM public.tasks WHERE code = p_task_code) INTO v_task_exists;

    -- Xóa các liên kết bài nộp của học sinh
    DELETE FROM public.student_attempts WHERE task_code = p_task_code;

    -- Xóa các lượt bài đã giao cho lớp
    DELETE FROM public.assignments WHERE task_code = p_task_code;

    -- Xóa chính sách chấm điểm và gợi ý bảo mật
    DELETE FROM public.task_assessment_policies WHERE task_code = p_task_code;

    -- Xóa bản ghi bài tập chính
    DELETE FROM public.tasks WHERE code = p_task_code;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã xóa bài tập thành công khỏi cơ sở dữ liệu Supabase.',
        'existed', v_task_exists
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_task_by_admin TO authenticated;

