import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from '../../src/app/pages/LandingPage'
import * as AuthModule from '../../src/app/auth'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LandingPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders landing page brand, hero section and authors', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithFacebook: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Vững kiến thức SGK')).toBeDefined()
    expect(screen.getByText('Thầy Hoàng Tăng Đức')).toBeDefined()
    expect(screen.getByText('Cô Mai Linh')).toBeDefined()
    expect(screen.getByText('GSEC — Global Success English Coach')).toBeDefined()
  })

  it('navigates to /login with { from: "/student" } when unauthenticated user clicks experience CTA', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithFacebook: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    const ctaBtns = screen.getAllByRole('button', { name: /Trải Nghiệm Bộ Học Liệu GSEC/i })
    expect(ctaBtns.length).toBeGreaterThan(0)
    fireEvent.click(ctaBtns[0])

    expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/student' } })
  })

  it('navigates to /student when student user clicks experience CTA', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1' } as any,
      profile: { id: 'u1', role: 'STUDENT', full_name: 'Em Nam' },
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithFacebook: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    const ctaBtns = screen.getAllByRole('button', { name: /Trải Nghiệm Bộ Học Liệu GSEC/i })
    fireEvent.click(ctaBtns[0])

    expect(mockNavigate).toHaveBeenCalledWith('/student')
  })

  it('navigates to /teacher when teacher user clicks experience CTA', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u2' } as any,
      profile: { id: 'u2', role: 'TEACHER', full_name: 'Cô Hằng' },
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithFacebook: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    const ctaBtns = screen.getAllByRole('button', { name: /Trải Nghiệm Bộ Học Liệu GSEC/i })
    fireEvent.click(ctaBtns[0])

    expect(mockNavigate).toHaveBeenCalledWith('/teacher')
  })

  it('navigates to /admin when admin user clicks experience CTA', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u3' } as any,
      profile: { id: 'u3', role: 'ADMIN', full_name: 'Admin Tổng' },
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithFacebook: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    const ctaBtns = screen.getAllByRole('button', { name: /Trải Nghiệm Bộ Học Liệu GSEC/i })
    fireEvent.click(ctaBtns[0])

    expect(mockNavigate).toHaveBeenCalledWith('/admin')
  })

  it('automatically redirects ?page=60111 or ?mode=student to /student with query params', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithFacebook: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/?page=60111']}>
        <LandingPage />
      </MemoryRouter>
    )

    expect(mockNavigate).toHaveBeenCalledWith('/student?page=60111', { replace: true })
  })
})
