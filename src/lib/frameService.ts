export interface FrameItem {
  id: number
  filename: string
  name: string
  /** API frame type: 'square' = strip (1x3/1x4), 'bigrectangle' = tall/1x2, 'grid' = 2x2 */
  frame: 'square' | 'bigrectangle' | 'grid'
  categoryId: number
  categoryName: string
}

export interface FrameCategory {
  id: number
  name: string
}

const CDN_BASE = 'https://cdn.freehihi.com'

export function frameImageUrl(filename: string): string {
  return `${CDN_BASE}/${filename}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFrame(item: any): FrameItem {
  return {
    id: item.id,
    filename: item.filename,
    name: item.name,
    frame: item.frame,
    categoryId: Number(item.category_id),
    categoryName: item.category?.name ?? '',
  }
}

export async function fetchFrames(): Promise<FrameItem[]> {
  const res = await fetch('/api/images')
  if (!res.ok) throw new Error(`Failed to fetch frames: ${res.status}`)
  const data = await res.json()
  return (data as unknown[]).map(mapFrame)
}

export async function fetchCategories(): Promise<FrameCategory[]> {
  const res = await fetch('/api/categories')
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`)
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((c) => ({ id: Number(c.id), name: c.name }))
}
