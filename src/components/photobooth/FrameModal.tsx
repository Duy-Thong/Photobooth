import { useState, useEffect, useMemo } from 'react'
import { Modal, Input, Spin, Empty, Button } from 'antd'
import { fetchFrames, fetchCategories, frameImageUrl } from '@/lib/frameService'
import type { FrameItem, FrameCategory } from '@/lib/frameService'
import type { LayoutType } from '@/types/photobooth'

const LAYOUT_TO_FRAME_TYPE: Record<LayoutType, FrameItem['frame']> = {
  '1x4': 'square',
  '1x3': 'square',
  '1x1': 'square',
  '1x2': 'bigrectangle',
  '2x2': 'grid',
}

interface FrameModalProps {
  open: boolean
  currentLayout: LayoutType
  selectedFrameUrl: string | null
  onSelect: (url: string) => void
  onClear: () => void
  onClose: () => void
}

export default function FrameModal({
  open,
  currentLayout,
  selectedFrameUrl,
  onSelect,
  onClear,
  onClose,
}: FrameModalProps) {
  const [frames, setFrames] = useState<FrameItem[]>([])
  const [categories, setCategories] = useState<FrameCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [preview, setPreview] = useState<FrameItem | null>(null)

  const suggestedType = LAYOUT_TO_FRAME_TYPE[currentLayout]

  // Load data when modal opens
  useEffect(() => {
    if (!open || frames.length > 0) return
    setLoading(true)
    setError(null)
    Promise.all([fetchFrames(), fetchCategories()])
      .then(([f, c]) => {
        setFrames(f)
        setCategories(c)
      })
      .catch(() => setError('Không tải được danh sách khung. Kiểm tra kết nối mạng.'))
      .finally(() => setLoading(false))
  }, [open, frames.length])

  const filtered = useMemo(() => {
    let list = frames
      .filter((f) => f.frame === suggestedType)
    if (activeCategoryId !== null) {
      list = list.filter((f) => f.categoryId === activeCategoryId)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return list
  }, [frames, suggestedType, activeCategoryId, search])

  // Categories available for current frame type
  const availableCategories = useMemo(() => {
    const ids = new Set(frames.filter(f => f.frame === suggestedType).map(f => f.categoryId))
    return categories.filter(c => ids.has(c.id))
  }, [frames, categories, suggestedType])

  function handleConfirm() {
    if (!preview) return
    onSelect(frameImageUrl(preview.filename))
    setPreview(null)
  }

  return (
    <>
      {/* Frame selection modal */}
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <span className="text-white font-semibold text-base tracking-tight">
            Chọn Khung Ảnh
          </span>
        }
        footer={
          <div className="flex justify-between items-center pt-1">
            <Button
              onClick={() => { onClear(); onClose() }}
              disabled={!selectedFrameUrl}
              style={{ background: '#1e1e1e', color: selectedFrameUrl ? '#e5e5e5' : '#555', border: '1px solid #2a2a2a' }}
            >
              Bỏ Khung
            </Button>
            <div className="flex gap-2">
              <Button onClick={onClose} style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}>Huỷ</Button>
            </div>
          </div>
        }
        width={720}
        styles={{ 
          body: { padding: '12px 0 0', background: '#141414' },
          header: { background: '#141414', borderBottom: '1px solid #2a2a2a' },
          footer: { background: '#141414', borderTop: '1px solid #2a2a2a' },
        }}
      >
        {/* Search */}
        <div className="px-4 pb-3">
          <Input.Search
            placeholder="Tìm kiếm khung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ background: '#1e1e1e', borderColor: '#2a2a2a' }}
          />
        </div>

        {/* Category filter */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={`text-xs px-3 py-1 rounded-md border transition ${
              activeCategoryId === null
                ? 'bg-white text-black border-white font-medium'
                : 'border-[#333] text-[#888] hover:border-[#555] hover:text-white'
            }`}
          >
            Tất cả
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(activeCategoryId === cat.id ? null : cat.id)}
              className={`text-xs px-3 py-1 rounded-md border transition ${
                activeCategoryId === cat.id
                  ? 'bg-white text-black border-white font-medium'
                  : 'border-[#333] text-[#888] hover:border-[#555] hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Frame grid */}
        <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 420 }}>
          {loading && (
            <div className="flex justify-center py-12">
              <Spin size="large" />
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 py-8 text-sm">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <Empty description="Không tìm thấy khung phù hợp" />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((frame) => {
                const imgUrl = frameImageUrl(frame.filename)
                const isActive = selectedFrameUrl === imgUrl
                return (
                  <button
                    key={frame.id}
                    onClick={() => setPreview(frame)}
                    className={`relative rounded-lg overflow-hidden border transition aspect-square bg-[#1e1e1e] flex flex-col items-center ${
                      isActive
                        ? 'border-white ring-1 ring-white/30'
                        : 'border-[#2a2a2a] hover:border-[#555]'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={frame.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-white font-medium bg-black/40 py-0.5 truncate px-1">
                      {frame.name}
                    </span>
                    {isActive && (
                      <span className="absolute top-1 right-1 bg-pink-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Preview confirmation modal */}
      <Modal
        open={!!preview}
        onCancel={() => setPreview(null)}
        title={
          <span className="text-white font-semibold">
            {preview?.name}
          </span>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setPreview(null)} style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}>Huỷ</Button>
            <Button onClick={handleConfirm} style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}>
              Áp dụng
            </Button>
          </div>
        }
        width={360}
        centered
        styles={{
          body: { background: '#141414' },
          header: { background: '#141414', borderBottom: '1px solid #2a2a2a' },
          footer: { background: '#141414', borderTop: '1px solid #2a2a2a' },
        }}
      >
        {preview && (
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={frameImageUrl(preview.filename)}
              alt={preview.name}
              className="w-48 object-contain"
            />
            <p className="text-xs text-gray-400">{preview.categoryName}</p>
          </div>
        )}
      </Modal>
    </>
  )
}
