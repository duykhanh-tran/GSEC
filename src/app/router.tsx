import { createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from './auth'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { IndexPage } from './pages/IndexPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { LegacyTaskRoute, TaskRoute } from './pages/TaskRoutes'

import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

import { TeacherPortalPage } from './pages/TeacherPortalPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminTaskStudioPage } from './pages/AdminTaskStudioPage'
import { LandingPage } from './pages/LandingPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/student',
    element: (
      <ProtectedRoute>
        <IndexPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/tasks',
    element: (
      <ProtectedRoute>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/studio',
    element: (
      <ProtectedRoute>
        <AdminTaskStudioPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/studio/:code',
    element: (
      <ProtectedRoute>
        <AdminTaskStudioPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/teacher',
    element: (
      <ProtectedRoute>
        <TeacherPortalPage />
      </ProtectedRoute>
    ),
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    path: '/tasks/:code',
    element: (
      <ProtectedRoute>
        <TaskRoute />
      </ProtectedRoute>
    ),
  },
  {
    path: '/tasks/:code/index.html',
    element: (
      <ProtectedRoute>
        <LegacyTaskRoute />
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
])
