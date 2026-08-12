import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, permissions, isAdminLoading, logout } = useAdminAuth()

  // Still resolving auth state or admin permissions
  if (user === undefined || isAdminLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#111]">
        <Spin size="large" />
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" replace />

  if (!permissions) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#111] text-white p-6 text-center">
        <h2 className="text-xl font-bold text-red-400 mb-2">Không thể tải quyền quản trị</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6">
          Không thể kết nối đến Firestore Database hoặc tài khoản của bạn chưa được cấp quyền Admin.
        </p>
        <button
          onClick={() => logout()}
          className="px-5 py-2.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition cursor-pointer"
        >
          Đăng xuất
        </button>
      </div>
    )
  }

  return <>{children}</>
}
