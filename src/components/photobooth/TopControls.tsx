import { LAYOUTS, COUNTDOWN_OPTIONS } from '@/types/photobooth'
import type { LayoutConfig } from '@/types/photobooth'

// One representative layout per unique slot count (prefer cols=1)
const SLOT_OPTIONS = [1, 2, 3, 4, 6].map(
  n => LAYOUTS.find(l => l.slots === n && l.cols === 1) ?? LAYOUTS.find(l => l.slots === n)!
)

interface TopControlsProps {
  layout: LayoutConfig
  countdown: number
  hasFrame: boolean
  onLayoutChange: (layout: LayoutConfig) => void
  onCountdownChange: (n: number) => void
}

const PILL = 'text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all duration-150'
const PILL_ON = `${PILL} bg-white text-black border-white`
const PILL_OFF = `${PILL} border-[#252525] text-[#666] hover:border-[#3a3a3a] hover:text-[#bbb]`

export default function TopControls({
  layout,
  countdown,
  hasFrame,
  onLayoutChange,
  onCountdownChange,
}: TopControlsProps) {
  return (
    <div className="flex items-center gap-5 flex-wrap">
      {/* Số ảnh — chỉ hiện khi chưa chọn frame */}
      {!hasFrame && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#444] text-[9px] font-semibold uppercase tracking-[0.18em]">Số Ảnh</span>
            <div className="flex gap-1">
              {SLOT_OPTIONS.map(l => (
                <button
                  key={l.slots}
                  onClick={() => onLayoutChange(l)}
                  className={layout.slots === l.slots ? PILL_ON : PILL_OFF}
                >
                  {l.slots}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-8 bg-[#1e1e1e] hidden sm:block" />
        </>
      )}

      {/* Countdown pills */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[#444] text-[9px] font-semibold uppercase tracking-[0.18em]">Đếm Ngược</span>
        <div className="flex gap-1">
          {COUNTDOWN_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => onCountdownChange(n)}
              className={countdown === n ? PILL_ON : PILL_OFF}
            >
              {n}s
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
