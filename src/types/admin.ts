/** Quyền có thể cấu hình cho tài khoản Studio */
export interface StudioPermissions {
  canViewPhotos: boolean
  canViewVideos: boolean
  /** ISO strings for date range, null means no restriction */
  photoDateRange: { start: string; end: string } | null
  videoDateRange: { start: string; end: string } | null
}

/**
 * Gộp toàn bộ quyền được lưu trong Firestore.
 * Studio chỉ dùng 4 trường đầu; superadmin dùng tất cả.
 * Các trường canManage* của studio luôn là false và không được hiển thị/sửa trong UI.
 */
export interface AdminPermissions extends StudioPermissions {
  canManageFrames: boolean
  canManageRequests: boolean
  canManageFeedback: boolean
  canManageAdmins: boolean
}

export interface AdminUser {
  uid: string
  email: string
  role: 'superadmin' | 'studio'
  studioName?: string
  permissions: AdminPermissions
  createdAt: string
}
