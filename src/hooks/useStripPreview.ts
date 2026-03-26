import { useState, useEffect, useRef } from 'react'
import { detectFrameSlots, applyEffects } from '@/lib/imageProcessing'
import type { FrameItem } from '@/lib/frameService'
import type { SlotRect, CapturedSlot, EffectType, LayoutConfig } from '@/types/photobooth'

interface FrameCache {
  url: string
  img: HTMLImageElement
  slots: SlotRect[]
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function coverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/**
 * Renders a live composite preview of the current photobooth state.
 * - If a frame is selected: composites captured photos into detected transparent slots,
 *   draws empty grey placeholders for unfilled slots, then overlays the frame.
 * - If no frame: renders a simple grid of captured photos.
 * Updates whenever slots or frameUrl change.
 */
export function useStripPreview(
  slots: (CapturedSlot | null)[],
  selectedFrame: FrameItem | null,
  layout: LayoutConfig,
  effects: EffectType[] = [],
) {
  const frameUrl = selectedFrame ? (selectedFrame.storageUrl ?? `/frames/${selectedFrame.filename}`) : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [detectedSlots, setDetectedSlots] = useState<SlotRect[]>([])
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  const frameCacheRef = useRef<FrameCache | null>(null)
  // Changes when a new frame finishes loading — triggers the render effect
  const [frameCacheKey, setFrameCacheKey] = useState<string | null>(null)
  const runIdRef = useRef(0)
  const prevUrlRef = useRef<string | null>(null)

  // ── Load frame image + detect transparent slots when frameUrl changes ────────
  useEffect(() => {
    if (!frameUrl) {
      frameCacheRef.current = null
      setFrameCacheKey(null)
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = null
      }
      setPreviewUrl(null)
      return
    }
    // Already cached
    if (frameCacheRef.current?.url === frameUrl) return

    // Immediately clear old preview & show loading to avoid flashing old frame
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current)
      prevUrlRef.current = null
    }
    setPreviewUrl(null)
    setRendering(true)

    const handleLoaded = (img: HTMLImageElement, slots: SlotRect[]) => {
      frameCacheRef.current = { url: frameUrl, img, slots }
      setDetectedSlots(slots)
      setDimensions({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height })
      setFrameCacheKey(frameUrl)
    }

    if (selectedFrame?.slots_data) {
      loadImg(frameUrl).then(img => handleLoaded(img, selectedFrame.slots_data!)).catch(console.error)
    } else if (frameUrl) {
      Promise.all([
        loadImg(frameUrl),
        detectFrameSlots(frameUrl),
      ]).then(([img, detectedSlots]) => handleLoaded(img, detectedSlots)).catch(console.error)
    }
  }, [frameUrl, selectedFrame])

  // ── Render composite whenever slots or frame changes ─────────────────────────
  useEffect(() => {
    const hasPhotos = slots.some(Boolean)
    const hasFrame = Boolean(frameUrl)
    const frameReady = hasFrame && frameCacheRef.current?.url === frameUrl

    // Nothing to preview yet, and no frame loading either
    if (!hasPhotos && !hasFrame) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = null
      }
      setPreviewUrl(null)
      return
    }

    // Frame selected but still loading — wait for frameCacheKey to update
    if (hasFrame && !frameReady) return

    const runId = ++runIdRef.current
    setRendering(true)

    const render = async (): Promise<string> => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      if (frameReady && frameCacheRef.current) {
        // ── Frame-based composite ──
        const { img: frameImg, slots: frameSlots } = frameCacheRef.current
        const fW = frameImg.naturalWidth || frameImg.width
        const fH = frameImg.naturalHeight || frameImg.height
        canvas.width = fW
        canvas.height = fH

        // Start with transparent or solid background based on frame
        // Actually clear everything to be safe for transparency
        ctx.clearRect(0, 0, fW, fH)

        // Load all slot images in parallel first (safe), then draw sequentially
        // (canvas clip state is shared — concurrent save/clip/restore interleaves and corrupts clip regions)
        const frameImgMap = await Promise.all(
          frameSlots.map(async (_: SlotRect, i: number) => {
            const photo = slots[i]
            if (!photo) return null
            try { return await loadImg(photo.dataUrl) } catch { return null }
          })
        )

        const activeIndex = slots.findIndex(s => s === null)

        for (let i = 0; i < frameSlots.length; i++) {
          const { x, y, w, h } = frameSlots[i]
          const img = frameImgMap[i]
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, w, h)
          ctx.clip()
          if (img) {
            coverFit(ctx, img, x, y, w, h)
            applyEffects(ctx, effects, x, y, w, h)
          } else if (i === activeIndex) {
            // ONLY the next slot to be captured is transparent for live video
            ctx.clearRect(x, y, w, h)
          } else {
            // Future slots show placeholder grey + number
            ctx.fillStyle = '#d8d8d8'
            ctx.fillRect(x, y, w, h)
            ctx.fillStyle = '#9a9a9a'
            ctx.font = `bold ${Math.max(14, Math.round(w * 0.12))}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(i + 1), x + w / 2, y + h / 2)
          }
          ctx.restore()
        }

        // Frame overlay on top
        ctx.drawImage(frameImg, 0, 0, fW, fH)
      } else {
        // ── Grid fallback (no frame) ──
        const { cols, rows } = layout
        const SLOT_W = 300
        const SLOT_H = cols === 1 ? 225 : 300
        const PAD = 12
        const GAP = 8
        canvas.width = cols * SLOT_W + (cols - 1) * GAP + PAD * 2
        canvas.height = rows * SLOT_H + (rows - 1) * GAP + PAD * 2

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Load in parallel, draw sequentially to avoid canvas clip region corruption
        const gridImgMap = await Promise.all(
          Array.from({ length: layout.slots }, async (_, i) => {
            const photo = slots[i]
            if (!photo) return null
            try { return await loadImg(photo.dataUrl) } catch { return null }
          })
        )

        const activeIndex = slots.findIndex(s => s === null)

        for (let i = 0; i < layout.slots; i++) {
          const col = i % cols
          const row = Math.floor(i / cols)
          const x = PAD + col * (SLOT_W + GAP)
          const y = PAD + row * (SLOT_H + GAP)
          const img = gridImgMap[i]
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, SLOT_W, SLOT_H)
          ctx.clip()
          if (img) {
            coverFit(ctx, img, x, y, SLOT_W, SLOT_H)
            applyEffects(ctx, effects, x, y, SLOT_W, SLOT_H)
          } else if (i === activeIndex) {
            ctx.clearRect(x, y, SLOT_W, SLOT_H)
          } else {
            ctx.fillStyle = '#e0e0e0'
            ctx.fillRect(x, y, SLOT_W, SLOT_H)
            ctx.fillStyle = '#9a9a9a'
            ctx.font = 'bold 32px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(i + 1), x + SLOT_W / 2, y + SLOT_H / 2)
          }
          ctx.restore()
        }
      }

      return new Promise<string>((resolve, reject) => {
        canvas.toBlob(
          blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob failed')),
          'image/png',
          1.0
        )
      })
    }

    render()
      .then(url => {
        if (runId !== runIdRef.current) { URL.revokeObjectURL(url); return }
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = url
        setPreviewUrl(url)
      })
      .catch(console.error)
      .finally(() => { if (runId === runIdRef.current) setRendering(false) })
  }, [slots, frameCacheKey, frameUrl, layout])

  return { previewUrl, rendering, detectedSlots, dimensions }
}
