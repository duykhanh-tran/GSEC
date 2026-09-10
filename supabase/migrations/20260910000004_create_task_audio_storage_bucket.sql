-- ====================================================================
-- GSEC AI Tutor - Storage Bucket for Task Audio Files
-- ====================================================================

-- 1. Tạo bucket 'task-audio' công khai
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-audio', 'task-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Cho phép mọi người đọc file audio công khai
DROP POLICY IF EXISTS "Public read task-audio" ON storage.objects;
CREATE POLICY "Public read task-audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-audio');

-- 3. Cho phép Admin tải lên file audio
DROP POLICY IF EXISTS "Admin upload task-audio" ON storage.objects;
CREATE POLICY "Admin upload task-audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'task-audio'
);

-- 4. Cho phép Admin xóa file audio
DROP POLICY IF EXISTS "Admin delete task-audio" ON storage.objects;
CREATE POLICY "Admin delete task-audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'task-audio'
);
