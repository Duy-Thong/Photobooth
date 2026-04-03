import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select } from 'antd'
import FrameSlotEditor from '@/components/admin/FrameSlotEditor'
import { updateFrame, frameImageUrl, type FrameItem } from '@/lib/frameService'
import type { SlotRect } from '@/types/photobooth'

const LAYOUT_OPTIONS = [
  { value: '1x1', label: '1x1' },
  { value: '1x2', label: '1x2' },
  { value: '1x3', label: '1x3' },
  { value: '1x4', label: '1x4' },
  { value: '2x2', label: '2x2' },
  { value: '2x3', label: '2x3' },
  { value: '2x4', label: '2x4' },
]

const FRAME_TYPE_OPTIONS = [
  { value: 'vertical', label: 'Vertical (Mặc định)' },
  { value: 'square', label: 'Square (Vuông)' },
  { value: 'grid', label: 'Grid (Lưới 2 cột)' },
  { value: 'bigrectangle', label: 'Big Rectangle (Ngang to)' },
]

interface FrameEditModalProps {
  frame: FrameItem | null
  categories: string[]
  onClose: () => void
  onSaved: (updated: FrameItem) => void
}

export default function FrameEditModal({ frame, categories, onClose, onSaved }: FrameEditModalProps) {
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editLayout, setEditLayout] = useState('')
  const [editFrameType, setEditFrameType] = useState('vertical')
  const [editSlotsData, setEditSlotsData] = useState<SlotRect[]>([])
  const [isOtherCategory, setIsOtherCategory] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (frame) {
      setEditName(frame.name)
      setEditCategory(frame.categoryName)
      setIsOtherCategory(!categories.includes(frame.categoryName))
      setEditLayout(frame.layout || '')
      setEditFrameType(frame.frame || 'vertical')
      setEditSlotsData(frame.slots_data || [])
    }
  }, [frame, categories])

  const handleSave = async () => {
    if (!frame?.firestoreId || !editName.trim() || !editCategory.trim()) return
    setSaving(true)
    try {
      await updateFrame(frame.firestoreId, {
        name: editName.trim(),
        categoryName: editCategory.trim(),
        layout: editLayout,
        frame: editFrameType,
        slots: editSlotsData.length,
        slots_data: editSlotsData,
      })
      onSaved({
        ...frame,
        name: editName.trim(),
        categoryName: editCategory.trim(),
        layout: editLayout,
        frame: editFrameType,
        slots: editSlotsData.length,
        slots_data: editSlotsData,
      })
      onClose()
    } catch {
      Modal.error({ title: 'Lỗi khi lưu', centered: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!frame}
      onCancel={onClose}
      title={<span className="text-[#aaa] text-sm font-medium">Chỉnh Sửa Khung</span>}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
            Hủy
          </Button>
          <Button
            type="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!editName.trim() || !editCategory.trim()}
          >
            Lưu
          </Button>
        </div>
      }
      centered
      width={940}
      destroyOnClose
    >
      <div className="flex flex-col md:flex-row gap-6 py-2">
        {/* Left - Slot Editor */}
        <div className="flex-1 min-w-0">
          {frame && (
            <FrameSlotEditor
              imageUrl={frameImageUrl(frame.filename, frame.storageUrl)}
              slots={editSlotsData}
              onChange={setEditSlotsData}
            />
          )}
        </div>

        {/* Right - Form */}
        <div className="w-80 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Tên Khung</label>
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Ví dụ: HelloKitty, Y2K..."
              style={{ borderColor: '#222' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Danh Mục</label>
            <Select
              value={isOtherCategory ? 'other' : editCategory}
              onChange={v => {
                if (v === 'other') {
                  setIsOtherCategory(true)
                  setEditCategory('')
                } else {
                  setIsOtherCategory(false)
                  setEditCategory(v)
                }
              }}
              placeholder="Chọn danh mục..."
              className="w-full"
            >
              {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
              <Select.Option value="other" className="text-blue-400 font-bold italic">+ Khác (Tự nhập)</Select.Option>
            </Select>
            {isOtherCategory && (
              <Input
                autoFocus
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="Nhập tên danh mục mới..."
                className="mt-2"
                style={{ borderColor: '#222' }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Layout (Bố cục)</label>
            <Select
              value={editLayout}
              onChange={v => setEditLayout(v)}
              placeholder="Chọn bố cục..."
              options={LAYOUT_OPTIONS}
              showSearch
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Loại khung</label>
            <Select
              value={editFrameType}
              onChange={v => setEditFrameType(v)}
              options={FRAME_TYPE_OPTIONS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Số Slot</label>
            <div className="bg-[#050505] border border-[#222] rounded px-3 py-1.5 text-white font-bold h-8 flex items-center">
              {editSlotsData.length}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
