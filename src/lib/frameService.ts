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
}

export interface FrameCategory {
  id: number
  name: string
}

export function frameImageUrl(filename: string): string {
  return `/frames/${filename}`
}

export async function fetchFrames(): Promise<FrameItem[]> {
  return STATIC_FRAMES
}

export async function fetchCategories(): Promise<FrameCategory[]> {
  const seen = new Map<number, string>()
  for (const f of STATIC_FRAMES) {
    if (!seen.has(f.categoryId)) seen.set(f.categoryId, f.categoryName)
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}

