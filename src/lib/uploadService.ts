import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'
import { stampQrOnImage } from './imageProcessing'
import { generateSessionId, createSession } from './sessionService'

/** Stable public URL for a Storage path (no token required when rules allow read). */
function stableStorageUrl(bucket: string, storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`
}

/** App origin — works in both dev and production. */
function appOrigin(): string {
  return window.location.origin
}

/**
 * Upload a full capture session (strip image + optional strip video) to Firebase Storage,
 * save a Firestore session document, and embed a QR code pointing to the session page.
 *
 * Returns { sessionId, stampedBlobUrl } where:
 * - sessionId: for routing to /session/:id
 * - stampedBlobUrl: local blob with QR stamped for immediate download/preview
 */
export async function uploadSession(
  imageBlobUrl: string,
  videoUrl?: string | null,
  videoMimeType?: string,
  studioId?: string,
): Promise<{ sessionId: string; stampedBlobUrl: string }> {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string
  const sessionId = generateSessionId()
  const sessionPageUrl = `${appOrigin()}/session/${sessionId}`

  // Paths scoped by studioId when available, otherwise legacy flat path
  const sessionBase = studioId
    ? `sessions/${studioId}/${sessionId}`
    : `sessions/${sessionId}`
  const imagePath = `${sessionBase}/strip.jpg`
  const imageStorageUrl = stableStorageUrl(bucket, imagePath)

  // Stamp QR (pointing to session page) onto image BEFORE upload
  const stampedBlobUrl = await stampQrOnImage(imageBlobUrl, sessionPageUrl)

  // Upload image + video in parallel
  const imageBlob = await fetch(stampedBlobUrl).then(r => r.blob())
  const uploadTasks: Promise<unknown>[] = [
    uploadBytes(ref(storage, imagePath), imageBlob, { contentType: 'image/jpeg' }),
  ]

  let videoStorageUrl: string | null = null
  if (videoUrl) {
    const baseMime = (videoMimeType ?? 'video/webm').split(';')[0].trim()
    const ext = baseMime === 'video/mp4' ? 'mp4' : 'webm'
    const videoPath = `${sessionBase}/strip.${ext}`
    videoStorageUrl = stableStorageUrl(bucket, videoPath)
    const videoBlob = await fetch(videoUrl).then(r => r.blob())
    uploadTasks.push(uploadBytes(ref(storage, videoPath), videoBlob, { contentType: baseMime }))
  }

  await Promise.all(uploadTasks)

  // Save session metadata to Firestore, including studioId when present
  await createSession({ id: sessionId, imageUrl: imageStorageUrl, videoUrl: videoStorageUrl, studioId })

  return { sessionId, stampedBlobUrl }
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
