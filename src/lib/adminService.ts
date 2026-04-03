import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { AdminUser, AdminPermissions, StudioPermissions } from '@/types/admin'

const ADMINS_COLLECTION = 'admins'

export async function fetchAdminUser(uid: string): Promise<AdminUser | null> {
  const snap = await getDoc(doc(db, ADMINS_COLLECTION, uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...(snap.data() as Omit<AdminUser, 'uid'>) }
}

export async function createOrUpdateAdmin(uid: string, data: Partial<AdminUser>): Promise<void> {
  await setDoc(doc(db, ADMINS_COLLECTION, uid), data, { merge: true })
}

export async function fetchAllAdmins(): Promise<AdminUser[]> {
  const snap = await getDocs(collection(db, ADMINS_COLLECTION))
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<AdminUser, 'uid'>) }))
}

/** Permissions mặc định khi chưa có record (fallback an toàn — không có quyền gì) */
export const DEFAULT_PERMISSIONS: AdminPermissions = {
  canViewPhotos: false,
  canViewVideos: false,
  canManageFrames: false,
  canManageRequests: false,
  canManageFeedback: false,
  canManageAdmins: false,
  photoDateRange: null,
  videoDateRange: null,
}

/** Permissions đầy đủ khi tạo superadmin */
export const SUPER_ADMIN_PERMISSIONS: AdminPermissions = {
  canViewPhotos: true,
  canViewVideos: true,
  canManageFrames: true,
  canManageRequests: true,
  canManageFeedback: true,
  canManageAdmins: true,
  photoDateRange: null,
  videoDateRange: null,
}

/** Permissions mặc định khi tạo studio mới */
export const DEFAULT_STUDIO_PERMISSIONS: StudioPermissions = {
  canViewPhotos: true,
  canViewVideos: true,
  photoDateRange: null,
  videoDateRange: null,
}

/**
 * Build AdminPermissions từ StudioPermissions.
 * Các trường canManage* luôn là false với studio — không bao giờ được ghi true.
 */
export function buildStudioAdminPermissions(p: StudioPermissions): AdminPermissions {
  return {
    canViewPhotos: p.canViewPhotos,
    canViewVideos: p.canViewVideos,
    canManageFrames: false,
    canManageRequests: false,
    canManageFeedback: false,
    canManageAdmins: false,
    photoDateRange: p.photoDateRange,
    videoDateRange: p.videoDateRange,
  }
}

/** @deprecated Use DEFAULT_STUDIO_PERMISSIONS + buildStudioAdminPermissions */
export const STUDIO_PERMISSIONS: AdminPermissions = buildStudioAdminPermissions(DEFAULT_STUDIO_PERMISSIONS)
export async function deleteAdmin(uid: string): Promise<void> {
  const { deleteDoc, doc } = await import('firebase/firestore')
  await deleteDoc(doc(db, ADMINS_COLLECTION, uid))
}

export async function uploadStudioLogo(uid: string, file: File): Promise<string> {
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const { storage } = await import('./firebase')
  
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const filename = `${uid}_logo_${Date.now()}.${ext}`
  const sRef = ref(storage, `studios/${uid}/${filename}`)
  
  await uploadBytes(sRef, file)
  const url = await getDownloadURL(sRef)
  
  await createOrUpdateAdmin(uid, { logoUrl: url })
  return url
}
