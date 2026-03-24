import { useRef } from 'react'
import { DownloadOutlined, CloseOutlined } from '@ant-design/icons'
import type { CapturedSlot, LayoutConfig } from '@/types/photobooth'
import { useStripPreview } from '@/hooks/useStripPreview'

interface PhotoStripProps {
  layout: LayoutConfig
  slots: (CapturedSlot | null)[]
  finalImageUrl: string | null
  frameUrl: string | null
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
            className="w-8 h-8 object-cover rounded-md cursor-pointer opacity-70 hover:opacity-100 transition"
          />
          <button
            onClick={() => onRemove(index)}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white text-black rounded-full hidden group-hover:flex items-center justify-center shadow pointer-events-auto"
            style={{ fontSize: 7 }}
          >
            <CloseOutlined style={{ fontSize: 7 }} />
          </button>
        </>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-8 h-8 rounded-md border border-dashed border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-center cursor-pointer hover:border-[#333] transition"
        >
          <span className="text-[#2a2a2a] text-sm leading-none select-none">+</span>
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
  frameUrl,
  onUploadSlot,
  onRemoveSlot,
  onDownload,
  onBuildStrip,
}: PhotoStripProps) {
  const filled = slots.filter(Boolean).length
  const allFilled = filled === layout.slots
  const { previewUrl, rendering } = useStripPreview(slots, frameUrl, layout)

  return (
    <div className="flex flex-col gap-2">

      {/* ── Live composite preview ── */}
      <div className="relative bg-[#0d0d0d] rounded-xl border border-[#141414] overflow-hidden flex items-center justify-center" style={{ aspectRatio: layout.cols === 2 ? '2/3' : '1/2.2' }}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="preview"
            className="w-full h-full object-contain"
          />
        ) : (
          /* No preview yet — show empty slot placeholders */
          <div
            className="w-full h-full p-1.5 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
          >
            {slots.map((slot, i) => (
              <div
                key={i}
                className={`${layout.cols === 1 ? 'aspect-4/3' : 'aspect-square'} bg-[#111] rounded-lg border border-dashed border-[#1a1a1a] flex items-center justify-center`}
              >
                {slot ? (
                  <img src={slot.dataUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-[#1e1e1e] text-lg font-light select-none">{i + 1}</span>
                )}
              </div>
            ))}
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
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[#2e2e2e] text-[9px] font-semibold uppercase tracking-[0.15em]">Slots</span>
          <span className="text-[#3a3a3a] text-[11px] font-medium tabular-nums">{filled}/{layout.slots}</span>
        </div>

        {allFilled && !finalImageUrl && (
          <button
            onClick={onBuildStrip}
            className="w-full py-2 rounded-lg bg-white text-black text-xs font-bold tracking-wide hover:bg-[#e8e8e8] active:scale-[0.98] transition-all duration-150"
          >
            ✦ Tạo Ảnh
          </button>
        )}

        {finalImageUrl && (
          <button
            onClick={onDownload}
            className="w-full py-2 rounded-lg bg-white text-black text-xs font-bold tracking-wide hover:bg-[#e8e8e8] active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5"
          >
            <DownloadOutlined /> Tải Về
          </button>
        )}
      </div>
    </div>
  )
}
