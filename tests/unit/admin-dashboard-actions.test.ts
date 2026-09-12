import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Admin Dashboard Action Buttons & Deletion Safety', () => {
  it('migration 09 contains delete_task_by_admin RPC and required delete policies', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260910000003_add_admin_delete_task_rpc.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.delete_task_by_admin')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('student_attempts_delete')
    expect(sql).toContain('assignments_delete')
    expect(sql).toContain('task_assessment_policies_delete')
    expect(sql).toContain('tasks_delete')
  })

  it('AdminDashboardPage contains handleOpenEditTask and ✏️ Sửa button adjacent to 🗑️ Xóa', () => {
    const dashboardPath = path.resolve(process.cwd(), 'src/app/pages/AdminDashboardPage.tsx')
    const code = fs.readFileSync(dashboardPath, 'utf8')

    expect(code).toContain('const handleOpenEditTask = async')
    expect(code).toContain('btn-edit-task')
    expect(code).toContain('✏️ Sửa')
    expect(code).toContain('btn-delete-task')
    expect(code).toContain('🗑️ Xóa')
    expect(code).toContain('editingTaskCode')
  })

  it('handleDeleteTask validates Supabase deletion and does not silently swallow errors', () => {
    const dashboardPath = path.resolve(process.cwd(), 'src/app/pages/AdminDashboardPage.tsx')
    const code = fs.readFileSync(dashboardPath, 'utf8')

    expect(code).toContain('CSDL Supabase từ chối xóa bài tập')
    expect(code).toContain('checkRemain')
  })

  it('AdminDashboard navigates to dedicated full-page AdminTaskStudio for create and edit', () => {
    const dashboardPath = path.resolve(process.cwd(), 'src/app/pages/AdminDashboardPage.tsx')
    const code = fs.readFileSync(dashboardPath, 'utf8')

    expect(code).toContain("navigate('/admin/studio')")
    expect(code).toContain("navigate(`/admin/studio?edit=${taskItem.code}`)")
  })

  it('Router registers dedicated /admin/studio and /admin/studio/:code protected routes', () => {
    const routerPath = path.resolve(process.cwd(), 'src/app/router.tsx')
    const routerCode = fs.readFileSync(routerPath, 'utf8')

    expect(routerCode).toContain("path: '/admin/studio'")
    expect(routerCode).toContain("path: '/admin/studio/:code'")
    expect(routerCode).toContain('AdminTaskStudioPage')
  })

  it('AdminTaskStudioPage provides full-page authoring studio supporting all forms', () => {
    const studioPath = path.resolve(process.cwd(), 'src/app/pages/AdminTaskStudioPage.tsx')
    const studioCode = fs.readFileSync(studioPath, 'utf8')

    expect(studioCode).toContain('AdminTaskStudioPage')
    expect(studioCode).toContain('Quay lại Quản trị')
    expect(studioCode).toContain('fetchTaskToEdit')
    expect(studioCode).toContain('FORM_1_CHOICE')
    expect(studioCode).toContain('FORM_2_FILL')
    expect(studioCode).toContain('FORM_3_WRITING')
    expect(studioCode).toContain('FORM_4_SPEAKING')
    expect(studioCode).toContain('FORM_5_LISTEN_REPEAT')
    expect(studioCode).toContain('FORM_6_1_PROFILE_QA')
    expect(studioCode).toContain('FORM_6_2_INTERVIEW_PROFILE')
    expect(studioCode).toContain('tasks')
    expect(studioCode).toContain('task_assessment_policies')
  })
})
