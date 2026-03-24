import { useRef } from 'react'
import { Switch } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

interface CaptureControlsProps {
  isReady: boolean
  isCapturing: boolean
  capturedCount: number
  totalSlots: number
  videoRecap: boolean
  onManualCapture: () => void
  onAutoCapture: () => void
  onRetake: () => void
  onUploadAll: (dataUrl: string) => void
  onToggleVideoRecap: (v: boolean) => void
}

export default function CaptureControls({
  isReady,
  isCapturing,
  capturedCount,
  totalSlots,
  videoRecap,
  onManualCapture,
  onAutoCapture,
  onRetake,
  onUploadAll,
  onToggleVideoRecap,
}: CaptureControlsProps) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const disabled = !isReady || isCapturing
  const allDone = capturedCount === totalSlots

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onUploadAll(ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2 bg-[#141414] rounded-xl border border-[#2a2a2a] px-3">
      {/* Main buttons */}
      <div className="flex items-center justify-center gap-6">
        {/* Manual capture */}
        <button
          onClick={onManualCapture}
          disabled={disabled || allDone}
          className="flex flex-col items-center gap-1 group"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center transition
            ${disabled || allDone
              ? 'bg-[#1e1e1e] text-[#444] cursor-not-allowed'
              : 'bg-[#222] text-white hover:bg-[#333] active:scale-95 border border-[#333]'
            }`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z" />
            </svg>
          </div>
          <span className={`text-[10px] font-medium uppercase tracking-wider ${disabled || allDone ? 'text-[#444]' : 'text-[#888]'}`}>
            Chụp
          </span>
        </button>

        {/* AUTO */}
        <button
          onClick={onAutoCapture}
          disabled={disabled || allDone}
          className="flex flex-col items-center gap-1 group"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition
            ${disabled || allDone
              ? 'bg-[#1e1e1e] text-[#444] cursor-not-allowed'
              : 'bg-white text-black hover:bg-[#e0e0e0] active:scale-95'
            }`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            </svg>
          </div>
          <span className={`text-[10px] font-medium uppercase tracking-wider ${disabled || allDone ? 'text-[#444]' : 'text-white'}`}>
            AUTO
          </span>
        </button>

        {/* Retake */}
        <button
          onClick={onRetake}
          disabled={capturedCount === 0}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center transition
            ${capturedCount === 0
              ? 'bg-[#1e1e1e] text-[#444] cursor-not-allowed'
              : 'bg-[#222] text-white hover:bg-[#333] active:scale-95 border border-[#333]'
            }`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </div>
          <span className={`text-[10px] font-medium uppercase tracking-wider ${capturedCount === 0 ? 'text-[#444]' : 'text-[#888]'}`}>
            Chụp Lại
          </span>
        </button>
      </div>

      {/* Video Recap toggle + Upload */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Switch size="small" checked={videoRecap} onChange={onToggleVideoRecap} />
          <span className="text-[11px] text-[#555]">Video Recap</span>
        </label>
        <button
          onClick={() => uploadRef.current?.click()}
          className="flex items-center gap-1 text-xs text-[#888] border border-[#2a2a2a] rounded-md px-3 py-1 hover:border-[#555] hover:text-white transition"
        >
          <UploadOutlined /> Tải ảnh lên
        </button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleUploadFile} />
      </div>
    </div>
  )
}
