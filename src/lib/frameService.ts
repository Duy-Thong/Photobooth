import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'
import { STATIC_FRAMES } from './frames-static'

export interface FrameItem {
  id: number
  filename: string
  name: string
  /** frame type: 'square' = strip (1x3/1x4), 'bigrectangle' = tall/1x2, 'grid' = 2x2 */
  frame: 'square' | 'bigrectangle' | 'grid'
  categoryId: number
  categoryName: string
  /** number of transparent photo slots detected in the PNG */
  slots: number
  /** Firebase Storage download URL — only present for admin-uploaded frames */
  storageUrl?: string
  /** Firestore document ID — only present for admin-uploaded frames */
  firestoreId?: string
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

/** Load only admin-uploaded frames from Firestore. */
export async function fetchCustomFrames(): Promise<FrameItem[]> {
  const snap = await getDocs(query(collection(db, FRAMES_COLLECTION), orderBy('name')))
  return snap.docs.map(d => ({
    ...(d.data() as Omit<FrameItem, 'firestoreId'>),
    firestoreId: d.id,
  }))
}

/**
 * Load all frames: static (built-in) + admin-uploaded (Firestore).
 * Firestore frames with the same filename override their static counterpart
 * so that migrated frames use Storage URLs instead of /frames/.
 */
export async function fetchFrames(): Promise<FrameItem[]> {
  try {
    const firestoreFrames = await fetchCustomFrames()
    const firestoreFilenames = new Set(firestoreFrames.map(f => f.filename))
    const staticOnly = STATIC_FRAMES.filter(f => !firestoreFilenames.has(f.filename))
    return [...staticOnly, ...firestoreFrames]
  } catch {
    return STATIC_FRAMES
  }
}

/** Deterministic numeric category ID derived from a category name string. */
function deriveCategoryId(name: string): number {
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
  meta: { name: string; categoryName: string; slots: number; frame: FrameItem['frame'] },
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
    frame: meta.frame,
    categoryId: deriveCategoryId(meta.categoryName),
    categoryName: meta.categoryName,
    slots: meta.slots,
    storageUrl,
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

export async function fetchCategories(): Promise<FrameCategory[]> {
  const frames = await fetchFrames()
  const seen = new Map<number, string>()
  for (const f of frames) {
    if (!seen.has(f.categoryId)) seen.set(f.categoryId, f.categoryName)
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}

