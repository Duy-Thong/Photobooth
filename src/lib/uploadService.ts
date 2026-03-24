import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

/**
 * Upload a blob URL (from canvas.toBlob) to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadPhotoToFirebase(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  const filename = `photobooth/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const storageRef = ref(storage, filename)
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(storageRef)
}

/**
 * Upload a WebM video recap blob URL to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadVideoToFirebase(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  const filename = `recap/${Date.now()}_${Math.random().toString(36).slice(2)}.webm`
  const storageRef = ref(storage, filename)
  await uploadBytes(storageRef, blob, { contentType: 'video/webm' })
  return getDownloadURL(storageRef)
}
