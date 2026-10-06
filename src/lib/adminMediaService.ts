import { getStoragePathFromUrl, getStableStorageUrl, listStorageFolder } from '@/utils/storage'

export interface MediaItem {
  name: string
  fullPath: string
  url: string
  timeCreated: string
  size: number
  type: 'photo' | 'video'
  sessionId?: string
}

export const getPathFromUrl = getStoragePathFromUrl

export function parseTimeFromSessionId(sessionId: string): string {
  try {
    const base36Part = sessionId.split('-')[0]
    const ts = parseInt(base36Part, 36)
    if (!isNaN(ts) && ts > 1_500_000_000_000 && ts < 2_500_000_000_000) {
      return new Date(ts).toISOString()
    }
  } catch {
    /* ignore */
  }
  return new Date().toISOString()
}

export function parseTimeFromPhotoboothFilename(filename: string): string {
  try {
    const match = filename.match(/^(\d{12,14})_/)
    if (match) {
      const ts = Number(match[1])
      if (!isNaN(ts) && ts > 1_500_000_000_000 && ts < 2_500_000_000_000) {
        return new Date(ts).toISOString()
      }
    }
  } catch {
    /* ignore */
  }
  return new Date().toISOString()
}

export async function fetchStorageOnlyMedia(
  knownPhotoPaths: Set<string>,
  knownVideoPaths: Set<string>,
  bucket: string,
): Promise<{ storagePhotos: MediaItem[]; storageVideos: MediaItem[] }> {
  const storagePhotos: MediaItem[] = []
  const storageVideos: MediaItem[] = []

  // 1. photobooth/ folder
  try {
    const pbList = await listStorageFolder('photobooth')
    for (const item of pbList.items) {
      if (!knownPhotoPaths.has(item.fullPath)) {
        storagePhotos.push({
          name: item.name,
          fullPath: item.fullPath,
          url: getStableStorageUrl(item.fullPath, bucket),
          timeCreated: parseTimeFromPhotoboothFilename(item.name),
          size: 0,
          type: 'photo',
        })
      }
    }
  } catch {
    /* ignore if folder missing */
  }

  // 2. sessions/ subfolders not in Firestore
  try {
    const sessionsList = await listStorageFolder('sessions')
    const missingPrefixes = sessionsList.prefixes.filter((p) => {
      const defaultPath = `sessions/${p.name}/strip.jpg`
      return !knownPhotoPaths.has(defaultPath)
    })

    const BATCH = 30
    for (let i = 0; i < missingPrefixes.length; i += BATCH) {
      const chunk = missingPrefixes.slice(i, i + BATCH)
      const results = await Promise.all(
        chunk.map(async (p) => {
          try {
            const sub = await listStorageFolder(p)
            return { sessionId: p.name, items: sub.items }
          } catch {
            return { sessionId: p.name, items: [] }
          }
        }),
      )
      for (const { sessionId, items } of results) {
        for (const item of items) {
          const lower = item.name.toLowerCase()
          const isPhoto = /\.(jpg|jpeg|png|webp)$/.test(lower)
          const isVideo = /\.(mp4|webm)$/.test(lower)
          const time = parseTimeFromSessionId(sessionId)
          if (isPhoto && !knownPhotoPaths.has(item.fullPath)) {
            storagePhotos.push({
              name: `Session ${sessionId.slice(0, 8)}`,
              fullPath: item.fullPath,
              url: getStableStorageUrl(item.fullPath, bucket),
              timeCreated: time,
              size: 0,
              type: 'photo',
              sessionId,
            })
          } else if (isVideo && !knownVideoPaths.has(item.fullPath)) {
            storageVideos.push({
              name: `Recap ${sessionId.slice(0, 8)}`,
              fullPath: item.fullPath,
              url: getStableStorageUrl(item.fullPath, bucket),
              timeCreated: time,
              size: 0,
              type: 'video',
              sessionId,
            })
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  storagePhotos.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())
  storageVideos.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())
  return { storagePhotos, storageVideos }
}
