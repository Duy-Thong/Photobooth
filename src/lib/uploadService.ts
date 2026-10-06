import { ref, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'
import { generateSessionId, createSession } from './sessionService'
import { getStableStorageUrl, uploadStorageFile } from '@/utils/storage'

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
): Promise<{ sessionId: string; stampedBlobUrl: string }> {
  const sessionId = generateSessionId()

  // Paths use sessionId so image + video are co-located
  const imagePath = `sessions/${sessionId}/strip.jpg`
  const imageStorageUrl = getStableStorageUrl(imagePath)

  // Upload original clean image directly (no QR stamp overlay)
  const imageBlob = await fetch(imageBlobUrl).then(r => r.blob())
  const uploadTasks: Promise<unknown>[] = [
    uploadBytes(ref(storage, imagePath), imageBlob, { contentType: 'image/jpeg' }),
  ]

  let videoStorageUrl: string | null = null
  if (videoUrl) {
    const baseMime = (videoMimeType ?? 'video/webm').split(';')[0].trim()
    const ext = baseMime === 'video/mp4' ? 'mp4' : 'webm'
    const videoPath = `sessions/${sessionId}/strip.${ext}`
    videoStorageUrl = getStableStorageUrl(videoPath)
    const videoBlob = await fetch(videoUrl).then(r => r.blob())
    uploadTasks.push(uploadBytes(ref(storage, videoPath), videoBlob, { contentType: baseMime }))
  }

  await Promise.all(uploadTasks)

  // Save session metadata to Firestore
  await createSession({ id: sessionId, imageUrl: imageStorageUrl, videoUrl: videoStorageUrl })

  return { sessionId, stampedBlobUrl: imageBlobUrl }
}

/**
 * Upload a blob URL (from canvas.toBlob) to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadPhotoToFirebase(blobUrl: string): Promise<string> {
  const blob = await fetch(blobUrl).then(r => r.blob())
  const filename = `photobooth/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  return uploadStorageFile(filename, blob, 'image/jpeg')
}

/**
 * Upload a video recap blob URL to Firebase Storage.
 * mimeType drives the file extension and Content-Type header.
 */
export async function uploadVideoToFirebase(blobUrl: string, mimeType = 'video/webm'): Promise<string> {
  const blob = await fetch(blobUrl).then(r => r.blob())
  const baseMime = mimeType.split(';')[0].trim()
  const ext = baseMime === 'video/mp4' ? 'mp4' : 'webm'
  const filename = `recap/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  return uploadStorageFile(filename, blob, baseMime)
}
