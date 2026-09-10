-- ====================================================================
-- GSEC AI Tutor - Add Unit and Lesson columns to public.tasks
-- ====================================================================

-- 1. Bổ sung cột unit và lesson vào bảng public.tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS unit INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS lesson INT DEFAULT 1;

-- 2. Đồng bộ dữ liệu cũ:
-- Giữ tính nhất quán: lesson lấy theo giá trị worksheet đã có
UPDATE public.tasks 
SET lesson = worksheet 
WHERE lesson IS NULL OR (lesson = 1 AND worksheet IS NOT NULL AND worksheet <> 1);

-- Đảm bảo unit có giá trị mặc định là 1 nếu null
UPDATE public.tasks 
SET unit = 1 
WHERE unit IS NULL;
