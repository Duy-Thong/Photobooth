import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, permissions, isAdminLoading } = useAdminAuth()

  // Still resolving auth state or admin permissions
  if (user === undefined || isAdminLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#111]">
        <Spin size="large" />
      </div>
    )
  }

  if (!user || !permissions) return <Navigate to="/admin/login" replace />

  return <>{children}</>
}
