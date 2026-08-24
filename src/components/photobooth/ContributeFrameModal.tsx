import { useRef, useState } from 'react'
import { Button, Input, Modal, Select } from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import { detectFrameSlots, getLayoutFromSlots } from '@/lib/imageProcessing'
import { submitFrameRequest } from '@/lib/frameService'
import { useThemeClass } from '@/stores/themeStore'
import FrameSlotEditor from '@/components/admin/FrameSlotEditor'
import type { SlotRect } from '@/types/photobooth'

interface Props {
  open: boolean
  onClose: () => void
}

const KNOWN_CATEGORIES = ['Frame Basic', 'Frame Cartoon', 'Frame Amazing ⭐️', 'Frame IDOL Hoạt Họa']

const LAYOUT_OPTIONS = [
  { value: '1x4', label: '1×4 (4 ảnh dải dọc)' },
  { value: '2x2', label: '2×2 (4 ảnh lưới vuông)' },
  { value: '1x3', label: '1×3 (3 ảnh dải dọc)' },
  { value: '2x3', label: '2×3 (6 ảnh lưới)' },
  { value: '1x2', label: '1×2 (2 ảnh dải dọc)' },
  { value: '1x1', label: '1×1 (1 ảnh to/vuông)' },
]

const FRAME_TYPE_OPTIONS = [
  { value: 'vertical', label: 'Vertical (Mặc định)' },
  { value: 'square', label: 'Square (Vuông)' },
  { value: 'grid', label: 'Grid (Lưới 2 cột)' },
  { value: 'bigrectangle', label: 'Big Rectangle (Ngang to)' },
]

export default function ContributeFrameModal({ open, onClose }: Props) {
  const tc = useThemeClass()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [slotsData, setSlotsData] = useState<SlotRect[]>([])
  const [layout, setLayout] = useState('1x4')

  const [submitterName, setSubmitterName] = useState('')
  const [submitterContact, setSubmitterContact] = useState('')
  const [suggestedName, setSuggestedName] = useState('')
  const [suggestedCategory, setSuggestedCategory] = useState('')
  const [suggestedFrame, setSuggestedFrame] = useState('vertical')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const inferFrameType = (layoutStr: string, slots: SlotRect[]) => {
    if (layoutStr === '2x2' || layoutStr === '2x3' || layoutStr.startsWith('2x') || layoutStr.startsWith('3x')) {
      return 'grid'
    }
    if (layoutStr === '1x1') {
      return 'square'
    }
    if (layoutStr === '1x4' || layoutStr === '1x3' || layoutStr === '1x2') {
      return 'vertical'
    }
    if (slots.length >= 4 && layoutStr.includes('2')) return 'grid'
    return 'vertical'
  }

  const handleSlotsChange = (newSlots: SlotRect[]) => {
    setSlotsData(newSlots)
    const layoutStr = getLayoutFromSlots(newSlots)
    if (layoutStr && layoutStr !== '0x0') {
      setLayout(layoutStr)
      setSuggestedFrame(inferFrameType(layoutStr, newSlots))
    }
  }

  const handleFileSelect = async (f: File) => {
    if (!f.type.includes('png') && !f.name.endsWith('.png')) {
      setSubmitError('Chỉ hỗ trợ file PNG')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(f)
    setFile(f)
    setPreviewUrl(url)
    setSubmitError(null)

    // Auto-fill suggested name
    if (!suggestedName.trim()) {
      const cleanName = f.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleanName) setSuggestedName(cleanName)
    }

    // Auto-fill category
    if (!suggestedCategory.trim()) {
      setSuggestedCategory('Frame Amazing ⭐️')
    }

    setDetecting(true)
    try {
      const detected = await detectFrameSlots(url)
      setSlotsData(detected)
      const layoutStr = getLayoutFromSlots(detected)
      if (layoutStr && layoutStr !== '0x0') {
        setLayout(layoutStr)
        setSuggestedFrame(inferFrameType(layoutStr, detected))
      }
    } finally {
      setDetecting(false)
    }
  }

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setSlotsData([])
    setLayout('1x4')
    setSubmitterName('')
    setSubmitterContact('')
    setSuggestedName('')
    setSuggestedCategory('')
    setSuggestedFrame('vertical')
    setNote('')
    setDone(false)
    setSubmitError(null)
    onClose()
  }

  const canSubmit = file && suggestedName.trim() && suggestedCategory.trim() && submitterContact.trim() && !detecting

  const handleSubmit = async () => {
    if (!canSubmit || !file) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitFrameRequest(file, {
        submitterName: submitterName.trim(),
        submitterContact: submitterContact.trim(),
        suggestedName: suggestedName.trim(),
        suggestedCategory: suggestedCategory.trim(),
        suggestedFrame,
        slots: slotsData.length,
        slots_data: slotsData,
        layout: layout || getLayoutFromSlots(slotsData),
        note: note.trim(),
      })
      setDone(true)
    } catch {
      setSubmitError('Gửi thất bại. Kiểm tra kết nối và thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={<span className="text-sm font-semibold">Đóng Góp Khung Ảnh Mới</span>}
      footer={
        done ? (
          <div className="flex justify-end">
            <Button onClick={handleClose} type="primary">Đóng</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button onClick={handleClose}>
              Hủy
            </Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            >
              Gửi Đề Xuất
            </Button>
          </div>
        )
      }
      centered
      width={done ? 480 : 'min(1200px, 96vw)'}
      styles={{
        mask: { backdropFilter: 'blur(4px)' },
        body: done ? {} : { maxHeight: 'calc(90vh - 100px)', overflow: 'hidden', padding: '16px 20px' }
      }}
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="text-4xl">🎉</span>
          <p className={`font-bold text-base ${tc('text-white', 'text-slate-900')}`}>Đề xuất đã được gửi thành công!</p>
          <p className={`text-xs max-w-sm ${tc('text-slate-400', 'text-slate-500')}`}>Cảm ơn bạn đã đóng góp khung cho Photobooth. Admin sẽ xem và duyệt khung sớm nhất có thể.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 h-[68vh] max-h-[620px] overflow-hidden py-1">
          {/* Left - Slot Editor Canvas */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {previewUrl ? (
              <FrameSlotEditor 
                imageUrl={previewUrl} 
                slots={slotsData} 
                onChange={handleSlotsChange} 
              />
            ) : (
              <div
                className={`h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${tc('border-[#2a2a2a] text-slate-500 hover:border-[#444] bg-[#0a0a0a]', 'border-slate-300 text-slate-400 hover:border-blue-500 bg-slate-50')}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) handleFileSelect(f)
                }}
              >
                <PictureOutlined style={{ fontSize: 42 }} />
                <span className="text-xs font-semibold">Chọn hoặc kéo thả file PNG khung ảnh vào đây</span>
                <span className="text-[10px] text-slate-400">Hệ thống sẽ tự động quét và nhận diện các ô slot trong suốt</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
          />

          {/* Right - Form Data */}
          <div className="w-80 shrink-0 flex flex-col gap-3.5 h-full overflow-y-auto pr-1">
            {/* Suggested name */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Tên Khung Đề Xuất *</label>
              <Input
                value={suggestedName}
                onChange={e => setSuggestedName(e.target.value)}
                placeholder="Ví dụ: HelloKitty, Y2K..."
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Danh Mục *</label>
              <Input
                value={suggestedCategory}
                onChange={e => setSuggestedCategory(e.target.value)}
                placeholder="Ví dụ: Frame Basic, Frame Cartoon..."
                list="contribute-categories"
              />
              <datalist id="contribute-categories">
                {KNOWN_CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Layout */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Layout (Bố cục)</label>
              <Select
                value={layout}
                onChange={v => {
                  setLayout(v)
                  setSuggestedFrame(inferFrameType(v, slotsData))
                }}
                placeholder="Chọn bố cục..."
                options={LAYOUT_OPTIONS}
                showSearch
              />
            </div>

            {/* Suggested Frame Type */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Loại khung đề xuất</label>
              <Select
                value={suggestedFrame}
                onChange={v => setSuggestedFrame(v)}
                options={FRAME_TYPE_OPTIONS}
              />
            </div>

            {/* Slot count info */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Số Slot</label>
              <div className={`border rounded-lg px-3 py-1.5 font-bold h-8 flex items-center ${tc('bg-[#050505] border-[#222] text-white', 'bg-slate-50 border-slate-200 text-slate-900')}`}>
                {slotsData.length} slot
              </div>
            </div>

            {/* Submitter contact */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Email / Liên hệ *</label>
              <Input
                value={submitterContact}
                onChange={e => setSubmitterContact(e.target.value)}
                placeholder="email hoặc Facebook/Instagram..."
              />
            </div>

            {/* Submitter name (optional) */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Tên của bạn (không bắt buộc)</label>
              <Input
                value={submitterName}
                onChange={e => setSubmitterName(e.target.value)}
                placeholder="Để trống nếu muốn ẩn danh"
              />
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Ghi chú cho admin</label>
              <Input.TextArea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Thông tin thêm, nguồn gốc thiết kế..."
                rows={2}
              />
            </div>

            {submitError && (
              <p className="text-red-500 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{submitError}</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
