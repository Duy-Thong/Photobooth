import { useRef, memo, useEffect } from 'react'
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

  return (
    <div className="flex flex-col gap-2">

      {/* ── Live composite preview ── */}
      <div className={`relative rounded-2xl border overflow-hidden flex items-center justify-center p-0.5 shadow-2xl max-h-[360px] sm:max-h-[440px] md:max-h-[calc(100dvh-220px)] w-auto max-w-full mx-auto ${tc('bg-[#0d0d0d] border-[#1f1f1f]', 'bg-[#f0f0f0] border-[#e0e0e0]')}`} 
        style={{ aspectRatio: containerAspectRatio }}>
        
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
            className="w-full h-full object-contain relative z-10 block"
          />
        ) : (
          /* No preview yet — show empty slot placeholders */
          <div
            className="w-full h-full p-1.5 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
          >
            {slots.map((slot, i) => {
              return (
                <div
                  key={i}
                  className={`${layout.cols === 1 ? 'aspect-4/3' : 'aspect-square'} bg-transparent rounded-lg border border-dashed border-white/10 flex items-center justify-center overflow-hidden relative`}
                >
                  {slot ? (
                    <img src={slot.dataUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-lg font-bold select-none opacity-0">{i + 1}</span>
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
      </div>

      {/* ── Mini thumbnails for remove / replace ── */}
      {filled > 0 && (
        <div className="flex gap-2 justify-start sm:justify-center overflow-x-auto no-scrollbar flex-nowrap py-0.5 max-w-full">
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider opacity-50 ${tc('text-white', 'text-black')}`}>Ảnh đã chụp</span>
          <span className={`text-xs font-bold tabular-nums opacity-80 ${tc('text-white', 'text-black')}`}>{filled} / {layout.slots}</span>
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
