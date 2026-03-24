import { DownloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import type { CapturedSlot, LayoutConfig } from '@/types/photobooth'
import PhotoSlot from './PhotoSlot'

interface PhotoStripProps {
  layout: LayoutConfig
  slots: (CapturedSlot | null)[]
  finalImageUrl: string | null
  onUploadSlot: (index: number, dataUrl: string) => void
  onRemoveSlot: (index: number) => void
  onDownload: () => void
  onBuildStrip: () => void
}

export default function PhotoStrip({
  layout,
  slots,
  finalImageUrl,
  onUploadSlot,
  onRemoveSlot,
  onDownload,
  onBuildStrip,
}: PhotoStripProps) {
  const filled = slots.filter(Boolean).length
  const allFilled = filled === layout.slots

  // Slot height based on layout
  const slotAspect = layout.cols === 1 ? 'aspect-[4/3]' : 'aspect-square'

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Slots grid */}
      <div
        className="flex-1 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        }}
      >
        {slots.map((slot, i) => (
          <div key={i} className={slotAspect}>
            <PhotoSlot
              index={i}
              slot={slot}
              onUpload={onUploadSlot}
              onRemove={onRemoveSlot}
            />
          </div>
        ))}
      </div>

      {/* Counter + Actions */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-full bg-pink-100 rounded-xl text-center py-2 text-pink-500 font-semibold text-sm">
          {filled}/{layout.slots}
        </div>

        {allFilled && !finalImageUrl && (
          <Button
            type="primary"
            block
            size="large"
            onClick={onBuildStrip}
            className="rounded-xl"
          >
            ✨ Tạo Ảnh
          </Button>
        )}

        {finalImageUrl && (
          <Button
            type="primary"
            block
            size="large"
            icon={<DownloadOutlined />}
            onClick={onDownload}
            className="rounded-xl"
          >
            Tải Về
          </Button>
        )}
      </div>
    </div>
  )
}
