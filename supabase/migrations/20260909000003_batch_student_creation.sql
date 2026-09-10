-- ====================================================================
-- GSEC AI Tutor - Batch Managed Students Creation & Smart Login RPC
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Cập nhật hàm trigger tạo profile để lưu thêm username và is_managed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, username, is_managed)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        'STUDENT',
        NEW.raw_user_meta_data->>'username',
        COALESCE((NEW.raw_user_meta_data->>'is_managed')::boolean, FALSE)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        username = COALESCE(EXCLUDED.username, profiles.username),
        is_managed = COALESCE(EXCLUDED.is_managed, profiles.is_managed),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hàm hỗ trợ tìm Email theo Tên đăng nhập (Hỗ trợ Đăng nhập Thông minh)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email FROM public.profiles 
  WHERE LOWER(username) = LOWER(TRIM(p_username)) 
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username TO anon, authenticated;

-- 3. Hàm tạo tài khoản học sinh hàng loạt từ Cổng Giáo Viên
CREATE OR REPLACE FUNCTION public.create_managed_students_batch(
    p_class_id UUID,
    p_students JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_teacher_id UUID;
    v_item JSONB;
    v_name TEXT;
    v_username TEXT;
    v_password TEXT;
    v_email TEXT;
    v_user_id UUID;
    v_created_count INT := 0;
BEGIN
    -- Kiểm tra quyền: Người gọi phải là Giáo viên phụ trách lớp hoặc Admin
    SELECT teacher_id INTO v_teacher_id FROM public.classes WHERE id = p_class_id;
    IF v_teacher_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lớp học không tồn tại.');
    END IF;

    IF v_teacher_id != auth.uid() AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn không có quyền cấp tài khoản cho lớp học này.');
    END IF;

    -- Duyệt qua danh sách học sinh
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_students)
    LOOP
        v_name := TRIM(v_item->>'name');
        v_username := LOWER(TRIM(v_item->>'username'));
        v_password := COALESCE(NULLIF(TRIM(v_item->>'pass'), ''), '123456');
        v_email := v_username || '@student.gsec.internal';

        IF v_username = '' OR v_name = '' THEN
            CONTINUE;
        END IF;

        -- Nếu tài khoản đã có sẵn trong auth.users, chỉ cần thêm vào lớp
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
        
        IF v_user_id IS NOT NULL THEN
            INSERT INTO public.class_students (class_id, student_id)
            VALUES (p_class_id, v_user_id)
            ON CONFLICT (class_id, student_id) DO NOTHING;
            
            v_created_count := v_created_count + 1;
            CONTINUE;
        END IF;

        -- Tạo UUID mới cho học sinh
        v_user_id := gen_random_uuid();

        -- Thêm vào auth.users (mật khẩu mã hóa bằng bcrypt, email_confirmed_at = NOW)
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            crypt(v_password, gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', v_name, 'username', v_username, 'is_managed', true),
            NOW(),
            NOW(),
            '', '', '', ''
        );

        -- Thêm vào auth.identities để Supabase GoTrue nhận diện đăng nhập bằng password
        INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id,
            v_user_id::text,
            format('{"sub": "%s", "email": "%s"}', v_user_id::text, v_email)::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW()
        );

        -- Cập nhật profile chính xác
        UPDATE public.profiles
        SET username = v_username,
            full_name = v_name,
            is_managed = TRUE
        WHERE id = v_user_id;

        -- Gán học sinh vào lớp học
        INSERT INTO public.class_students (class_id, student_id)
        VALUES (p_class_id, v_user_id)
        ON CONFLICT (class_id, student_id) DO NOTHING;

        v_created_count := v_created_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_created_count,
        'message', 'Đã cấp thành công ' || v_created_count || ' tài khoản học sinh vào lớp!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_managed_students_batch TO authenticated;
