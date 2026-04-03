import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAdminAuth } from '@/hooks/useAdminAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** 'admin' → only superadmin; 'studio' → any authenticated studio or superadmin */
  require?: 'admin' | 'studio'
}

export default function ProtectedRoute({ children, require = 'admin' }: ProtectedRouteProps) {
  const { user, permissions, role, isAdminLoading } = useAdminAuth()

  // Still resolving auth state or admin permissions
  if (user === undefined || isAdminLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#111]">
        <Spin size="large" />
      </div>
    )
  }

  if (!user || !role) {
    return <Navigate to={require === 'admin' ? '/admin/login' : '/login'} replace />
  }

  // Admin panel requires superadmin role
  if (require === 'admin' && role !== 'superadmin') {
    return <Navigate to="/" replace />
  }

  if (!permissions) return <Navigate to={require === 'admin' ? '/admin/login' : '/login'} replace />

  return <>{children}</>
}
