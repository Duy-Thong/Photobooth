import { create } from 'zustand'
import { type FilterType, type EffectType, type LayoutConfig, type CapturedSlot, LAYOUTS } from '@/types/photobooth'
import type { FrameItem } from '@/lib/frameService'

interface PhotoboothState {
  // Layout
  layout: LayoutConfig
  countdown: number
  setLayout: (layout: LayoutConfig) => void
  setLayoutKeepPhotos: (layout: LayoutConfig) => void
  setCountdown: (n: number) => void

  // Filter & Effects
  activeFilter: FilterType
  activeEffects: EffectType[]
  setFilter: (f: FilterType) => void
  toggleEffect: (e: EffectType) => void

  // Captured photos
  capturedSlots: (CapturedSlot | null)[]
  addPhoto: (dataUrl: string, fromCamera?: boolean) => void
  replaceSlot: (index: number, dataUrl: string) => void
  resetPhotos: () => void

  // Session state
  isCapturing: boolean
  setIsCapturing: (v: boolean) => void

  // Final output
  finalImageUrl: string | null
  setFinalImageUrl: (url: string | null) => void

  // Frame overlay
  selectedFrame: FrameItem | null
  setSelectedFrame: (frame: FrameItem | null) => void
}

export const usePhotoboothStore = create<PhotoboothState>((set, get) => ({
  layout: LAYOUTS[0], // 1x4 default
  countdown: 3,
  setLayout: (layout) => set({ layout, capturedSlots: Array(layout.slots).fill(null), finalImageUrl: null }),
  setLayoutKeepPhotos: (layout) => set({ layout }),
  setCountdown: (countdown) => set({ countdown }),

  activeFilter: 'none',
  activeEffects: [],
  setFilter: (activeFilter) => set({ activeFilter }),
  toggleEffect: (effect) => set((s) => ({
    activeEffects: s.activeEffects.includes(effect)
      ? s.activeEffects.filter(e => e !== effect)
      : [...s.activeEffects, effect],
  })),

  capturedSlots: Array(LAYOUTS[0].slots).fill(null),
  addPhoto: (dataUrl, fromCamera = true) => {
    const { capturedSlots } = get()
    const idx = capturedSlots.findIndex(s => s === null)
    if (idx === -1) return
    const next = [...capturedSlots]
    next[idx] = { dataUrl, fromCamera }
    set({ capturedSlots: next })
  },
  replaceSlot: (index, dataUrl) => {
    const next = [...get().capturedSlots]
    next[index] = { dataUrl, fromCamera: false }
    set({ capturedSlots: next })
  },
  resetPhotos: () => set((s) => ({
    capturedSlots: Array(s.layout.slots).fill(null),
    finalImageUrl: null,
  })),

  isCapturing: false,
  setIsCapturing: (isCapturing) => set({ isCapturing }),

  finalImageUrl: null,
  setFinalImageUrl: (finalImageUrl) => set({ finalImageUrl }),

  selectedFrame: null,
  setSelectedFrame: (selectedFrame) => set({ selectedFrame }),
}))
