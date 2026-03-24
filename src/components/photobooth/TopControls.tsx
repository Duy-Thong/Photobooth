import { Select } from 'antd'
import { LAYOUTS, COUNTDOWN_OPTIONS } from '@/types/photobooth'
import type { LayoutConfig } from '@/types/photobooth'

interface TopControlsProps {
  layout: LayoutConfig
  countdown: number
  frameUrl: string | null
  onLayoutChange: (layout: LayoutConfig) => void
  onCountdownChange: (n: number) => void
  onChooseFrame: () => void
}

export default function TopControls({
  layout,
  countdown,
  frameUrl,
  onLayoutChange,
  onCountdownChange,
  onChooseFrame,
}: TopControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex flex-col gap-0.5">
        <span className="text-pink-500 text-xs font-semibold">Layout Ảnh</span>
        <Select
          value={layout.type}
          onChange={(v) => onLayoutChange(LAYOUTS.find(l => l.type === v)!)}
          options={LAYOUTS.map(l => ({ value: l.type, label: l.label }))}
          size="small"
          style={{ minWidth: 120 }}
          className="rounded-lg"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-pink-500 text-xs font-semibold">Đếm Ngược</span>
        <Select
          value={countdown}
          onChange={onCountdownChange}
          options={COUNTDOWN_OPTIONS.map(n => ({ value: n, label: `${n}s` }))}
          size="small"
          style={{ minWidth: 70 }}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-pink-500 text-xs font-semibold">Hỗ Trợ Chụp</span>
        <button
          onClick={onChooseFrame}
          className={`text-sm px-3 py-1 border rounded-lg transition flex items-center gap-1.5 ${
            frameUrl
              ? 'border-pink-500 bg-pink-50 text-pink-600 font-semibold'
              : 'border-pink-400 text-pink-500 hover:bg-pink-50'
          }`}
        >
          {frameUrl && (
            <img src={frameUrl} alt="" className="w-5 h-5 object-contain rounded" />
          )}
          {frameUrl ? 'Đổi Khung' : 'Chọn Khung'}
        </button>
      </div>
    </div>
  )
}
