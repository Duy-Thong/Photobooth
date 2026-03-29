import { useRef } from 'react'
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
  onUploadSlot: (index: number, dataUrl: string) => void
  onRemoveSlot: (index: number) => void
  onDownload: () => void
  onBuildStrip: () => void
}

// ── Mini slot thumbnail ──────────────────────────────────────────────────────
function MiniSlot({
  slot, index, onUpload, onRemove,
}: {
  slot: CapturedSlot | null
  index: number
  onUpload: (i: number, dataUrl: string) => void
  onRemove: (i: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tc = useThemeClass()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onUpload(index, ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="relative group shrink-0">
      {slot ? (
        <>
          <img
            src={slot.dataUrl}
            alt={`slot ${index + 1}`}
            onClick={() => inputRef.current?.click()}
            className="w-10 h-10 object-cover rounded-lg cursor-pointer opacity-70 hover:opacity-100 transition shadow-sm"
          />
          <button
            onClick={() => onRemove(index)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ff4d4f] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#ff7875] hover:scale-110 active:scale-95 transition-all z-10"
          >
            <CloseOutlined style={{ fontSize: 9, strokeWidth: 2.5 }} />
          </button>
        </>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={`w-10 h-10 rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition ${tc(
            'border-[#1e1e1e] bg-[#0a0a0a] hover:border-[#383838]',
            'border-[#d0d0d0] bg-[#f5f5f5] hover:border-[#999]'
          )}`}
        >
          <span className={`text-lg leading-none select-none ${tc('text-[#333]', 'text-[#ccc]')}`}>+</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PhotoStrip({
  layout,
  slots,
  finalImageUrl,
  selectedFrame,
  activeEffects,
  stream,
  isMirrored,
  onUploadSlot,
  onRemoveSlot,
  onDownload,
  onBuildStrip,
}: PhotoStripProps) {
  const tc = useThemeClass()
  const filled = slots.filter(Boolean).length
  const allFilled = filled === layout.slots
  const nextTargetIndex = slots.findIndex(s => s === null)
  const { previewUrl, rendering, detectedSlots, dimensions } = useStripPreview(slots, selectedFrame, layout, activeEffects)

  // Use the frame's metadata dimensions first, then fall back to loaded image dimensions, then layout default
  const containerAspectRatio = selectedFrame?.width && selectedFrame?.height
    ? `${selectedFrame.width}/${selectedFrame.height}`
    : dimensions
      ? `${dimensions.w}/${dimensions.h}`
      : (layout.cols === 2 ? '2/3.1' : '1/3')

  return (
    <div className="flex flex-col gap-2">

      {/* ── Live composite preview ── */}
      <div className={`relative rounded-xl border overflow-hidden flex items-center justify-center p-0.5 shadow-2xl ${tc('bg-[#0d0d0d] border-[#141414]', 'bg-[#f0f0f0] border-[#e0e0e0]')}`} 
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
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => { if (el && stream) el.srcObject = stream }}
                    className="w-full h-full object-cover"
                    style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {previewUrl ? (
          <img
            src={previewUrl}
            alt="preview"
            className="w-full h-full object-contain relative z-10"
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── Mini thumbnails for remove / replace ── */}
      {filled > 0 && (
        <div className="flex gap-1.5 justify-center flex-wrap">
          {slots.map((slot, i) => (
            <MiniSlot
              key={i}
              slot={slot}
              index={i}
              onUpload={onUploadSlot}
              onRemove={onRemoveSlot}
            />
          ))}
        </div>
      )}

      {/* ── Status + actions ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] opacity-40 ${tc('text-white', 'text-black')}`}>Ảnh đã chụp</span>
          <span className={`text-[13px] font-bold tabular-nums opacity-60 ${tc('text-white', 'text-black')}`}>{filled} / {layout.slots}</span>
        </div>

        {allFilled && !finalImageUrl && (
          <button
            onClick={onBuildStrip}
            className={`w-full py-3 rounded-xl text-[13px] font-bold tracking-wide active:scale-[0.97] transition-all duration-150 shadow-lg ${tc(
              'bg-white text-black hover:bg-[#e8e8e8]',
              'bg-black text-white hover:bg-[#222]'
            )}`}
          >
            ✦ Tạo Ảnh Strip
          </button>
        )}

        {finalImageUrl && (
          <button
            onClick={onDownload}
            className={`w-full py-3 rounded-xl text-[13px] font-bold tracking-wide active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg ${tc(
              'bg-white text-black hover:bg-[#e8e8e8]',
              'bg-black text-white hover:bg-[#222]'
            )}`}
          >
            <DownloadOutlined style={{ fontSize: 16 }} /> Tải Về Máy
          </button>
        )}
      </div>
    </div>
  )
}
