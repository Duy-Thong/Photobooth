import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/components/layout'
import HomePage from '@/pages/HomePage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import StudioLoginPage from '@/pages/StudioLoginPage'
import AdminPage from '@/pages/AdminPage'
import StudioGalleryPage from '@/pages/StudioGalleryPage'
import SessionPage from '@/pages/SessionPage'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import StudioLayout from '@/layouts/StudioLayout'
import StudioDashboard from '@/pages/studio/StudioDashboard'
import StudioAccountPage from '@/pages/studio/StudioAccountPage'
import FrameManager from '@/components/admin/FrameManager'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <StudioLoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute require="studio">
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
    ],
  },
  {
    path: '/session/:id',
    element: <SessionPage />,
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    // Superadmin-only management panel
    path: '/admin',
    element: (
      <ProtectedRoute require="admin">
        <AdminPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/studio',
    element: (
      <ProtectedRoute require="studio">
        <StudioLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <StudioDashboard />
      },
      {
        path: 'gallery',
        element: <StudioGalleryPage />
      },
      {
        path: 'frames',
        element: <FrameManager />
      },
      {
        path: 'account',
        element: <StudioAccountPage />
      }
    ]
  },
])
