import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { MainLayout } from '@/components/layout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'

const HomePage = lazy(() => import('@/pages/HomePage'))
const AdminLoginPage = lazy(() => import('@/pages/AdminLoginPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))
const SessionPage = lazy(() => import('@/pages/SessionPage'))

const PageFallback = () => (
  <div className="min-h-dvh flex items-center justify-center bg-[#0a0a0a]">
    <Spin size="large" />
  </div>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/session/:id',
    element: (
      <Suspense fallback={<PageFallback />}>
        <SessionPage />
      </Suspense>
    ),
  },
  {
    path: '/admin/login',
    element: (
      <Suspense fallback={<PageFallback />}>
        <AdminLoginPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<PageFallback />}>
          <AdminPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
])
