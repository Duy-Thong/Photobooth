export type FilterType =
  | 'none'
  | 'mono'
  | 'bw'
  | 'soft'
  | 'dazz-classic'
  | 'dazz-instant'

export type EffectType =
  | 'timestamp'
  | 'lightleak'
  | 'vignette'
  | 'grain'
  | 'chromatic'

export type LayoutType = '1x4' | '2x2' | '1x3' | '2x3' | '1x2' | '1x1'

export type AR3DFilterType = string

export interface ModelAsset {
  id: string
  name: string
  path: string
  type: string
  scale: number
  positionOffset: { x: number; y: number; z: number }
  rotationOffset: { x: number; y: number; z: number }
  anchorIndex: number
}

export type CaptureMode = 'manual' | 'auto'

export interface LayoutConfig {
  type: LayoutType
  label: string
  slots: number
  cols: number
  rows: number
}

export interface CapturedSlot {
  dataUrl: string      // base64 image
  fromCamera: boolean  // false = uploaded from device
}

export const LAYOUTS: LayoutConfig[] = [
  { type: '1x4', label: '1×4 Strips', slots: 4, cols: 1, rows: 4 },
  { type: '2x2', label: '2×2 Grid',   slots: 4, cols: 2, rows: 2 },
  { type: '1x3', label: '1×3 Strips', slots: 3, cols: 1, rows: 3 },
  { type: '2x3', label: '2×3 Grid',   slots: 6, cols: 2, rows: 3 },
  { type: '1x2', label: '1×2 Strips', slots: 2, cols: 1, rows: 2 },
  { type: '1x1', label: '1×1 Full',   slots: 1, cols: 1, rows: 1 },
]

export const COUNTDOWN_OPTIONS = [3, 5, 10]

export const FILTERS: { value: FilterType; label: string; css: string }[] = [
  { value: 'none',         label: 'Bình Thường',      css: 'none' },
  { value: 'mono',         label: 'Mono (Retro)',      css: 'sepia(0.8) contrast(1.1) saturate(0.7)' },
  { value: 'bw',           label: 'Đen Trắng',         css: 'grayscale(1)' },
  { value: 'soft',         label: 'Mềm Mại',           css: 'brightness(1.1) saturate(1.2) contrast(0.9)' },
  { value: 'dazz-classic', label: 'Dazz Classic',      css: 'sepia(0.4) contrast(1.15) saturate(1.3) hue-rotate(-10deg)' },
  { value: 'dazz-instant', label: 'Dazz Instant',      css: 'saturate(1.4) contrast(1.05) brightness(1.05) hue-rotate(5deg)' },
]

export const EFFECTS: { value: EffectType; label: string; emoji: string }[] = [
  { value: 'timestamp',  label: 'TimeStamp',  emoji: '📅' },
  { value: 'lightleak',  label: 'Light Leak', emoji: '☀️' },
  { value: 'vignette',   label: 'Vignette',   emoji: '🌑' },
  { value: 'grain',      label: 'Grain',      emoji: '🎞️' },
  { value: 'chromatic',  label: 'Chromatic',  emoji: '🌈' },
]

export type BackgroundType = 'none' | 'blur' | 'studio' | 'studio-blue' | 'office' | 'beach' | 'cafe'

export const BACKGROUNDS: { id: BackgroundType; name: string; url?: string }[] = [
  { id: 'none', name: 'Gốc' },
  { id: 'blur', name: 'Làm mờ' },
  { id: 'studio', name: 'Studio Đỏ' },
  { id: 'studio-blue', name: 'Studio Xanh' },
  { id: 'office', name: 'Văn phòng', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80' },
  { id: 'beach', name: 'Bãi biển', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { id: 'cafe', name: 'Quán cafe', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80' },
]
