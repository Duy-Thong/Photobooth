import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  type StorageReference,
} from 'firebase/storage'
import { storage } from '@/lib/firebase'

const DEFAULT_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || ''

/**
 * Extract storage relative path from a Firebase Storage URL.
 * e.g. "https://firebasestorage.googleapis.com/v0/b/.../o/sessions%2F123%2Fstrip.jpg?alt=media" -> "sessions/123/strip.jpg"
 */
export function getStoragePathFromUrl(url: string): string | null {
  if (!url) return null
  try {
    if (url.includes('/o/')) {
      const parts = url.split('/o/')[1].split('?')[0]
      return decodeURIComponent(parts)
    }
    return null
  } catch {
    return null
  }
}

/**
 * Generate a deterministic public storage URL for a given relative path.
 */
export function getStableStorageUrl(storagePath: string, bucket = DEFAULT_BUCKET): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`
}

/**
 * Safely delete a file from Firebase Storage.
 * Returns true if deleted or already doesn't exist, false if permission error or failure.
 */
export async function deleteStorageFile(pathOrRef: string | StorageReference): Promise<boolean> {
  try {
    const sRef = typeof pathOrRef === 'string' ? ref(storage, pathOrRef) : pathOrRef
    await deleteObject(sRef)
    return true
  } catch (err: any) {
    if (err?.code === 'storage/object-not-found') return true
    console.warn('Failed to delete storage file:', pathOrRef, err)
    return false
  }
}

/**
 * Safely delete multiple files from Firebase Storage with concurrency.
 */
export async function deleteStorageFiles(
  paths: string[],
  concurrency = 5,
): Promise<{ succeeded: number; failed: number }> {
  if (paths.length === 0) return { succeeded: 0, failed: 0 }

  let succeeded = 0
  let failed = 0
  const queue = [...paths]

  const worker = async () => {
    while (queue.length > 0) {
      const path = queue.shift()
      if (!path) break
      const ok = await deleteStorageFile(path)
      if (ok) succeeded++
      else failed++
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, paths.length) }, () => worker())
  await Promise.all(workers)

  return { succeeded, failed }
}

/**
 * Upload a blob or file to Firebase Storage and return its public download URL.
 */
export async function uploadStorageFile(
  path: string,
  data: Blob | Uint8Array | ArrayBuffer | File,
  contentType?: string,
): Promise<string> {
  const sRef = ref(storage, path)
  await uploadBytes(sRef, data, contentType ? { contentType } : undefined)
  return getDownloadURL(sRef)
}

/**
 * List all items and sub-folders in a given storage path or reference.
 */
export async function listStorageFolder(pathOrRef: string | StorageReference): Promise<{
  items: StorageReference[]
  prefixes: StorageReference[]
}> {
  const sRef = typeof pathOrRef === 'string' ? ref(storage, pathOrRef) : pathOrRef
  const res = await listAll(sRef)
  return {
    items: res.items,
    prefixes: res.prefixes,
  }
}
