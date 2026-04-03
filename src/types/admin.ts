export interface AdminPermissions {
  canViewPhotos: boolean
  canViewVideos: boolean
  canManageFrames: boolean
  canManageRequests: boolean
  canManageFeedback: boolean
  canManageAdmins: boolean // Super Admin privilege
  /** ISO strings for date range, null means no restriction */
  photoDateRange: { start: string; end: string } | null
  videoDateRange: { start: string; end: string } | null
}

export interface AdminUser {
  uid: string
  email: string
  role: 'superadmin' | 'studio'
  studioName?: string
  permissions: AdminPermissions
  createdAt: string
}
