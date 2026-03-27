import type { CapturedSlot, LayoutConfig, EffectType, SlotRect } from '@/types/photobooth'
import QRCode from 'qrcode'

const STRIP_BG = '#fff'
const PADDING = 16
const GAP = 10

/**
 * Apply post-capture canvas effects to each slot image.
 */
export function applyEffects(
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
    // Only set crossOrigin for external http(s) URLs.
    // Setting it on blob: or data: URLs taints the canvas and breaks toBlob().
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }
    img.src = src
  })
}

// ─── Transparency-mask slot detection ─────────────────────────────────────────

/**
 * Scan a frame PNG for connected transparent (alpha < 10) regions using a
 * stack-based DFS on a downsampled canvas (25 % of original), then scale
 * the bounding boxes back to full resolution.
 *
 * Returns slots sorted top→bottom, left→right.
 */
export async function detectFrameSlots(frameUrl: string): Promise<SlotRect[]> {
  const img = await loadImage(frameUrl)
  return detectSlotsFromImg(img)
}

function detectSlotsFromImg(img: HTMLImageElement): SlotRect[] {
  const W = img.naturalWidth  || img.width
  const H = img.naturalHeight || img.height

  // Downsample 4× for speed — still accurate enough for slot detection
  const SCALE = 0.25
  const sw = Math.max(1, Math.round(W * SCALE))
  const sh = Math.max(1, Math.round(H * SCALE))

  const offscreen = document.createElement('canvas')
  offscreen.width  = sw
  offscreen.height = sh
  const ctx = offscreen.getContext('2d')!
  ctx.drawImage(img, 0, 0, sw, sh)
  const { data } = ctx.getImageData(0, 0, sw, sh)

  const ALPHA_THRESH = 10
  // Minimum slot area: 0.5 % of the scan canvas (filters stray transparent edges)
  const minArea = Math.max(4, Math.round(sw * sh * 0.005))

  const trans   = new Uint8Array(sw * sh)
  const visited = new Uint8Array(sw * sh)
  for (let i = 0; i < sw * sh; i++) {
    if (data[i * 4 + 3] < ALPHA_THRESH) trans[i] = 1
  }

  const slots: SlotRect[] = []

  for (let start = 0; start < sw * sh; start++) {
    if (!trans[start] || visited[start]) continue

    // Stack-based DFS (avoids call-stack overflow on large transparent regions)
    const stack = [start]
    visited[start] = 1
    let minX = sw, maxX = 0, minY = sh, maxY = 0
    let area = 0

    while (stack.length) {
      const idx = stack.pop()!
      const px = idx % sw
      const py = (idx / sw) | 0
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      area++

      // 4-connected neighbours
      if (px > 0)      { const n = idx - 1;  if (trans[n] && !visited[n]) { visited[n] = 1; stack.push(n) } }
      if (px < sw - 1) { const n = idx + 1;  if (trans[n] && !visited[n]) { visited[n] = 1; stack.push(n) } }
      if (py > 0)      { const n = idx - sw; if (trans[n] && !visited[n]) { visited[n] = 1; stack.push(n) } }
      if (py < sh - 1) { const n = idx + sw; if (trans[n] && !visited[n]) { visited[n] = 1; stack.push(n) } }
    }

    if (area >= minArea) {
      slots.push({
        x: Math.round(minX / SCALE),
        y: Math.round(minY / SCALE),
        w: Math.round((maxX - minX + 1) / SCALE),
        h: Math.round((maxY - minY + 1) / SCALE),
      })
    }
  }

  // Sort top→bottom, then left→right
  slots.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
  return slots
}

// ─── Cover-fit helper ─────────────────────────────────────────────────────────

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width  * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

// ─── Main compositing function ────────────────────────────────────────────────

/**
 * Compose all slot images + optional frame overlay into a single canvas and
 * return a blob URL.
 *
 * When a frameUrl is provided the frame PNG is scanned for transparent regions
 * (alpha < 10) using detectSlotsFromImg().  If at least one slot is found the
 * canvas is sized to the frame's natural dimensions and photos are composited
 * directly into those regions before the frame is drawn on top.
 *
 * When no frame is provided (or detection finds nothing) the classic grid
 * layout is used as a fallback.
 */
export async function buildStripImage(
  slots: (CapturedSlot | null)[],
  layout: LayoutConfig,
  effects: EffectType[],
  frameUrl: string | null,
  slots_data?: SlotRect[],
  isX2?: boolean,
): Promise<string> {

  // ── Frame-based path ────────────────────────────────────────────────────────
  if (frameUrl) {
    const frameImg = await loadImage(frameUrl)
    const frameSlots = slots_data || detectSlotsFromImg(frameImg)

    if (frameSlots.length > 0) {
      const fW = frameImg.naturalWidth  || frameImg.width
      const fH = frameImg.naturalHeight || frameImg.height

      const canvas = document.createElement('canvas')
      canvas.width  = isX2 ? fW * 2 : fW
      canvas.height = fH
      const ctx = canvas.getContext('2d')!

      ctx.fillStyle = STRIP_BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const photos = slots.filter((s): s is CapturedSlot => s !== null)

      const drawStrip = async (offsetX: number) => {
        await Promise.all(
          frameSlots.map(async ({ x, y, w, h }, i) => {
            const photo = photos[i]
            if (!photo) return
            const img = await loadImage(photo.dataUrl)
            ctx.save()
            ctx.translate(offsetX, 0)
            ctx.beginPath()
            ctx.rect(x, y, w, h)
            ctx.clip()
            drawCoverFit(ctx, img, x, y, w, h)
            applyEffects(ctx, effects, x, y, w, h)
            ctx.restore()
          }),
        )
        // Draw frame on top of this strip
        ctx.drawImage(frameImg, offsetX, 0, fW, fH)
      }

      await drawStrip(0)
      if (isX2) await drawStrip(fW)

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('canvas.toBlob returned null (canvas taint?)')),
          'image/jpeg',
          0.93,
        )
      })
    }
    // Detection found nothing → fall through to grid path with frame overlay
  }

  // ── Fallback: classic grid layout ───────────────────────────────────────────
  const { cols, rows } = layout

  const SLOT_W = 400
  const SLOT_H = Math.round(SLOT_W * (3 / 4)) // 4:3

  const canvasW = PADDING * 2 + cols * SLOT_W + (cols - 1) * GAP
  const canvasH = PADDING * 2 + rows * SLOT_H + (rows - 1) * GAP

  const canvas = document.createElement('canvas')
  canvas.width  = isX2 ? canvasW * 2 : canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = STRIP_BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const drawGridStrip = async (offsetX: number) => {
    await Promise.all(
      slots.map(async (slot, i) => {
        if (!slot) return
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = PADDING + col * (SLOT_W + GAP)
        const y = PADDING + row * (SLOT_H + GAP)

        const img = await loadImage(slot.dataUrl)

        ctx.save()
        ctx.translate(offsetX, 0)
        ctx.beginPath()
        ctx.roundRect(x, y, SLOT_W, SLOT_H, 8)
        ctx.clip()
        drawCoverFit(ctx, img, x, y, SLOT_W, SLOT_H)
        applyEffects(ctx, effects, x, y, SLOT_W, SLOT_H)
        ctx.restore()
      }),
    )

    if (frameUrl) {
      try {
        const frameImg = await loadImage(frameUrl)
        ctx.drawImage(frameImg, offsetX, 0, canvasW, canvasH)
      } catch { /* ignore */ }
    }
  }

  await drawGridStrip(0)
  if (isX2) await drawGridStrip(canvasW)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('canvas.toBlob returned null (canvas taint?)')),
      'image/jpeg',
      0.93,
    )
  })
}

/**
 * Composite N per-slot clip blob URLs into a single "strip video" where all
 * clips play simultaneously inside the matching transparent slot regions of
 * the frame PNG (same detection logic as buildStripImage).
 * The frame is drawn at its natural size on top of the videos.
 * Returns a blob URL, or null on failure.
 */
export async function buildStripVideo(
  clipUrls: string[],
  frameUrl: string,
  slots_data?: SlotRect[],
  fps: 12 | 24 = 12,
  isX2?: boolean,
): Promise<string | null> {
  if (!clipUrls.length) return null

  const frameImg = await loadImage(frameUrl)
  const frameSlots = slots_data || detectSlotsFromImg(frameImg)
  if (!frameSlots.length) return null

  const fW = frameImg.naturalWidth  || frameImg.width
  const fH = frameImg.naturalHeight || frameImg.height

  // Create a video element for each clip
  const videos: HTMLVideoElement[] = clipUrls.map(url => {
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    return v
  })

  // Wait until metadata is available so we have duration + dimensions
  await Promise.all(videos.map(v =>
    new Promise<void>(resolve => {
      if (v.readyState >= 1) { resolve(); return }
      v.onloadedmetadata = () => resolve()
      v.onerror = () => resolve()
      v.load()
    }),
  ))

  const canvas = document.createElement('canvas')
  canvas.width  = isX2 ? fW * 2 : fW
  canvas.height = fH
  const ctx = canvas.getContext('2d')!

  const recMime =
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' :
    MediaRecorder.isTypeSupported('video/mp4')             ? 'video/mp4'             :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
    MediaRecorder.isTypeSupported('video/webm')            ? 'video/webm'            : ''

  const chunks: Blob[] = []
  let recorder: MediaRecorder
  try {
    recorder = recMime
      ? new MediaRecorder(canvas.captureStream(fps), { mimeType: recMime })
      : new MediaRecorder(canvas.captureStream(fps))
  } catch {
    videos.forEach(v => { v.src = '' })
    return null
  }
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  function drawFrame() {
    ctx.fillStyle = STRIP_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const drawStrip = (offsetX: number) => {
      frameSlots.forEach(({ x, y, w, h }, i) => {
        const vid = videos[i]
        if (!vid || !vid.videoWidth) return
        const scale = Math.max(w / vid.videoWidth, h / vid.videoHeight)
        const dw = vid.videoWidth  * scale
        const dh = vid.videoHeight * scale
        ctx.save()
        ctx.translate(offsetX, 0)
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        ctx.drawImage(vid, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
        ctx.restore()
      })
      ctx.drawImage(frameImg, offsetX, 0, fW, fH)
    }

    drawStrip(0)
    if (isX2) drawStrip(fW)
  }

  return new Promise(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || recMime || 'video/webm' })
      videos.forEach(v => { v.src = '' })
      resolve(blob.size > 0 ? URL.createObjectURL(blob) : null)
    }

    recorder.start(200)

    const maxDuration = Math.max(...videos.map(v => (isFinite(v.duration) ? v.duration : 0)))
    const safetyMs = (maxDuration > 0 ? maxDuration * 1000 : 15_000) + 2_000
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      clearInterval(interval)
      if (recorder.state !== 'inactive') recorder.stop()
    }

    const interval = setInterval(() => {
      drawFrame()
      if (videos.every(v => v.ended || !!v.error)) stop()
    }, Math.round(1000 / fps))

    setTimeout(stop, safetyMs)

    videos.forEach(v => v.play().catch(() => {}))
  })
}

/**
 * Robust download for any media type (image, video, etc).
 * Fetches the URL as a blob to bypass cross-origin restrictions on the 'download' attribute.
 */
export async function downloadMedia(url: string, filename: string) {
  try {
    // If it's already a local blob/data URL, just download it directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    // For external URLs, fetch as blob first
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch media: ${res.statusText}`)
    
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
  } catch (err) {
    console.error('Download failed:', err)
    // Fallback: open in new tab if blob download fails
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }
}

export function downloadImage(url: string, filename = 'photobooth.jpg') {
  downloadMedia(url, filename)
}

/**
 * Stamp a QR code onto an existing image blob URL.
 * The QR encodes `qrUrl` and is placed at the bottom-right corner of the image.
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
  const qrX = canvas.width - qrW - 12
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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('canvas.toBlob returned null (canvas taint?)')),
      'image/jpeg',
      0.93,
    )
  })
}
