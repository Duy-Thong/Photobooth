import { Select } from 'antd'
import { LAYOUTS, COUNTDOWN_OPTIONS } from '@/types/photobooth'
import type { LayoutConfig } from '@/types/photobooth'

interface TopControlsProps {
  layout: LayoutConfig
  countdown: number
  onLayoutChange: (layout: LayoutConfig) => void
  onCountdownChange: (n: number) => void
}

export default function TopControls({
  layout,
  countdown,
  onLayoutChange,
  onCountdownChange,
}: TopControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex flex-col gap-0.5">
        <span className="text-[#888] text-[10px] font-medium uppercase tracking-wider">Layout Ảnh</span>
        <Select
          value={layout.type}
          onChange={(v) => onLayoutChange(LAYOUTS.find(l => l.type === v)!)}
          options={LAYOUTS.map(l => ({ value: l.type, label: l.label }))}
          size="small"
          style={{ minWidth: 120, background: '#1e1e1e', borderColor: '#2a2a2a', color: '#e5e5e5' }}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[#888] text-[10px] font-medium uppercase tracking-wider">Đếm Ngược</span>
        <Select
          value={countdown}
          onChange={onCountdownChange}
          options={COUNTDOWN_OPTIONS.map(n => ({ value: n, label: `${n}s` }))}
          size="small"
          style={{ minWidth: 70, background: '#1e1e1e', borderColor: '#2a2a2a', color: '#e5e5e5' }}
        />
      </div>
    </div>
  )
}
