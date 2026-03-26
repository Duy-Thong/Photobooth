import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'
import { stampQrOnImage } from './imageProcessing'

/** Stable public URL for a Storage path (no token required when rules allow read). */
function stableStorageUrl(bucket: string, storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`
}

/**
 * Upload a photo strip with QR code embedded in one pass:
 * 1. Generate filename/path deterministically BEFORE upload
 * 2. Compute the stable public URL from bucket + path
 * 3. Stamp QR (pointing to that URL) onto the image
 * 4. Upload the QR-stamped image at exactly that path
 * Returns the stable public URL (same as what the QR encodes).
 */
export async function uploadPhotoWithQr(blobUrl: string): Promise<{ publicUrl: string; stampedBlobUrl: string }> {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const storagePath = `photobooth/${filename}`
  const publicUrl = stableStorageUrl(bucket, storagePath)

  // Stamp QR before upload — QR encodes publicUrl which we already know
  const stampedBlobUrl = await stampQrOnImage(blobUrl, publicUrl)

  const res = await fetch(stampedBlobUrl)
  const blob = await res.blob()
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
  return { publicUrl, stampedBlobUrl }
}

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
 * Upload a video recap blob URL to Firebase Storage.
 * mimeType drives the file extension and Content-Type header.
 */
export async function uploadVideoToFirebase(blobUrl: string, mimeType = 'video/webm'): Promise<string> {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  const baseMime = mimeType.split(';')[0].trim()
  const ext = baseMime === 'video/mp4' ? 'mp4' : 'webm'
  const filename = `recap/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const storageRef = ref(storage, filename)
  await uploadBytes(storageRef, blob, { contentType: baseMime })
  return getDownloadURL(storageRef)
}
