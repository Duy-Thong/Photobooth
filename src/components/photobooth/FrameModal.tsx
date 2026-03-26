import { useState, useEffect, useMemo } from 'react'
import { Modal, Input, Spin, Empty } from 'antd'
import { fetchFrames, fetchCategories, frameImageUrl } from '@/lib/frameService'
import type { FrameItem, FrameCategory } from '@/lib/frameService'
import type { LayoutConfig } from '@/types/photobooth'
import ContributeFrameModal from './ContributeFrameModal'

interface FrameModalProps {
  open: boolean
  currentLayout: LayoutConfig
  selectedFrameUrl: string | null
  onSelect: (url: string, frame: FrameItem) => void
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
  const [slotFilter, setSlotFilter] = useState<number>(currentLayout.slots)
  const [preview, setPreview] = useState<FrameItem | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)

  // Sync slotFilter when modal opens (layout may have changed outside)
  useEffect(() => {
    if (open) setSlotFilter(currentLayout.slots)
  }, [open, currentLayout.slots])

  // Load data when modal opens — wait for Firebase, no static preload
  useEffect(() => {
    if (!open) return
    if (frames.length > 0) return // already loaded (cached)
    setLoading(true)
    setError(null)
    Promise.all([fetchFrames(), fetchCategories()])
      .then(([f, c]) => { setFrames(f); setCategories(c) })
      .catch(() => setError('Không tải được danh sách khung. Kiểm tra kết nối mạng.'))
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = slotFilter > 0
      ? frames.filter(f => f.slots === slotFilter)
      : frames
    if (activeCategoryId !== null) {
      list = list.filter((f) => f.categoryId === activeCategoryId)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return list
  }, [frames, slotFilter, activeCategoryId, search])

  // Categories available for current slot filter
  const availableCategories = useMemo(() => {
    const base = slotFilter > 0
      ? frames.filter(f => f.slots === slotFilter)
      : frames
    const ids = new Set(base.map(f => f.categoryId))
    return categories.filter(c => ids.has(c.id))
  }, [frames, categories, slotFilter])

  // Distinct slot counts in ALL frames
  const availableSlots = useMemo(() => {
    const counts = [...new Set(frames.map(f => f.slots))].sort((a, b) => a - b)
    return counts
  }, [frames])

  function handleConfirm() {
    if (!preview) return
    onSelect(frameImageUrl(preview.filename, preview.storageUrl), preview)
    setPreview(null)
  }

  return (
    <>
      {/* Frame selection modal */}
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <span className="font-semibold text-sm tracking-tight">
            Chọn Khung Ảnh
          </span>
        }
        footer={
          <div className="flex justify-between items-center">
            <button
              onClick={() => { onClear(); onClose() }}
              disabled={!selectedFrameUrl}
              className="text-xs px-3 py-1.5 rounded-md border border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Bỏ Khung
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setContributeOpen(true)}
                className="text-xs px-3 py-1.5 rounded-md border border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444] transition"
              >
                + Đóng góp khung
              </button>
              <button
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-md border border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444] transition"
              >
                Huỷ
              </button>
            </div>
          </div>
        }
        width={680}
        centered
      >
        {/* Slot count filter pills */}
        {availableSlots.length > 1 && (
          <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white font-semibold uppercase tracking-[0.15em] shrink-0">Số Ảnh:</span>
            {availableSlots.map(n => (
              <button
                key={n}
                onClick={() => { setSlotFilter(n); setActiveCategoryId(null) }}
                className={`text-[11px] px-2.5 py-0.5 rounded-md border transition-all duration-150 ${
                  slotFilter === n
                    ? 'bg-white text-black border-white font-semibold'
                    : 'border-[#252525] text-[#5a5a5a] hover:border-[#3a3a3a] hover:text-[#bbb]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-1 pb-3">
          <Input.Search
            placeholder="Tìm kiếm khung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </div>

        {/* Category pills */}
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {[
            { id: null, name: 'Tất cả' },
            ...availableCategories
          ].map((cat) => {
            const active = cat.id === activeCategoryId
            return (
              <button
                key={cat.id ?? 'all'}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`text-[11px] px-3 py-1 rounded-md border transition-all duration-150 ${
                  active
                    ? 'bg-white text-black border-white font-semibold'
                    : 'border-[#252525] text-[#5a5a5a] hover:border-[#3a3a3a] hover:text-[#bbb]'
                }`}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Frame grid */}
        <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 400 }}>
          {loading && (
            <div className="flex justify-center py-12">
              <Spin size="large" />
            </div>
          )}
          {error && <p className="text-center text-red-400 py-8 text-sm">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <Empty description="Không tìm thấy khung phù hợp" />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map((frame) => {
                const imgUrl = frameImageUrl(frame.filename, frame.storageUrl)
                const isActive = selectedFrameUrl === imgUrl
                return (
                  <button
                    key={frame.id}
                    onClick={() => setPreview(frame)}
                    className={`relative rounded-lg overflow-hidden border transition-all duration-150 aspect-3/4 bg-[#111] flex flex-col items-center ${
                      isActive
                        ? 'border-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]'
                        : 'border-[#1e1e1e] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={frame.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white/80 font-medium bg-black/50 py-0.5 truncate px-1">
                      {frame.name}
                    </span>
                    {isActive && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                          <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}

            </div>
          )}
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!preview}
        onCancel={() => setPreview(null)}
        title={<span className="font-semibold text-sm">{preview?.name}</span>}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPreview(null)}
              className="text-xs px-3 py-1.5 rounded-md border border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444] transition"
            >
              Huỷ
            </button>
            <button
              onClick={handleConfirm}
              className="text-xs px-4 py-1.5 rounded-md bg-white text-black font-semibold hover:bg-[#e8e8e8] active:scale-[0.98] transition"
            >
              Áp dụng
            </button>
          </div>
        }
        width={320}
        centered
      >
        {preview && (
          <div className="flex flex-col items-center gap-3 py-3">
            <img
              src={frameImageUrl(preview.filename, preview.storageUrl)}
              alt={preview.name}
              className="w-44 object-contain rounded-md"
            />
            <p className="text-[11px] text-[#555]">{preview.categoryName}</p>
          </div>
        )}
      </Modal>
      <ContributeFrameModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
    </>
  )
}
