import { createBrowserRouter } from 'react-router-dom'

import { IndexPage } from './pages/IndexPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { LegacyTaskRoute, TaskRoute } from './pages/TaskRoutes'

export const router = createBrowserRouter([
  { path: '/', element: <IndexPage /> },
  { path: '/tasks/:code', element: <TaskRoute /> },
  { path: '/tasks/:code/index.html', element: <LegacyTaskRoute /> },
  { path: '*', element: <NotFoundPage /> },
])
