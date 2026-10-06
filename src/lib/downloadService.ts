import JSZip from 'jszip'
import dayjs from 'dayjs'
import type { MediaItem } from '@/lib/adminMediaService'

export interface BulkDownloadProgress {
  current: number
  total: number
  percentage: number
  status: 'fetching' | 'compressing' | 'done' | 'error'
  fileName?: string
}

/**
 * Clean and normalize a filename, ensuring the appropriate extension.
 */
function getNormalizedFilename(item: MediaItem, index: number): string {
  const ext = item.type === 'video' ? (item.url.includes('.webm') ? 'webm' : 'mp4') : 'jpg'
  let rawName = item.name || (item.sessionId ? `Session_${item.sessionId.slice(0, 8)}` : `file_${index + 1}`)

  // Remove invalid file characters
  rawName = rawName.replace(/[/\\?%*:|"<>]/g, '_').trim()

  const extSuffix = `.${ext}`
  if (!rawName.toLowerCase().endsWith(extSuffix)) {
    rawName += extSuffix
  }

  return rawName
}

/**
 * Download a single media item directly.
 */
export async function downloadSingleMedia(item: MediaItem, customFilename?: string): Promise<void> {
  const fileName = customFilename || getNormalizedFilename(item, 0)

  try {
    const res = await fetch(item.url)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch (err) {
    console.error('Failed to download media directly, opening in new tab:', err)
    window.open(item.url, '_blank')
  }
}

/**
 * Download multiple media items.
 * If 1 item is provided, downloads directly.
 * If > 1 items, packages all into a ZIP archive.
 */
export async function downloadMultipleMedia(
  items: MediaItem[],
  options?: {
    zipFilename?: string
    onProgress?: (progress: BulkDownloadProgress) => void
    concurrency?: number
  },
): Promise<{ successCount: number; failCount: number }> {
  if (items.length === 0) {
    return { successCount: 0, failCount: 0 }
  }

  if (items.length === 1) {
    await downloadSingleMedia(items[0])
    options?.onProgress?.({
      current: 1,
      total: 1,
      percentage: 100,
      status: 'done',
      fileName: items[0].name,
    })
    return { successCount: 1, failCount: 0 }
  }

  const zip = new JSZip()
  const total = items.length
  let completed = 0
  let successCount = 0
  let failCount = 0
  const usedNames = new Set<string>()

  const concurrency = Math.max(1, options?.concurrency || 4)
  const queue = items.map((item, index) => ({ item, index }))

  const worker = async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (!task) break
      const { item, index } = task

      try {
        const rawName = getNormalizedFilename(item, index)
        const dotIndex = rawName.lastIndexOf('.')
        const nameStem = dotIndex !== -1 ? rawName.slice(0, dotIndex) : rawName
        const ext = dotIndex !== -1 ? rawName.slice(dotIndex) : ''

        let finalName = rawName
        let counter = 1
        while (usedNames.has(finalName.toLowerCase())) {
          finalName = `${nameStem}_${counter}${ext}`
          counter++
        }
        usedNames.add(finalName.toLowerCase())

        const res = await fetch(item.url)
        if (!res.ok) throw new Error(`HTTP error ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        zip.file(finalName, arrayBuffer)
        successCount++
      } catch (err) {
        console.error(`Failed to download ${item.fullPath}:`, err)
        failCount++
      } finally {
        completed++
        const percentage = Math.round((completed / total) * 90)
        options?.onProgress?.({
          current: completed,
          total,
          percentage,
          status: 'fetching',
          fileName: item.name,
        })
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker())
  await Promise.all(workers)

  if (successCount === 0) {
    options?.onProgress?.({ current: total, total, percentage: 0, status: 'error' })
    throw new Error('Không thể tải các file đã chọn. Vui lòng thử lại.')
  }

  options?.onProgress?.({
    current: total,
    total,
    percentage: 92,
    status: 'compressing',
  })

  // Generate ZIP file
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      const percentage = Math.min(99, 90 + Math.round(metadata.percent * 0.1))
      options?.onProgress?.({
        current: total,
        total,
        percentage,
        status: 'compressing',
      })
    },
  )

  const defaultZipName = `photobooth-${dayjs().format('YYYYMMDD-HHmmss')}.zip`
  const zipFilename = options?.zipFilename || defaultZipName

  // Trigger download
  const blobUrl = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = zipFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)

  options?.onProgress?.({
    current: total,
    total,
    percentage: 100,
    status: 'done',
  })

  return { successCount, failCount }
}
