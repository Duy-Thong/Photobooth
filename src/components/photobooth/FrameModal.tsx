import { useState, useEffect, useMemo } from 'react'
import { Modal, Input, Spin, Empty } from 'antd'
import { fetchFrames, frameImageUrl } from '@/lib/frameService'
import type { FrameItem } from '@/lib/frameService'
import ContributeFrameModal from './ContributeFrameModal'
import { useThemeClass } from '@/stores/themeStore'

interface FrameModalProps {
  open: boolean
  selectedFrame: FrameItem | null
  onSelect: (url: string, frame: FrameItem) => void
  onClear: () => void
  onClose: () => void
  studioId?: string
}

export default function FrameModal({
  open,
  selectedFrame,
  onSelect,
  onClear,
  onClose,
  studioId,
}: FrameModalProps) {
  const tc = useThemeClass()
  const [frames, setFrames] = useState<FrameItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategoryName, setActiveCategoryName] = useState<string | null>(null)
  const [layoutFilter, setLayoutFilter] = useState<string | null>(null)
  const [preview, setPreview] = useState<FrameItem | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)



  // Load data when modal opens — wait for Firebase, no static preload
  useEffect(() => {
    if (!open) return
    if (frames.length > 0) return // already loaded (cached)
    setLoading(true)
    setError(null)
    fetchFrames(studioId)
      .then((f) => { setFrames(f); })
      .catch(() => setError('Không tải được danh sách khung. Kiểm tra kết nối mạng.'))
      .finally(() => setLoading(false))
  }, [open, studioId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = layoutFilter
      ? frames.filter(f => f.layout === layoutFilter)
      : frames
    if (activeCategoryName !== null) {
      list = list.filter((f) => f.categoryName === activeCategoryName)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return list
  }, [frames, layoutFilter, activeCategoryName, search])

  // Categories derived from frames
  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of frames) {
      if (!map.has(f.categoryName)) {
        map.set(f.categoryName, f.categoryId)
      }
    }
    return Array.from(map.entries()).map(([name, id]) => ({ id, name }))
  }, [frames])

  // Categories available for current slot filter
  const availableCategories = useMemo(() => {
    const base = layoutFilter
      ? frames.filter(f => f.layout === layoutFilter)
      : frames
    const names = new Set(base.map(f => f.categoryName))
    return categories.filter(c => names.has(c.name))
  }, [frames, categories, layoutFilter])

  // Distinct slot counts in ALL frames
  const availableLayouts = useMemo(() => {
    const layouts = [...new Set(frames.map(f => f.layout).filter(Boolean) as string[])].sort()
    return layouts
  }, [frames])

  function handleConfirm() {
    if (!preview) return
    onSelect(frameImageUrl(preview.filename, preview.storageUrl), preview)
    setPreview(null)
  }

  const chipActive = tc('bg-white text-black border-white font-semibold', 'bg-black text-white border-black font-semibold')
  const chipInactive = tc(
    'border-[#252525] text-[#5a5a5a] hover:border-[#3a3a3a] hover:text-[#bbb]',
    'border-[#d0d0d0] text-[#888] hover:border-[#999] hover:text-[#333]'
  )
  const footerBtn = tc(
    'border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444]',
    'border-[#d0d0d0] text-[#888] hover:text-[#555] hover:border-[#999]'
  )

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
              disabled={!selectedFrame}
              className={`text-xs px-3 py-1.5 rounded-md border disabled:opacity-30 disabled:cursor-not-allowed transition ${footerBtn}`}
            >
              Bỏ Khung
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setContributeOpen(true)}
                className={`text-xs px-3 py-1.5 rounded-md border transition ${footerBtn}`}
              >
                + Đóng góp khung
              </button>
              <button
                onClick={onClose}
                className={`text-xs px-3 py-1.5 rounded-md border transition ${footerBtn}`}
              >
                Huỷ
              </button>
            </div>
          </div>
        }
        width={680}
        centered
      >
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.15em] shrink-0 ${tc('text-white', 'text-black')}`}>Layout:</span>
          {['Tất cả', ...availableLayouts].map(ly => (
            <button
              key={ly}
              onClick={() => { setLayoutFilter(ly === 'Tất cả' ? null : ly) }}
              className={`text-[11px] px-2.5 py-0.5 rounded-md border transition-all duration-150 ${
                (layoutFilter === ly || (ly === 'Tất cả' && !layoutFilter))
                  ? chipActive
                  : chipInactive
              }`}
            >
              {ly}
            </button>
          ))}
        </div>

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
            const active = cat.name === activeCategoryName || (cat.id === null && activeCategoryName === null)
            return (
              <button
                key={cat.id ?? 'all'}
                onClick={() => setActiveCategoryName(cat.name === 'Tất cả' ? null : cat.name)}
                className={`text-[11px] px-3 py-1 rounded-md border transition-all duration-150 ${
                  active ? chipActive : chipInactive
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
                const isActive = selectedFrame?.id === frame.id
                return (
                  <button
                    key={frame.id}
                    onClick={() => setPreview(frame)}
                    className={`relative rounded-lg overflow-hidden border transition-all duration-150 aspect-3/4 flex flex-col items-center ${tc('bg-[#111]', 'bg-[#f5f5f5]')} ${
                      isActive
                        ? 'border-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]'
                        : tc('border-[#1e1e1e] hover:border-[#3a3a3a]', 'border-[#e0e0e0] hover:border-[#999]')
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
              className={`text-xs px-3 py-1.5 rounded-md border transition ${footerBtn}`}
            >
              Huỷ
            </button>
            <button
              onClick={handleConfirm}
              className={`text-xs px-4 py-1.5 rounded-md font-semibold active:scale-[0.98] transition ${tc(
                'bg-white text-black hover:bg-[#e8e8e8]',
                'bg-black text-white hover:bg-[#222]'
              )}`}
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
            <p className={`text-[11px] ${tc('text-[#555]', 'text-[#999]')}`}>{preview.categoryName}</p>
          </div>
        )}
      </Modal>
      <ContributeFrameModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
    </>
  )
}
