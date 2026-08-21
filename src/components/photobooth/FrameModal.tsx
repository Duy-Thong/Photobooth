import { useState, useEffect, useMemo } from 'react'
import { Modal, Input, Spin, Empty } from 'antd'
import { fetchFrames, fetchCategories, frameImageUrl } from '@/lib/frameService'
import type { FrameItem, FrameCategory } from '@/lib/frameService'
import type { LayoutConfig } from '@/types/photobooth'
import ContributeFrameModal from './ContributeFrameModal'
import { useThemeClass } from '@/stores/themeStore'

interface FrameModalProps {
  open: boolean
  currentLayout: LayoutConfig
  selectedFrame: FrameItem | null
  onSelect: (url: string, frame: FrameItem) => void
  onClear: () => void
  onClose: () => void
}

export default function FrameModal({
  open,
  selectedFrame,
  onSelect,
  onClear,
  onClose,
}: FrameModalProps) {
  const tc = useThemeClass()
  const [frames, setFrames] = useState<FrameItem[]>([])
  const [categories, setCategories] = useState<FrameCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategoryName, setActiveCategoryName] = useState<string | null>(null)
  const [layoutFilter, setLayoutFilter] = useState<string | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)

  // Reset filters when modal opens: layout = 'Tất cả' (null), category = priority 'Sổ Media' if exists
  useEffect(() => {
    if (open) {
      setLayoutFilter(null)
      if (categories.length > 0) {
        const soMediaCat = categories.find(c => c.name.toLowerCase().includes('sổ media'))
        setActiveCategoryName(soMediaCat ? soMediaCat.name : null)
      }
    }
  }, [open, categories])

  // Load data when modal opens
  useEffect(() => {
    if (!open) return
    if (frames.length > 0) return
    setLoading(true)
    setError(null)
    Promise.all([fetchFrames(), fetchCategories()])
      .then(([f, c]) => {
        setFrames(f)
        setCategories(c)
        const soMediaCat = c.find(cat => cat.name.toLowerCase().includes('sổ media'))
        setActiveCategoryName(soMediaCat ? soMediaCat.name : null)
      })
      .catch(() => setError('Không tải được danh sách khung. Kiểm tra kết nối mạng.'))
      .finally(() => setLoading(false))
  }, [open, frames.length])

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

  const availableCategories = useMemo(() => {
    const base = layoutFilter
      ? frames.filter(f => f.layout === layoutFilter)
      : frames
    const names = new Set(base.map(f => f.categoryName))
    return categories.filter(c => names.has(c.name))
  }, [frames, categories, layoutFilter])

  const availableLayouts = useMemo(() => {
    return [...new Set(frames.map(f => f.layout).filter(Boolean) as string[])].sort()
  }, [frames])

  const chipActive = tc(
    'bg-white text-black font-bold border-white',
    'bg-black text-white font-bold border-black'
  )
  const chipInactive = tc(
    'border-[#262626] bg-[#141414] text-[#aaa] hover:border-[#444] hover:text-white',
    'border-[#e0e0e0] bg-[#f5f5f5] text-[#555] hover:border-[#bbb] hover:text-black'
  )

  const footerBtn = tc(
    'border-[#2a2a2a] bg-[#141414] text-[#bbb] hover:text-white hover:border-[#444] hover:bg-[#1e1e1e]',
    'border-[#d0d0d0] bg-white text-[#555] hover:text-black hover:border-[#999] hover:bg-[#f5f5f5]'
  )

  return (
    <>
      {/* Frame selection modal */}
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-base sm:text-lg tracking-tight">
              Chọn Khung Ảnh
            </span>
            {!loading && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tc('bg-white/10 text-white/80 border-white/15', 'bg-black/5 text-black/70 border-black/10')}`}>
                {filtered.length} khung
              </span>
            )}
          </div>
        }
        footer={
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-1">
            <button
              onClick={() => { onClear(); onClose() }}
              disabled={!selectedFrame}
              className={`h-10 px-4 rounded-xl border text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                selectedFrame
                  ? tc('border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20', 'border-red-400 text-red-600 bg-red-50 hover:bg-red-100')
                  : footerBtn
              }`}
            >
              ✕ Bỏ Khung Hiện Tại
            </button>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setContributeOpen(true)}
                className={`h-10 px-3.5 rounded-xl border border-dashed text-xs font-bold transition-colors flex items-center gap-1.5 ${tc(
                  'border-[#333] bg-[#0e0e0e] text-[#aaa] hover:text-white hover:border-[#555]',
                  'border-[#ccc] bg-white text-[#666] hover:text-black hover:border-[#888]'
                )}`}
              >
                <span>+</span> Đóng góp khung
              </button>
              <button
                onClick={onClose}
                className={`h-10 px-4 rounded-xl border text-xs font-bold transition-colors ${footerBtn}`}
              >
                Đóng
              </button>
            </div>
          </div>
        }
        width="min(1280px, 95vw)"
        centered
        styles={{
          body: {
            padding: '16px 20px 24px',
          }
        }}
      >
        {/* Layout Selector Bar */}
        <div className="pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap shrink-0">
          <span className={`text-[10px] font-black uppercase tracking-[0.15em] shrink-0 ${tc('text-[#777]', 'text-[#888]')}`}>
            Layout:
          </span>
          {['Tất cả', ...availableLayouts].map(ly => {
            const isSelected = (layoutFilter === ly || (ly === 'Tất cả' && !layoutFilter))
            return (
              <button
                key={ly}
                onClick={() => { setLayoutFilter(ly === 'Tất cả' ? null : ly); setActiveCategoryName(null) }}
                className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                  isSelected ? chipActive : chipInactive
                }`}
              >
                {ly}
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div className="pb-3">
          <Input.Search
            placeholder="Tìm kiếm theo tên khung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            size="large"
            className="rounded-xl"
          />
        </div>

        {/* Category Pills */}
        <div className="pb-4 flex overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap gap-2 shrink-0">
          {[
            { id: null, name: 'Tất cả' },
            ...availableCategories
          ].map((cat) => {
            const active = cat.name === activeCategoryName || (cat.id === null && activeCategoryName === null)
            return (
              <button
                key={cat.id ?? 'all'}
                onClick={() => setActiveCategoryName(cat.name === 'Tất cả' ? null : cat.name)}
                className={`text-xs sm:text-sm px-4 py-1.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                  active ? chipActive : chipInactive
                }`}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Frame Gallery Grid */}
        <div className="pb-2 overflow-y-auto max-h-[70vh] sm:max-h-[600px] pr-1.5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Spin size="large" />
              <span className={`text-xs sm:text-sm font-medium ${tc('text-[#777]', 'text-[#888]')}`}>Đang tải bộ sưu tập khung...</span>
            </div>
          )}
          
          {error && <p className="text-center text-red-400 py-12 text-sm font-medium">{error}</p>}
          
          {!loading && !error && filtered.length === 0 && (
            <div className="py-16">
              <Empty description="Không tìm thấy khung phù hợp" />
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filtered.map((frame) => {
                const imgUrl = frameImageUrl(frame.filename, frame.storageUrl)
                const isActive = selectedFrame?.id === frame.id
                const isVerticalStrip = frame.layout === '1x4' || frame.layout === '1x3' || frame.frame === 'square'
                
                return (
                  <div
                    key={frame.id}
                    onClick={() => onSelect(imgUrl, frame)}
                    className={`relative rounded-2xl overflow-hidden border p-2 sm:p-3 flex flex-col items-center justify-between cursor-pointer transition-colors group ${tc(
                      'bg-[#0c0c0c] hover:bg-[#161616]',
                      'bg-[#f7f7f7] hover:bg-white'
                    )} ${
                      isActive
                        ? tc('border-white ring-2 ring-white/60', 'border-black ring-2 ring-black/60')
                        : tc('border-[#222] hover:border-[#555]', 'border-[#e0e0e0] hover:border-[#888]')
                    }`}
                  >
                    {/* Frame Image Container (aspect ratio guaranteed) */}
                    <div className={`w-full flex items-center justify-center overflow-hidden p-1 bg-black/20 rounded-xl ${
                      isVerticalStrip ? 'aspect-[1/2.1]' : 'aspect-[3/4]'
                    }`}>
                      <img
                        src={imgUrl}
                        alt={frame.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>

                    {/* Frame Label & Quick Select Button */}
                    <div className="w-full mt-2 flex flex-col gap-1.5 items-center">
                      <span className="w-full text-center text-xs sm:text-sm font-bold tracking-tight bg-black/80 text-white py-1 px-2 rounded-xl truncate border border-white/10">
                        {frame.name}
                      </span>
                      <button
                        className={`w-full h-8 sm:h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm ${
                          isActive
                            ? 'bg-emerald-500 text-white border border-emerald-400'
                            : tc(
                                'bg-white text-black hover:bg-[#e8e8e8]',
                                'bg-black text-white hover:bg-[#222]'
                              )
                        }`}
                      >
                        {isActive ? '✓ Đã chọn' : 'Chọn'}
                      </button>
                    </div>

                    {/* Active Selected Badge */}
                    {isActive && (
                      <span className="absolute top-2 right-2 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center shadow-md">
                        <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5">
                          <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      <ContributeFrameModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
    </>
  )
}
