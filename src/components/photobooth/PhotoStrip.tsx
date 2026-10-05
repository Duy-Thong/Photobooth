import { useRef, memo, useEffect, useState } from 'react'
import { DownloadOutlined, CloseOutlined } from '@ant-design/icons'
import type { CapturedSlot, EffectType, LayoutConfig } from '@/types/photobooth'
import { useStripPreview } from '@/hooks/useStripPreview'
import type { FrameItem } from '@/lib/frameService'
import { useThemeClass } from '@/stores/themeStore'

interface PhotoStripProps {
  layout: LayoutConfig
  slots: (CapturedSlot | null)[]
  finalImageUrl: string | null
  selectedFrame: FrameItem | null
  activeEffects: EffectType[]
  stream: MediaStream | null
  isMirrored: boolean
  isCapturing?: boolean
  onUploadSlot: (index: number, dataUrl: string) => void
  onRemoveSlot: (index: number) => void
  onDownload: () => void
  onBuildStrip: () => void
  countdownValue?: number | null
  showFlash?: boolean
}

/** 
 * Separate component for the live video slot to ensure the stream 
 * is attached only once properly and doesn't flicker on parent re-renders.
 */
function LiveSlotVideo({ stream, isMirrored }: { stream: MediaStream; isMirrored: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
      style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
    />
  )
}

// ── Mini slot thumbnail ──────────────────────────────────────────────────────
function MiniSlot({
  slot, index, isCapturing, onUpload, onRemove,
}: {
  slot: CapturedSlot | null
  index: number
  isCapturing?: boolean
  onUpload: (i: number, dataUrl: string) => void
  onRemove: (i: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tc = useThemeClass()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCapturing) return
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onUpload(index, ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={`relative group shrink-0 ${isCapturing ? 'opacity-40 pointer-events-none' : ''}`}>
      {slot ? (
        <>
          <img
            src={slot.dataUrl}
            alt={`slot ${index + 1}`}
            onClick={() => !isCapturing && inputRef.current?.click()}
            title="Nhấn để đổi ảnh"
            className="w-12 h-12 sm:w-13.5 sm:h-13.5 object-cover rounded-xl cursor-pointer opacity-90 hover:opacity-100 transition-all shadow-md hover:scale-105 border border-white/10"
          />
          {!isCapturing && (
            <button
              onClick={() => onRemove(index)}
              title="Xóa ảnh này"
              className="absolute -top-1.5 -right-1.5 w-5.5 h-5.5 bg-[#ff4d4f] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#ff7875] hover:scale-110 active:scale-95 transition-all z-10 cursor-pointer"
            >
              <CloseOutlined style={{ fontSize: 11, strokeWidth: 3 }} />
            </button>
          )}
        </>
      ) : (
        <div
          onClick={() => !isCapturing && inputRef.current?.click()}
          title="Tải ảnh lên ô này"
          className={`w-12 h-12 sm:w-13.5 sm:h-13.5 rounded-xl border border-dashed flex items-center justify-center cursor-pointer transition-all hover:scale-105 shadow-sm ${tc(
            'border-[#2e2e2e] bg-[#0f0f0f] hover:border-[#666]',
            'border-[#d0d0d0] bg-[#f5f5f5] hover:border-[#888]'
          )}`}
        >
          <span className={`text-lg font-bold leading-none select-none ${tc('text-[#555]', 'text-[#aaa]')}`}>+</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={isCapturing} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export const PhotoStrip = memo(function PhotoStrip({
  layout,
  slots,
  finalImageUrl,
  selectedFrame,
  activeEffects,
  stream,
  isMirrored,
  isCapturing,
  onUploadSlot,
  onRemoveSlot,
  onDownload,
  onBuildStrip,
  countdownValue,
  showFlash,
}: PhotoStripProps) {
  const tc = useThemeClass()
  const filled = slots.filter(Boolean).length
  const allFilled = filled === layout.slots
  const nextTargetIndex = slots.findIndex(s => s === null)
  const { previewUrl, rendering, dimensions, detectedSlots } = useStripPreview(slots, selectedFrame, layout, activeEffects)

  // Use the frame's metadata dimensions first, then fall back to loaded image dimensions, then layout default
  const containerAspectRatio = selectedFrame?.width && selectedFrame?.height
    ? `${selectedFrame.width}/${selectedFrame.height}`
    : dimensions
      ? `${dimensions.w}/${dimensions.h}`
      : (layout.cols === 2 ? '2/3.1' : '1/3')

  // Mobile Auto-Slot-Focus & Zoom state
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [isZoomed, setIsZoomed] = useState(true)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripCardRef = useRef<HTMLDivElement>(null)
  const [translateY, setTranslateY] = useState(0)
  const [fittedSize, setFittedSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auto zoom on mobile while shooting, auto fit when done
  const shouldZoom = isMobile && isZoomed && !allFilled && !finalImageUrl

  useEffect(() => {
    if (!viewportRef.current) return

    const updateLayout = () => {
      if (!viewportRef.current) return
      const vpWidth = viewportRef.current.clientWidth
      const vpHeight = viewportRef.current.clientHeight
      if (vpWidth === 0 || vpHeight === 0) return

      // Determine aspect ratio
      const parts = containerAspectRatio.split('/')
      const rW = parseFloat(parts[0]) || (layout.cols === 2 ? 2 : 1)
      const rH = parseFloat(parts[1]) || (layout.cols === 2 ? 3.1 : 3)
      const ratio = rW / rH

      if (shouldZoom) {
        // Mobile slot-zoom mode: width takes 94% (up to 380px), height follows ratio
        const w = Math.min(vpWidth * 0.94, 380)
        const h = w / ratio
        setFittedSize({ width: Math.round(w), height: Math.round(h) })

        // Auto slot focus translation
        if (h > vpHeight) {
          const targetIdx = nextTargetIndex >= 0 ? nextTargetIndex : 0
          let centerRatio = (targetIdx + 0.5) / layout.slots
          if (detectedSlots && detectedSlots.length > targetIdx && dimensions && dimensions.h > 0) {
            const slot = detectedSlots[targetIdx]
            centerRatio = (slot.y + slot.h / 2) / dimensions.h
          }
          const slotPixelY = centerRatio * h
          const idealY = (vpHeight * 0.45) - slotPixelY
          const minTranslate = vpHeight - h
          const maxTranslate = 0
          setTranslateY(Math.min(maxTranslate, Math.max(minTranslate, idealY)))
        } else {
          setTranslateY(0)
        }
      } else {
        // Full view mode (Desktop or Mobile overview): fit completely inside viewport maintaining exact ratio
        const maxH = vpHeight - 6
        const maxW = vpWidth - 6

        let w = maxW
        let h = w / ratio

        if (h > maxH) {
          h = maxH
          w = h * ratio
        }

        setFittedSize({ width: Math.round(w), height: Math.round(h) })
        setTranslateY(0)
      }
    }

    updateLayout()
    const observer = new ResizeObserver(updateLayout)
    observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [shouldZoom, containerAspectRatio, layout.cols, layout.slots, nextTargetIndex, detectedSlots, dimensions])

  return (
    <div className="flex flex-col gap-1 items-center w-full h-full justify-start md:justify-center min-h-0 relative">

      {/* ── Viewport window (clips zoomed overflow on mobile) ── */}
      <div 
        ref={viewportRef}
        className={`w-full min-h-0 relative flex justify-center items-center ${
          shouldZoom ? 'h-full overflow-hidden items-start' : 'flex-1 h-full max-h-full overflow-hidden'
        }`}
      >
        {/* ── Live composite preview card ── */}
        <div
          ref={stripCardRef}
          className={`relative rounded-2xl border overflow-hidden flex items-center justify-center p-0.5 shadow-2xl shrink-0 mx-auto ${tc(
            'bg-[#0d0d0d] border-[#1f1f1f]',
            'bg-[#f0f0f0] border-[#e0e0e0]'
          )}`}
          style={{
            width: fittedSize ? `${fittedSize.width}px` : 'auto',
            height: fittedSize ? `${fittedSize.height}px` : 'auto',
            aspectRatio: containerAspectRatio,
            transform: shouldZoom ? `translateY(${translateY}px)` : 'translateY(0)',
            transition: 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        >
        
        {/* Layer 0: Individual Live Videos for each empty slot (positioned exactly in the holes) */}
        {!finalImageUrl && stream && dimensions && detectedSlots.length > 0 && (
          <div className="absolute inset-0 z-0">
            {detectedSlots.map((rect, i) => {
              // Only show live video for the NEXT slot to be captured
              if (i !== nextTargetIndex) return null
              
              const left = (rect.x / dimensions.w) * 100
              const top = (rect.y / dimensions.h) * 100
              const width = (rect.w / dimensions.w) * 100
              const height = (rect.h / dimensions.h) * 100

              return (
                <div 
                  key={`live-${i}`}
                  className="absolute overflow-hidden"
                  style={{ 
                    left: `${left}%`, 
                    top: `${top}%`, 
                    width: `${width}%`, 
                    height: `${height}%` 
                  }}
                >
                  <LiveSlotVideo stream={stream} isMirrored={isMirrored} />
                </div>
              )
            })}
          </div>
        )}

        {previewUrl ? (
          <img
            src={previewUrl}
            alt="preview"
            className="w-full h-full object-fill relative z-10 block"
          />
        ) : (
          /* No preview yet — show empty slot placeholders */
          <div
            className="w-full h-full p-2 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
          >
            {slots.map((slot, i) => {
              return (
                <div
                  key={i}
                  className={`${layout.cols === 1 ? 'aspect-4/3' : 'aspect-square'} bg-black/5 dark:bg-white/5 rounded-lg border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center overflow-hidden relative`}
                >
                  {slot ? (
                    <img src={slot.dataUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (i === nextTargetIndex && !finalImageUrl && !!stream) ? (
                    <LiveSlotVideo stream={stream} isMirrored={isMirrored} />
                  ) : (
                    <span className={`text-xs font-bold select-none opacity-25 ${tc('text-white', 'text-black')}`}>{i + 1}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Rendering spinner overlay */}
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}

        {/* Countdown overlay */}
        {typeof countdownValue === 'number' && countdownValue > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 z-30 pointer-events-none">
            <span
              className="text-white font-black select-none tracking-tight animate-pulse"
              style={{ fontSize: 'clamp(54px, 14vw, 110px)', lineHeight: 1, textShadow: '0 4px 30px rgba(0,0,0,0.95)' }}
            >
              {countdownValue}
            </span>
          </div>
        )}

        {/* Flash effect overlay */}
        {showFlash && (
          <div className="absolute inset-0 bg-white pointer-events-none z-40 transition-opacity" style={{ opacity: 0.95 }} />
        )}
      </div>

      {/* Floating Zoom Toggle Pill (Mobile only while shooting) */}
      {isMobile && !allFilled && !finalImageUrl && (
        <button
          onClick={() => setIsZoomed(prev => !prev)}
          className={`absolute bottom-2.5 right-2.5 z-30 px-3 py-1.5 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer select-none ${
            isZoomed
              ? tc('bg-white/90 text-black border-white/50 shadow-black/20', 'bg-black/90 text-white border-black/50 shadow-black/10')
              : tc('bg-[#141414]/85 text-white/90 border-[#333]', 'bg-white/85 text-black/90 border-[#ddd]')
          }`}
        >
          <span>{isZoomed ? '🔍 Toàn cảnh' : '🔎 Zoom ô'}</span>
        </button>
      )}
    </div>

      {/* ── Mini thumbnails for remove / replace (desktop/tablet only to keep mobile frame large) ── */}
      {filled > 0 && (
        <div className="hidden sm:flex gap-2 justify-start sm:justify-center overflow-x-auto no-scrollbar flex-nowrap py-0.5 max-w-full">
          {slots.map((slot, i) => (
            <MiniSlot
              key={i}
              slot={slot}
              index={i}
              isCapturing={isCapturing}
              onUpload={onUploadSlot}
              onRemove={onRemoveSlot}
            />
          ))}
        </div>
      )}

      {/* ── Status + actions ── */}
      <div className="hidden md:flex w-full flex-col gap-1.5">
        <div className="flex items-center justify-between px-2 w-full">
          <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${tc('text-white', 'text-black')}`}>Ảnh đã chụp</span>
          <span className={`text-xs font-bold tabular-nums opacity-90 ${tc('text-white', 'text-black')}`}>{filled} / {layout.slots}</span>
        </div>

        {allFilled && !finalImageUrl && (
          <button
            onClick={onBuildStrip}
            className={`w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold tracking-wide active:scale-[0.98] transition-all duration-150 shadow-xl cursor-pointer ${tc(
              'bg-white text-black hover:bg-[#eaeaea] shadow-[0_0_16px_rgba(255,255,255,0.15)]',
              'bg-black text-white hover:bg-[#222] shadow-[0_0_16px_rgba(0,0,0,0.15)]'
            )}`}
          >
            ✦ Nhận Ảnh
          </button>
        )}

        {finalImageUrl && (
          <button
            onClick={onDownload}
            className={`w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold tracking-wide active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-xl cursor-pointer ${tc(
              'bg-white text-black hover:bg-[#eaeaea] shadow-[0_0_16px_rgba(255,255,255,0.15)]',
              'bg-black text-white hover:bg-[#222] shadow-[0_0_16px_rgba(0,0,0,0.15)]'
            )}`}
          >
            <DownloadOutlined style={{ fontSize: 16 }} /> Nhận Ảnh
          </button>
        )}
      </div>
    </div>
  )
})

export default PhotoStrip
