import { useRef } from 'react'
import { UploadOutlined, CloseOutlined } from '@ant-design/icons'
import type { CapturedSlot } from '@/types/photobooth'
import { useThemeClass } from '@/stores/themeStore'

interface PhotoSlotProps {
  index: number
  slot: CapturedSlot | null
  onUpload: (index: number, dataUrl: string) => void
  onRemove: (index: number) => void
}

export default function PhotoSlot({ index, slot, onUpload, onRemove }: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tc = useThemeClass()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      onUpload(index, ev.target!.result as string)
    }
    reader.readAsDataURL(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  if (slot) {
    return (
      <div className="relative w-full h-full group">
        <img
          src={slot.dataUrl}
          alt={`Ảnh ${index + 1}`}
          className="w-full h-full object-cover rounded-xl"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition rounded-xl" />
        {/* Remove button */}
        <button
          onClick={() => onRemove(index)}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/80 text-red-400 hidden group-hover:flex items-center justify-center shadow text-xs"
        >
          <CloseOutlined />
        </button>
        {/* Replace via upload */}
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-black/80 text-white text-xs px-2 py-1 rounded-full shadow"
        >
          <UploadOutlined /> Thay
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`w-full h-full flex flex-col items-center justify-center gap-1 border border-dashed rounded-xl cursor-pointer transition ${tc(
        'border-[#2a2a2a] hover:border-[#555] hover:bg-[#0a0a0a] bg-[#141414]',
        'border-[#d0d0d0] hover:border-[#999] hover:bg-[#f5f5f5] bg-[#eee]'
      )}`}
    >
      <svg viewBox="0 0 80 80" className={`w-10 h-10 ${tc('text-[#333]', 'text-[#ccc]')}`} fill="currentColor">
        <rect x="8" y="14" width="50" height="52" rx="4" opacity="0.5" />
        <rect x="18" y="4" width="50" height="52" rx="4" />
        <path d="M33 22 L43 36 L50 28 L62 44 H24 Z" fill="white" opacity="0.2" />
        <circle cx="52" cy="24" r="5" fill="white" opacity="0.3" />
      </svg>
      <span className={`text-xs flex items-center gap-1 ${tc('text-white', 'text-black')}`}>
        <UploadOutlined /> Upload
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
