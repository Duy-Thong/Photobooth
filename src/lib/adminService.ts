import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { AdminUser, AdminPermissions } from '@/types/admin'

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

export const STUDIO_PERMISSIONS: AdminPermissions = {
  canViewPhotos: true,
  canViewVideos: true,
  canManageFrames: false,
  canManageRequests: false,
  canManageFeedback: false,
  canManageAdmins: false,
  photoDateRange: null,
  videoDateRange: null,
}
