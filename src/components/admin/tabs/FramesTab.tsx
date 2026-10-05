import { useState, useMemo, useRef } from 'react'
import { Button, Input, Modal, Select, Spin, Empty, Tooltip, Switch } from 'antd'
import {
  UploadOutlined,
  ReloadOutlined,
  PictureOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import {
  uploadFrame as uploadFrameService,
  deleteCustomFrame as deleteCustomFrameService,
  updateFrame as updateFrameService,
  toggleFrameActive as toggleFrameActiveService,
  frameImageUrl,
  type FrameItem,
} from '@/lib/frameService'
import { detectFrameSlots, getLayoutFromSlots } from '@/lib/imageProcessing'
import FrameSlotEditor from '@/components/admin/FrameSlotEditor'
import type { SlotRect } from '@/types/photobooth'
import { useThemeClass } from '@/stores/themeStore'

export const LAYOUT_OPTIONS = [
  { value: '1x1', label: '1x1' },
  { value: '1x2', label: '1x2' },
  { value: '1x3', label: '1x3' },
  { value: '1x4', label: '1x4' },
  { value: '2x2', label: '2x2' },
  { value: '2x3', label: '2x3' },
  { value: '2x4', label: '2x4' },
]

export const FRAME_TYPE_OPTIONS = [
  { value: 'vertical', label: 'Vertical (Mặc định)' },
  { value: 'square', label: 'Square (Vuông)' },
  { value: 'grid', label: 'Grid (Lưới 2 cột)' },
  { value: 'bigrectangle', label: 'Big Rectangle (Ngang to)' },
]

export function inferFrameType(layout: string, slots: SlotRect[]): string {
  if (layout === '2x2' || layout === '2x3' || layout.startsWith('2x') || layout.startsWith('3x')) {
    return 'grid'
  }
  if (layout === '1x1') {
    return 'square'
  }
  if (layout === '1x4' || layout === '1x3' || layout === '1x2') {
    return 'vertical'
  }
  if (slots.length >= 4 && layout.includes('2')) return 'grid'
  return 'vertical'
}

interface FramesTabProps {
  customFrames: FrameItem[]
  framesLoading: boolean
  canDelete: boolean
  onReload: () => void
  onFramesChange: (frames: FrameItem[]) => void
}

export default function FramesTab({
  customFrames,
  framesLoading,
  canDelete,
  onReload,
  onFramesChange,
}: FramesTabProps) {
  const tc = useThemeClass()
  const [deletingFrameId, setDeletingFrameId] = useState<string | null>(null)
  const [togglingFrameId, setTogglingFrameId] = useState<string | null>(null)
  const [frameSearch, setFrameSearch] = useState('')
  const [frameStatusFilter, setFrameStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [frameLayoutFilter, setFrameLayoutFilter] = useState<string | null>(null)
  const [frameCategoryFilter, setFrameCategoryFilter] = useState<string | null>(null)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [detectingSlots, setDetectingSlots] = useState(false)
  const [uploadSlotsData, setUploadSlotsData] = useState<SlotRect[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadLayout, setUploadLayout] = useState('')
  const [uploadFrameType, setUploadFrameType] = useState('vertical')
  const [uploadIsActive, setUploadIsActive] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit frame state
  const [editingFrame, setEditingFrame] = useState<FrameItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSlotsData, setEditSlotsData] = useState<SlotRect[]>([])
  const [editLayout, setEditLayout] = useState('')
  const [editFrameType, setEditFrameType] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

  const activeFramesCount = useMemo(
    () => customFrames.filter((f) => f.isActive !== false).length,
    [customFrames],
  )
  const inactiveFramesCount = useMemo(
    () => customFrames.filter((f) => f.isActive === false).length,
    [customFrames],
  )

  const frameLayoutOptions = useMemo(
    () => [...new Set(customFrames.map((f) => f.layout).filter(Boolean) as string[])].sort(),
    [customFrames],
  )

  const frameCategoryOptions = useMemo(() => {
    const base =
      frameLayoutFilter !== null
        ? customFrames.filter((f) => f.layout === frameLayoutFilter)
        : customFrames
    return [...new Set(base.map((f) => f.categoryName))].sort((a, b) => a.localeCompare(b, 'vi'))
  }, [customFrames, frameLayoutFilter])

  const filteredFrames = useMemo(() => {
    let list = customFrames
    if (frameStatusFilter === 'active') list = list.filter((f) => f.isActive !== false)
    if (frameStatusFilter === 'inactive') list = list.filter((f) => f.isActive === false)
    if (frameLayoutFilter !== null) list = list.filter((f) => f.layout === frameLayoutFilter)
    if (frameCategoryFilter !== null) list = list.filter((f) => f.categoryName === frameCategoryFilter)
    if (frameSearch.trim()) {
      const q = frameSearch.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.categoryName.toLowerCase().includes(q))
    }
    return list
  }, [customFrames, frameStatusFilter, frameLayoutFilter, frameCategoryFilter, frameSearch])

  const handleToggleFrameActive = async (frame: FrameItem, nextActive: boolean) => {
    if (!frame.firestoreId) return
    setTogglingFrameId(frame.firestoreId)
    try {
      await toggleFrameActiveService(frame.firestoreId, nextActive)
      onFramesChange(
        customFrames.map((f) =>
          f.firestoreId === frame.firestoreId ? { ...f, isActive: nextActive } : f,
        ),
      )
    } catch {
      Modal.error({ title: 'Cập nhật trạng thái thất bại', centered: true })
    } finally {
      setTogglingFrameId(null)
    }
  }

  const handleUploadSlotsChange = (slots: SlotRect[]) => {
    setUploadSlotsData(slots)
    const layoutStr = getLayoutFromSlots(slots)
    if (layoutStr && layoutStr !== '0x0') {
      setUploadLayout(layoutStr)
      setUploadFrameType(inferFrameType(layoutStr, slots))
    }
  }

  const handleEditSlotsChange = (slots: SlotRect[]) => {
    setEditSlotsData(slots)
    const layoutStr = getLayoutFromSlots(slots)
    if (layoutStr && layoutStr !== '0x0') {
      setEditLayout(layoutStr)
      setEditFrameType(inferFrameType(layoutStr, slots))
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes('png') && !file.name.endsWith('.png')) {
      Modal.error({ title: 'Chỉ hỗ trợ file PNG', centered: true })
      return
    }
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    const url = URL.createObjectURL(file)
    setUploadFile(file)
    setUploadPreviewUrl(url)

    if (!uploadName.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleanName) setUploadName(cleanName)
    }

    if (!uploadCategory.trim()) {
      setUploadCategory('Frame Amazing ⭐️')
    }

    setDetectingSlots(true)
    try {
      const slots = await detectFrameSlots(url)
      setUploadSlotsData(slots)
      const layoutStr = getLayoutFromSlots(slots)
      if (layoutStr && layoutStr !== '0x0') {
        setUploadLayout(layoutStr)
        setUploadFrameType(inferFrameType(layoutStr, slots))
      }
    } finally {
      setDetectingSlots(false)
    }
  }

  const handleCloseUploadModal = () => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    setShowUploadModal(false)
    setUploadFile(null)
    setUploadPreviewUrl(null)
    setUploadSlotsData([])
    setUploadName('')
    setUploadCategory('')
    setUploadLayout('')
    setUploadFrameType('vertical')
    setUploadIsActive(true)
  }

  const handleUploadFrame = async () => {
    if (!uploadFile || !uploadName.trim() || !uploadCategory.trim()) return
    setUploading(true)
    try {
      const layoutToSave = uploadLayout || getLayoutFromSlots(uploadSlotsData)
      const frame = await uploadFrameService(uploadFile, {
        name: uploadName.trim(),
        categoryName: uploadCategory.trim(),
        slots: uploadSlotsData.length,
        slots_data: uploadSlotsData,
        layout: layoutToSave,
        frame: uploadFrameType || inferFrameType(layoutToSave, uploadSlotsData),
        isActive: uploadIsActive,
      })
      onFramesChange([...customFrames, frame].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      handleCloseUploadModal()
    } catch {
      Modal.error({ title: 'Upload thất bại', content: 'Kiểm tra kết nối và quyền Firebase.', centered: true })
    } finally {
      setUploading(false)
    }
  }

  const openEditFrame = (frame: FrameItem) => {
    setEditingFrame(frame)
    setEditName(frame.name)
    setEditCategory(frame.categoryName)
    setEditSlotsData(frame.slots_data || [])
    setEditLayout(frame.layout || (frame.slots_data ? getLayoutFromSlots(frame.slots_data) : ''))
    setEditFrameType(frame.frame || 'vertical')
    setEditIsActive(frame.isActive !== false)
  }

  const handleSaveEdit = async () => {
    if (!editingFrame?.firestoreId) return
    setEditSaving(true)
    try {
      const newLayout = editLayout || getLayoutFromSlots(editSlotsData)
      await updateFrameService(editingFrame.firestoreId, {
        name: editName.trim(),
        categoryName: editCategory.trim(),
        slots: editSlotsData.length,
        slots_data: editSlotsData,
        layout: newLayout,
        frame: editFrameType,
        isActive: editIsActive,
      })
      onFramesChange(
        customFrames.map((f) =>
          f.firestoreId === editingFrame.firestoreId
            ? {
                ...f,
                name: editName.trim(),
                categoryName: editCategory.trim(),
                slots: editSlotsData.length,
                slots_data: editSlotsData,
                layout: newLayout,
                frame: editFrameType,
                isActive: editIsActive,
              }
            : f,
        ),
      )
      setEditingFrame(null)
    } catch {
      Modal.error({ title: 'Lưu thất bại', centered: true })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteFrame = (frame: FrameItem) => {
    if (!frame.firestoreId) return
    Modal.confirm({
      title: 'Xóa khung này?',
      content: frame.name,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        setDeletingFrameId(frame.firestoreId!)
        try {
          await deleteCustomFrameService(frame.firestoreId!, frame.filename)
          onFramesChange(customFrames.filter((f) => f.firestoreId !== frame.firestoreId))
        } finally {
          setDeletingFrameId(null)
        }
      },
    })
  }

  return (
    <div className="flex-1 p-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setShowUploadModal(true)}>
          Tải Khung Lên
        </Button>
        <Button size="small" icon={<ReloadOutlined />} onClick={onReload} loading={framesLoading}>
          Tải lại
        </Button>
        <div className="flex-1" />
        <Input.Search
          placeholder="Tìm tên khung..."
          value={frameSearch}
          onChange={(e) => setFrameSearch(e.target.value)}
          allowClear
          size="small"
          style={{ maxWidth: 220 }}
        />
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${tc('text-slate-400', 'text-slate-500')}`}>
          Trạng thái:
        </span>
        {[
          { key: 'all', label: `Tất cả (${customFrames.length})` },
          { key: 'active', label: `Đang bật (${activeFramesCount})` },
          { key: 'inactive', label: `Đang tắt (${inactiveFramesCount})` },
        ].map((st) => (
          <button
            key={st.key}
            onClick={() => setFrameStatusFilter(st.key as any)}
            className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
              frameStatusFilter === st.key
                ? tc('bg-white text-black border-white font-semibold shadow-xs', 'bg-blue-600 text-white border-blue-600 shadow-xs')
                : tc(
                    'border-[#252525] bg-[#111] text-slate-400 hover:border-[#444] hover:text-slate-200',
                    'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                  )
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Layout filter pills */}
      {frameLayoutOptions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${tc('text-slate-400', 'text-slate-500')}`}>
            Layout:
          </span>
          {[null, ...frameLayoutOptions].map((ly) => (
            <button
              key={ly ?? 'all'}
              onClick={() => {
                setFrameLayoutFilter(ly)
                setFrameCategoryFilter(null)
              }}
              className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                frameLayoutFilter === ly
                  ? tc('bg-white text-black border-white font-semibold shadow-xs', 'bg-blue-600 text-white border-blue-600 shadow-xs')
                  : tc(
                      'border-[#252525] bg-[#111] text-slate-400 hover:border-[#444] hover:text-slate-200',
                      'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                    )
              }`}
            >
              {ly === null ? 'Tất cả' : ly}
            </button>
          ))}
        </div>
      )}

      {/* Category filter pills */}
      {frameCategoryOptions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${tc('text-slate-400', 'text-slate-500')}`}>
            Danh mục:
          </span>
          {[null, ...frameCategoryOptions].map((cat) => (
            <button
              key={cat ?? 'all'}
              onClick={() => setFrameCategoryFilter(cat)}
              className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                frameCategoryFilter === cat
                  ? tc('bg-white text-black border-white font-semibold shadow-xs', 'bg-blue-600 text-white border-blue-600 shadow-xs')
                  : tc(
                      'border-[#252525] bg-[#111] text-slate-400 hover:border-[#444] hover:text-slate-200',
                      'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                    )
              }`}
            >
              {cat === null ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
      )}

      {framesLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : filteredFrames.length === 0 ? (
        <Empty
          image={<PictureOutlined style={{ fontSize: 48, color: '#999' }} />}
          description={
            <span className={tc('text-slate-500', 'text-slate-400')}>
              {customFrames.length === 0 ? 'Chưa có khung nào được upload' : 'Không tìm thấy khung phù hợp'}
            </span>
          }
          className="mt-20"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filteredFrames.map((frame) => {
            const isEnabled = frame.isActive !== false
            return (
              <div
                key={frame.firestoreId}
                className={`group relative rounded-xl overflow-hidden transition-all duration-200 border shadow-xs hover:shadow-md ${
                  !isEnabled
                    ? tc(
                        'bg-[#0f0f0f] border-[#222] opacity-75 hover:opacity-100 hover:border-[#3a3a3a]',
                        'bg-white border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300',
                      )
                    : tc('bg-[#141414] border-[#262626] hover:border-[#444]', 'bg-white border-slate-200 hover:border-blue-400')
                }`}
              >
                <div className={`p-2 flex items-center justify-center aspect-3/4 relative ${tc('bg-[#0a0a0a]', 'bg-slate-50')}`}>
                  <img
                    src={frameImageUrl(frame.filename, frame.storageUrl)}
                    alt={frame.name}
                    className={`w-full h-full object-contain ${!isEnabled ? 'grayscale-[40%]' : ''}`}
                    loading="lazy"
                  />
                  {!isEnabled ? (
                    <div className="absolute top-2 right-2 bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                      ĐÃ TẮT
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                      ĐANG BẬT
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className={`font-semibold text-xs truncate ${tc('text-white', 'text-slate-900')}`}>{frame.name}</p>
                  <p className={`text-[11px] truncate mt-0.5 ${tc('text-slate-400', 'text-slate-500')}`}>{frame.categoryName}</p>
                  <p className={`text-[10px] mb-2.5 ${tc('text-slate-500', 'text-slate-400')}`}>
                    {frame.slots} slot · {frame.layout || 'N/A'} · {frame.frame || 'vertical'}
                  </p>

                  <div
                    className={`flex items-center justify-between pt-2 border-t ${tc('border-[#222]', 'border-slate-100')}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className={`text-[11px] font-semibold ${isEnabled ? 'text-emerald-500' : tc('text-slate-500', 'text-slate-400')}`}>
                      {isEnabled ? 'Hiển thị' : 'Đang ẩn'}
                    </span>
                    <Tooltip title={isEnabled ? 'Tắt khung (Ẩn khỏi Photobooth)' : 'Bật khung (Hiển thị trong Photobooth)'}>
                      <Switch
                        size="small"
                        checked={isEnabled}
                        loading={togglingFrameId === frame.firestoreId}
                        onChange={(checked) => handleToggleFrameActive(frame, checked)}
                        style={{
                          backgroundColor: isEnabled ? '#10b981' : undefined,
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
                <Tooltip title="Chỉnh sửa">
                  <button
                    onClick={() => openEditFrame(frame)}
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-blue-600 text-white rounded-lg p-1.5 z-10 cursor-pointer"
                  >
                    <EditOutlined />
                  </button>
                </Tooltip>
                {canDelete && (
                  <Tooltip title="Xóa khung">
                    <button
                      onClick={() => handleDeleteFrame(frame)}
                      disabled={deletingFrameId === frame.firestoreId}
                      className="absolute bottom-12 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5 z-10 cursor-pointer"
                    >
                      {deletingFrameId === frame.firestoreId ? <Spin size="small" /> : <DeleteOutlined />}
                    </button>
                  </Tooltip>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Frame upload modal */}
      <Modal
        open={showUploadModal}
        onCancel={handleCloseUploadModal}
        title="Tải Khung Lên"
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={handleCloseUploadModal}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleUploadFrame}
              loading={uploading}
              disabled={!uploadFile || !uploadName.trim() || !uploadCategory.trim() || detectingSlots}
            >
              Tải Lên
            </Button>
          </div>
        }
        centered
        width="min(1240px, 96vw)"
        styles={{
          body: { maxHeight: 'calc(90vh - 100px)', overflow: 'hidden', padding: '16px 20px' },
        }}
      >
        <div className="flex flex-col md:flex-row gap-6 h-[70vh] max-h-[640px] overflow-hidden py-1">
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {uploadPreviewUrl ? (
              <FrameSlotEditor
                imageUrl={uploadPreviewUrl}
                slots={uploadSlotsData}
                onChange={handleUploadSlotsChange}
              />
            ) : (
              <div
                className={`h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${tc(
                  'border-[#2a2a2a] text-slate-500 hover:border-[#444] bg-[#0a0a0a]',
                  'border-slate-300 text-slate-400 hover:border-blue-500 bg-slate-50',
                )}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <PictureOutlined style={{ fontSize: 42 }} />
                <span className="text-xs font-semibold">Chọn file PNG để bắt đầu</span>
                <span className="text-[10px] text-slate-400">Hỗ trợ PNG trong suốt để tự nhận diện slot</span>
              </div>
            )}
          </div>

          <div className="w-80 shrink-0 flex flex-col gap-3.5 h-full overflow-y-auto pr-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,image/png"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
                e.target.value = ''
              }}
            />

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Tên Khung *
              </label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Ví dụ: HelloKitty, Y2K..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Danh Mục *
              </label>
              <Input
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                placeholder="Ví dụ: Frame Basic, Frame Cartoon..."
                list="known-categories"
              />
              <datalist id="known-categories">
                <option value="Frame Basic" />
                <option value="Frame Cartoon" />
                <option value="Frame Amazing ⭐️" />
                <option value="Frame IDOL Hoạt Họa" />
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Layout (Bố cục)
              </label>
              <Select
                value={uploadLayout}
                onChange={(v) => setUploadLayout(v)}
                placeholder="Chọn bố cục..."
                options={LAYOUT_OPTIONS}
                showSearch
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Loại khung
              </label>
              <Select
                value={uploadFrameType}
                onChange={(v) => setUploadFrameType(v)}
                options={FRAME_TYPE_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Số Slot
              </label>
              <div
                className={`border rounded-lg px-3 py-1.5 font-bold h-8 flex items-center ${tc(
                  'bg-[#050505] border-[#222] text-white',
                  'bg-slate-50 border-slate-200 text-slate-900',
                )}`}
              >
                {uploadSlotsData.length}
              </div>
            </div>

            <div
              className={`flex items-center justify-between border rounded-lg p-2.5 mt-auto ${tc(
                'bg-[#0a0a0a] border-[#222]',
                'bg-slate-50 border-slate-200',
              )}`}
            >
              <div className="flex flex-col">
                <span className={`text-xs font-semibold ${tc('text-white', 'text-slate-900')}`}>Trạng thái</span>
                <span className={`text-[10px] ${tc('text-slate-500', 'text-slate-500')}`}>
                  Hiển thị trong Photobooth
                </span>
              </div>
              <Switch
                checked={uploadIsActive}
                onChange={setUploadIsActive}
                style={{ backgroundColor: uploadIsActive ? '#10b981' : undefined }}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit frame modal */}
      <Modal
        open={!!editingFrame}
        onCancel={() => setEditingFrame(null)}
        title="Chỉnh Sửa Khung"
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditingFrame(null)}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSaveEdit}
              loading={editSaving}
              disabled={!editName.trim() || !editCategory.trim()}
            >
              Lưu
            </Button>
          </div>
        }
        centered
        width="min(1240px, 96vw)"
        styles={{
          body: { maxHeight: 'calc(90vh - 100px)', overflow: 'hidden', padding: '16px 20px' },
        }}
      >
        <div className="flex flex-col md:flex-row gap-6 h-[70vh] max-h-[640px] overflow-hidden py-1">
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {editingFrame && (
              <FrameSlotEditor
                imageUrl={frameImageUrl(editingFrame.filename, editingFrame.storageUrl)}
                slots={editSlotsData}
                onChange={handleEditSlotsChange}
              />
            )}
          </div>

          <div className="w-80 shrink-0 flex flex-col gap-3.5 h-full overflow-y-auto pr-1">
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Tên Khung
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ví dụ: 1x4, 2x2..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Danh Mục
              </label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                list="edit-categories"
                placeholder="Ví dụ: 1x4, 2x2..."
              />
              <datalist id="edit-categories">
                <option value="Frame Basic" />
                <option value="Frame Cartoon" />
                <option value="Frame Amazing ⭐️" />
                <option value="Frame IDOL Hoạt Họa" />
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Layout (Bố cục)
              </label>
              <Select
                value={editLayout}
                onChange={(v) => setEditLayout(v)}
                placeholder="Chọn bố cục..."
                options={LAYOUT_OPTIONS}
                showSearch
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Loại khung
              </label>
              <Select
                value={editFrameType}
                onChange={(v) => setEditFrameType(v)}
                options={FRAME_TYPE_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Số Slot
              </label>
              <div
                className={`border rounded-lg px-3 py-1.5 font-bold h-8 flex items-center ${tc(
                  'bg-[#050505] border-[#222] text-white',
                  'bg-slate-50 border-slate-200 text-slate-900',
                )}`}
              >
                {editSlotsData.length}
              </div>
            </div>

            <div
              className={`flex items-center justify-between border rounded-lg p-2.5 mt-auto ${tc(
                'bg-[#0a0a0a] border-[#222]',
                'bg-slate-50 border-slate-200',
              )}`}
            >
              <div className="flex flex-col">
                <span className={`text-xs font-semibold ${tc('text-white', 'text-slate-900')}`}>
                  Trạng thái khung
                </span>
                <span className={`text-[10px] ${tc('text-slate-500', 'text-slate-500')}`}>
                  Hiển thị trong Photobooth
                </span>
              </div>
              <Switch
                checked={editIsActive}
                onChange={setEditIsActive}
                style={{ backgroundColor: editIsActive ? '#10b981' : undefined }}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
