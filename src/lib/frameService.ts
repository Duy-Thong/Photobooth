import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, updateDoc, where } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'
import { STATIC_FRAMES } from './frames-static'
import type { SlotRect } from '@/types/photobooth'

export interface FrameItem {
  id: number
  filename: string
  name: string
  /** 'vertical', 'square', 'grid', 'bigrectangle', etc. Helps UI auto-pick layout. */
  frame?: string
  categoryId: number
  categoryName: string
  /** number of transparent photo slots detected in the PNG */
  slots: number
  /** Firebase Storage download URL — only present for admin-uploaded frames */
  storageUrl?: string
  /** Firestore document ID — only present for admin-uploaded frames */
  firestoreId?: string
  /** Pre-calculated slot coordinates to eliminate on-the-fly detection delay */
  slots_data?: SlotRect[]
  /** Detected layout string: '1x4', '2x2', '2x3', etc. */
  layout?: string
  /** Frame image dimensions from Firestore metadata */
  width?: number
  height?: number
  /** Belong to studio or shared */
  studioId?: string
}

export interface FrameCategory {
  id: number
  name: string
}

const FRAMES_COLLECTION = 'frames'

/** Return the display URL for a frame. Storage URL takes priority over local /frames/. */
export function frameImageUrl(filename: string, storageUrl?: string): string {
  return storageUrl ?? `/frames/${filename}`
}

// In-memory cache
let _framesCache: FrameItem[] | null = null
let _framesFetch: Promise<FrameItem[]> | null = null
let _lastParamsStr = ''

/** Load only admin-uploaded frames from Firestore. */
export async function fetchCustomFrames(studioId?: string, isSuperAdmin = false): Promise<FrameItem[]> {
  if (isSuperAdmin) {
    // Superadmin: fetch ALL frames
    const snap = await getDocs(query(collection(db, FRAMES_COLLECTION), orderBy('id')))
    return snap.docs.map(d => ({ ...(d.data() as Omit<FrameItem, 'firestoreId'>), firestoreId: d.id }))
  }

  // Not superadmin: fetch ONLY 'shared' and 'studioId' frames
  // Because we don't have a composite index for 'in', we fetch them separately and merge
  const sharedSnap = await getDocs(query(collection(db, FRAMES_COLLECTION), where('studioId', '==', 'shared')))
  
  let ownSnap = { docs: [] as any[] }
  if (studioId && studioId !== 'shared') {
    ownSnap = await getDocs(query(collection(db, FRAMES_COLLECTION), where('studioId', '==', studioId)))
  }

  const map = new Map<string, FrameItem>()
  const processSnap = (snap: any) => {
    snap.docs.forEach((d: any) => {
      const item = { ...(d.data() as Omit<FrameItem, 'firestoreId'>), firestoreId: d.id }
      map.set(item.firestoreId!, item)
    })
  }

  processSnap(sharedSnap)
  processSnap(ownSnap)

  return Array.from(map.values()).sort((a, b) => a.id - b.id)
}

/**
 * Load all frames: static (built-in) + admin-uploaded (Firestore).
 * Firestore frames with the same filename override their static counterpart
 * so that migrated frames use Storage URLs instead of /frames/.
 */
export async function fetchFrames(studioId?: string, isSuperAdmin = false): Promise<FrameItem[]> {
  const currentParams = `${studioId || ''}_${isSuperAdmin}`
  if (_framesCache && _lastParamsStr === currentParams) return _framesCache
  if (_framesFetch && _lastParamsStr === currentParams) return _framesFetch

  _lastParamsStr = currentParams
  _framesFetch = (async () => {
    try {
      const firestoreFrames = await fetchCustomFrames(studioId, isSuperAdmin)
      const firestoreFilenames = new Set(firestoreFrames.map(f => f.filename))
      const staticOnly = STATIC_FRAMES.filter(f => !firestoreFilenames.has(f.filename))
      _framesCache = [...staticOnly, ...firestoreFrames]
      return _framesCache
    } catch {
      _framesFetch = null
      return STATIC_FRAMES
    }
  })()
  return _framesFetch
}

/** Invalidate the cache (call after admin upload / delete / update). */
export function invalidateFramesCache() {
  _framesCache = null
  _framesFetch = null
}

/** Deterministic numeric category ID derived from a category name string. */
export function deriveCategoryId(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0
  return Math.abs(h) % 90000 + 10000
}

/**
 * Upload a PNG frame file to Firebase Storage (`frames/`) and save its
 * metadata to the Firestore `frames` collection.
 */
export async function uploadFrame(
  file: File,
  meta: { name: string; categoryName: string; slots: number; slots_data?: SlotRect[]; layout?: string; frame?: string; studioId: string },
): Promise<FrameItem> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const sRef = storageRef(storage, `frames/${filename}`)
  await uploadBytes(sRef, file, { contentType: file.type || 'image/png' })
  const storageUrl = await getDownloadURL(sRef)

  const frameDoc: Omit<FrameItem, 'firestoreId'> = {
    id: Date.now(),
    filename,
    name: meta.name,
    categoryId: deriveCategoryId(meta.categoryName),
    categoryName: meta.categoryName,
    slots: meta.slots,
    storageUrl,
    slots_data: meta.slots_data,
    layout: meta.layout,
    frame: meta.frame,
    studioId: meta.studioId, // Map to either specific studio or 'shared'
  }
  const docRef = await addDoc(collection(db, FRAMES_COLLECTION), frameDoc)
  return { ...frameDoc, firestoreId: docRef.id }
}

/** Remove a frame's Firestore document and its Storage file. */
export async function deleteCustomFrame(firestoreId: string, filename: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, FRAMES_COLLECTION, firestoreId)),
    deleteObject(storageRef(storage, `frames/${filename}`)).catch(() => { /* already deleted */ }),
  ])
}

export async function fetchCategories(studioId?: string, isSuperAdmin = false): Promise<FrameCategory[]> {
  const frames = await fetchFrames(studioId, isSuperAdmin)
  const nameToId = new Map<string, number>()
  for (const f of frames) {
    if (!nameToId.has(f.categoryName)) {
      nameToId.set(f.categoryName, f.categoryId)
    }
  }
  return Array.from(nameToId.entries()).map(([name, id]) => ({ id, name }))
}

// ─── Frame update ──────────────────────────────────────────────────────────────

export async function updateFrame(
  firestoreId: string,
  patch: Partial<Pick<FrameItem, 'name' | 'categoryName' | 'slots' | 'slots_data' | 'layout' | 'frame' | 'studioId'>>,
): Promise<void> {
  const updates: Record<string, string | number> = {}
  if (patch.name !== undefined) updates.name = patch.name
  if (patch.categoryName !== undefined) {
    updates.categoryName = patch.categoryName
    updates.categoryId = deriveCategoryId(patch.categoryName)
  }
  if (patch.slots !== undefined) updates.slots = patch.slots
  if (patch.slots_data !== undefined) (updates as any).slots_data = patch.slots_data
  if (patch.layout !== undefined) updates.layout = patch.layout
  if (patch.frame !== undefined) updates.frame = patch.frame
  if (patch.studioId !== undefined) updates.studioId = patch.studioId
  await updateDoc(doc(db, FRAMES_COLLECTION, firestoreId), updates)
}

export async function migrateFramesService(): Promise<number> {
  const snap = await getDocs(collection(db, FRAMES_COLLECTION))
  let count = 0
  for (const d of snap.docs) {
    if (d.data().studioId === undefined) {
      await updateDoc(doc(db, FRAMES_COLLECTION, d.id), { studioId: 'shared' })
      count++
    }
  }
  return count
}

// ─── Frame contribution requests ──────────────────────────────────────────────

const REQUESTS_COLLECTION = 'frame_requests'

export type FrameRequestStatus = 'pending' | 'approved' | 'rejected'

export interface FrameRequest {
  firestoreId: string
  filename: string
  storageUrl: string
  submitterName: string
  submitterContact: string  // email or social handle
  suggestedName: string
  suggestedCategory: string
  suggestedFrame?: string
  slots: number
  note: string
  status: FrameRequestStatus
  submittedAt: string  // ISO
}

/** User: submit a frame contribution. PNG goes to frame-requests/ in Storage. */
export async function submitFrameRequest(
  file: File,
  meta: {
    submitterName: string
    submitterContact: string
    suggestedName: string
    suggestedCategory: string
    suggestedFrame?: string
    slots: number
    note: string
  },
): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const sRef = storageRef(storage, `frame-requests/${filename}`)
  await uploadBytes(sRef, file, { contentType: file.type || 'image/png' })
  const storageUrl = await getDownloadURL(sRef)

  await addDoc(collection(db, REQUESTS_COLLECTION), {
    filename,
    storageUrl,
    submitterName: meta.submitterName,
    submitterContact: meta.submitterContact,
    suggestedName: meta.suggestedName,
    suggestedCategory: meta.suggestedCategory,
    suggestedFrame: meta.suggestedFrame,
    slots: meta.slots,
    note: meta.note,
    status: 'pending' as FrameRequestStatus,
    submittedAt: new Date().toISOString(),
  })
}

/** Admin: fetch all requests (default: pending only). */
export async function fetchFrameRequests(status: FrameRequestStatus | 'all' = 'pending'): Promise<FrameRequest[]> {
  const snap = await getDocs(collection(db, REQUESTS_COLLECTION))
  const all = snap.docs.map(d => ({ ...(d.data() as Omit<FrameRequest, 'firestoreId'>), firestoreId: d.id }))
  const filtered = status === 'all' ? all : all.filter(r => r.status === status)
  return filtered.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

/** Admin: approve — copies the request into the frames collection & updates status. */
export async function approveFrameRequest(request: FrameRequest): Promise<void> {
  const frameDoc: Omit<FrameItem, 'firestoreId'> = {
    id: Date.now(),
    filename: request.filename,
    name: request.suggestedName,
    categoryId: deriveCategoryId(request.suggestedCategory),
    categoryName: request.suggestedCategory,
    slots: request.slots,
    storageUrl: request.storageUrl,
    frame: request.suggestedFrame,
    studioId: 'shared', // Approvals default to shared
  }
  await Promise.all([
    addDoc(collection(db, FRAMES_COLLECTION), frameDoc),
    updateDoc(doc(db, REQUESTS_COLLECTION, request.firestoreId), { status: 'approved' }),
  ])
}

/** Admin: reject — just updates status, keeps Storage file for reference. */
export async function rejectFrameRequest(firestoreId: string): Promise<void> {
  await updateDoc(doc(db, REQUESTS_COLLECTION, firestoreId), { status: 'rejected' })
}
