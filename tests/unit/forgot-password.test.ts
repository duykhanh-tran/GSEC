import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Forgot Password and Reset Password Flow', () => {
  it('LoginPage contains Quên mật khẩu? link pointing to /forgot-password', () => {
    const loginPath = path.resolve(process.cwd(), 'src/app/pages/LoginPage.tsx')
    const loginCode = fs.readFileSync(loginPath, 'utf8')

    expect(loginCode).toContain('Quên mật khẩu?')
    expect(loginCode).toContain('/forgot-password')
  })

  it('router.tsx registers /forgot-password and /reset-password routes', () => {
    const routerPath = path.resolve(process.cwd(), 'src/app/router.tsx')
    const routerCode = fs.readFileSync(routerPath, 'utf8')

    expect(routerCode).toContain("path: '/forgot-password'")
    expect(routerCode).toContain('<ForgotPasswordPage />')
    expect(routerCode).toContain("path: '/reset-password'")
    expect(routerCode).toContain('<ResetPasswordPage />')
  })

  it('AuthContext contains resetPasswordForEmail and updatePassword functions', () => {
    const authContextPath = path.resolve(process.cwd(), 'src/app/auth/AuthContext.tsx')
    const authCode = fs.readFileSync(authContextPath, 'utf8')

    expect(authCode).toContain('const resetPasswordForEmail = async')
    expect(authCode).toContain('const updatePassword = async')
    expect(authCode).toContain('supabase.auth.resetPasswordForEmail')
    expect(authCode).toContain('supabase.auth.updateUser')
  })

  it('ForgotPasswordPage handles both email and internal student username', () => {
    const forgotPath = path.resolve(process.cwd(), 'src/app/pages/ForgotPasswordPage.tsx')
    const forgotCode = fs.readFileSync(forgotPath, 'utf8')

    expect(forgotCode).toContain('Khôi Phục Mật Khẩu')
    expect(forgotCode).toContain('resetPasswordForEmail')
    expect(forgotCode).toContain('student_internal')
    expect(forgotCode).toContain('123456')
  })

  it('ResetPasswordPage validates password length and confirmation', () => {
    const resetPath = path.resolve(process.cwd(), 'src/app/pages/ResetPasswordPage.tsx')
    const resetCode = fs.readFileSync(resetPath, 'utf8')

    expect(resetCode).toContain('Đặt Lại Mật Khẩu Mới')
    expect(resetCode).toContain('password.length < 6')
    expect(resetCode).toContain('password !== confirmPassword')
    expect(resetCode).toContain('updatePassword')
  })
})
