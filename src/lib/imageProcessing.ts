import type { CapturedSlot, LayoutConfig, EffectType } from '@/types/photobooth'
import QRCode from 'qrcode'

const STRIP_BG = '#fff'
const PADDING = 16
const GAP = 10

/**
 * Apply post-capture canvas effects to each slot image.
 */
function applyEffects(
  ctx: CanvasRenderingContext2D,
  effects: EffectType[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (effects.includes('vignette')) {
    const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.3, x + w / 2, y + h / 2, w * 0.85)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, w, h)
  }

  if (effects.includes('grain')) {
    const grainCanvas = document.createElement('canvas')
    grainCanvas.width = w
    grainCanvas.height = h
    const gCtx = grainCanvas.getContext('2d')!
    const imageData = gCtx.createImageData(w, h)
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = (Math.random() - 0.5) * 60
      imageData.data[i] = 128 + v
      imageData.data[i + 1] = 128 + v
      imageData.data[i + 2] = 128 + v
      imageData.data[i + 3] = 28
    }
    gCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(grainCanvas, x, y, w, h)
  }

  if (effects.includes('lightleak')) {
    const llGrad = ctx.createLinearGradient(x, y, x + w, y + h)
    llGrad.addColorStop(0, 'rgba(255,220,100,0)')
    llGrad.addColorStop(0.3, 'rgba(255,180,60,0.25)')
    llGrad.addColorStop(0.6, 'rgba(255,100,20,0.15)')
    llGrad.addColorStop(1, 'rgba(255,220,100,0)')
    ctx.fillStyle = llGrad
    ctx.fillRect(x, y, w, h)
  }

  if (effects.includes('chromatic')) {
    // Simple red/blue channel shift overlay
    ctx.save()
    ctx.globalAlpha = 0.08
    ctx.fillStyle = 'rgba(255,0,0,1)'
    ctx.fillRect(x - 2, y, w, h)
    ctx.fillStyle = 'rgba(0,0,255,1)'
    ctx.fillRect(x + 2, y, w, h)
    ctx.restore()
  }

  if (effects.includes('timestamp')) {
    const now = new Date()
    const ts = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
    ctx.save()
    ctx.font = `bold ${Math.max(10, w * 0.06)}px monospace`
    ctx.fillStyle = 'rgba(255,220,80,0.9)'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 4
    ctx.fillText(ts, x + w * 0.04, y + h - h * 0.05)
    ctx.restore()
  }
}

/**
 * Load an image from a data URL / URL into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Compose all slot images + frame overlay into a single canvas and return a blob URL.
 */
export async function buildStripImage(
  slots: (CapturedSlot | null)[],
  layout: LayoutConfig,
  effects: EffectType[],
  frameUrl: string | null,
): Promise<string> {
  const { cols, rows } = layout

  // Determine slot size (use 400px per slot as base)
  const SLOT_W = 400
  const SLOT_H = Math.round(SLOT_W * (3 / 4)) // 4:3 ratio

  const canvasW = PADDING * 2 + cols * SLOT_W + (cols - 1) * GAP
  const canvasH = PADDING * 2 + rows * SLOT_H + (rows - 1) * GAP

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = STRIP_BG
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Draw each slot
  await Promise.all(
    slots.map(async (slot, i) => {
      if (!slot) return
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = PADDING + col * (SLOT_W + GAP)
      const y = PADDING + row * (SLOT_H + GAP)

      const img = await loadImage(slot.dataUrl)

      // Cover-fit the image into the slot
      const scale = Math.max(SLOT_W / img.width, SLOT_H / img.height)
      const sw = img.width * scale
      const sh = img.height * scale
      const sx = (SLOT_W - sw) / 2
      const sy = (SLOT_H - sh) / 2

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, SLOT_W, SLOT_H, 8)
      ctx.clip()
      ctx.drawImage(img, x + sx, y + sy, sw, sh)

      // Apply effects per slot
      applyEffects(ctx, effects, x, y, SLOT_W, SLOT_H)
      ctx.restore()
    }),
  )

  // Frame overlay (PNG transparent)
  if (frameUrl) {
    try {
      const frameImg = await loadImage(frameUrl)
      ctx.drawImage(frameImg, 0, 0, canvasW, canvasH)
    } catch {
      // frame failed to load — ignore
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(URL.createObjectURL(blob!)),
      'image/jpeg',
      0.93,
    )
  })
}

export function downloadImage(url: string, filename = 'photobooth.jpg') {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

/**
 * Stamp a QR code onto an existing image blob URL.
 * The QR encodes `qrUrl` and is placed at the bottom-center of the image.
 * Returns a new blob URL with the QR stamped on.
 */
export async function stampQrOnImage(
  imageBlobUrl: string,
  qrUrl: string,
): Promise<string> {
  // Render QR to an off-screen canvas via qrcode lib
  const QR_SIZE = 120
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, qrUrl, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })

  // Load the strip image
  const stripImg = await loadImage(imageBlobUrl)
  const canvas = document.createElement('canvas')
  canvas.width = stripImg.width
  canvas.height = stripImg.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(stripImg, 0, 0)

  // White rounded background for QR
  const pad = 8
  const qrW = QR_SIZE + pad * 2
  const qrH = QR_SIZE + pad * 2 + 16 // extra for label
  const qrX = (canvas.width - qrW) / 2
  const qrY = canvas.height - qrH - 12

  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.roundRect(qrX, qrY, qrW, qrH, 8)
  ctx.fill()

  // Draw QR onto strip
  ctx.drawImage(qrCanvas, qrX + pad, qrY + pad, QR_SIZE, QR_SIZE)

  // Small label under QR
  ctx.fillStyle = '#555'
  ctx.font = `bold ${Math.max(9, QR_SIZE * 0.09)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Quét để xem ảnh', qrX + qrW / 2, qrY + qrH - 4)
  ctx.restore()

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(URL.createObjectURL(blob!)),
      'image/jpeg',
      0.93,
    )
  })
}
