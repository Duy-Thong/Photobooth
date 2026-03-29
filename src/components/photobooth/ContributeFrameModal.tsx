import { useRef, useState } from 'react'
import { Button, Input, Modal, Select, Spin } from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import { detectFrameSlots } from '@/lib/imageProcessing'
import { submitFrameRequest } from '@/lib/frameService'
import { useThemeClass } from '@/stores/themeStore'

interface Props {
  open: boolean
  onClose: () => void
}

const KNOWN_CATEGORIES = ['Frame Basic', 'Frame Cartoon', 'Frame Amazing ⭐️', 'Frame IDOL Hoạt Họa']

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
  const [slots, setSlots] = useState(4)

  const [submitterName, setSubmitterName] = useState('')
  const [submitterContact, setSubmitterContact] = useState('')
  const [suggestedName, setSuggestedName] = useState('')
  const [suggestedCategory, setSuggestedCategory] = useState('')
  const [suggestedFrame, setSuggestedFrame] = useState('vertical')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleFileSelect = async (f: File) => {
    if (!f.type.includes('png') && !f.name.endsWith('.png')) {
      setSubmitError('Chỉ hỗ trợ file PNG')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(f)
    setFile(f)
    setPreviewUrl(url)
    setDetecting(true)
    try {
      const detected = await detectFrameSlots(url)
      const count = detected.length
      setSlots(count)
    } finally {
      setDetecting(false)
    }
  }

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setSlots(4)
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
        slots,
        note: note.trim(),
      })
      setDone(true)
    } catch {
      setSubmitError('Gửi thất bại. Kiểm tra kết nối và thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    background: tc('#111', '#fff') === '#111' ? '#111' : '#fff',
    borderColor: tc('#2a2a2a', '#d9d9d9') === '#2a2a2a' ? '#2a2a2a' : '#d9d9d9',
    color: tc('#e5e5e5', '#1a1a1a') === '#e5e5e5' ? '#e5e5e5' : '#1a1a1a',
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={<span className="text-sm font-semibold">Đóng Góp Khung Ảnh</span>}
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
      width={480}
      styles={{
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="text-3xl">🎉</span>
          <p className={`font-semibold ${tc('text-white', 'text-black')}`}>Đề xuất đã được gửi!</p>
          <p className={`text-sm ${tc('text-[#666]', 'text-[#999]')}`}>Admin sẽ review và duyệt khung của bạn sớm nhất có thể.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-2">
          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors ${tc('border-[#2a2a2a] hover:border-[#444]', 'border-[#d0d0d0] hover:border-[#999]')}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) handleFileSelect(f)
            }}
          >
            {previewUrl ? (
              <div className={`relative flex items-center justify-center p-2 ${tc('bg-[#111]', 'bg-[#f5f5f5]')}`} style={{ minHeight: 140 }}>
                <img src={previewUrl} alt="preview" className="max-h-36 object-contain rounded" />
                {detecting && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Spin size="small" />
                    <span className="text-white text-xs">Đang phát hiện slot...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center gap-2 py-10 ${tc('text-[#3a3a3a]', 'text-[#bbb]')}`}>
                <PictureOutlined style={{ fontSize: 36 }} />
                <span className="text-xs">Kéo thả hoặc click để chọn file PNG</span>
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

          {/* Slot info + adjust */}
          {file && !detecting && (
            <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${tc('bg-[#111]', 'bg-[#f5f5f5]')}`}>
              <span className={`text-xs ${tc('text-[#555]', 'text-[#999]')}`}>Slot phát hiện:</span>
              <span className={`text-xs font-bold ${tc('text-white', 'text-black')}`}>{slots}</span>
              <span className={`text-xs ${tc('text-[#333]', 'text-[#ccc]')}`}>·</span>
              <span className={`text-xs ${tc('text-[#555]', 'text-[#999]')}`}>Điều chỉnh nếu sai:</span>
              <Select
                size="small"
                value={slots}
                onChange={v => setSlots(v)}
                options={[1,2,3,4,5,6,8,9].map(n => ({ value: n, label: `${n}` }))}
                style={{ width: 70 }}
              />
            </div>
          )}

          {/* Suggested name */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs ${tc('text-[#888]', 'text-[#888]')}`}>Tên Khung Đề Xuất *</label>
            <Input
              value={suggestedName}
              onChange={e => setSuggestedName(e.target.value)}
              placeholder="Ví dụ: HelloKitty, Y2K..."
              style={inputStyle}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs ${tc('text-[#888]', 'text-[#888]')}`}>Danh Mục *</label>
            <Input
              value={suggestedCategory}
              onChange={e => setSuggestedCategory(e.target.value)}
              placeholder="Ví dụ: Frame Basic, Frame Cartoon..."
              list="contribute-categories"
              style={inputStyle}
            />
            <datalist id="contribute-categories">
              {KNOWN_CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Suggested Frame Type */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs ${tc('text-[#888]', 'text-[#888]')}`}>Loại khung đề xuất</label>
            <Select
              value={suggestedFrame}
              onChange={v => setSuggestedFrame(v)}
              options={FRAME_TYPE_OPTIONS}
              style={{ background: inputStyle.background, color: inputStyle.color }}
              className="custom-select"
            />
          </div>

          {/* Submitter contact */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs ${tc('text-[#888]', 'text-[#888]')}`}>Email / Liên hệ *</label>
            <Input
              value={submitterContact}
              onChange={e => setSubmitterContact(e.target.value)}
              placeholder="email hoặc Facebook/Instagram..."
              style={inputStyle}
            />
          </div>

          {/* Submitter name (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs ${tc('text-[#888]', 'text-[#888]')}`}>Tên của bạn (không bắt buộc)</label>
            <Input
              value={submitterName}
              onChange={e => setSubmitterName(e.target.value)}
              placeholder="Để trống nếu muốn ẩn danh"
              style={inputStyle}
            />
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs ${tc('text-[#888]', 'text-[#888]')}`}>Ghi chú cho admin (không bắt buộc)</label>
            <Input.TextArea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Thông tin thêm, nguồn gốc thiết kế..."
              rows={2}
              style={inputStyle}
            />
          </div>
          {submitError && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{submitError}</p>
          )}
        </div>
      )}
    </Modal>
  )
}
