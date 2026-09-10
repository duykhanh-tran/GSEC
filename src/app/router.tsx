import { createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from './auth'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { IndexPage } from './pages/IndexPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { LegacyTaskRoute, TaskRoute } from './pages/TaskRoutes'

import { TeacherPortalPage } from './pages/TeacherPortalPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'

export const router = createBrowserRouter([
  {
    path: '/',
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
    path: '/teacher',
    element: (
      <ProtectedRoute>
        <TeacherPortalPage />
      </ProtectedRoute>
    ),
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
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
