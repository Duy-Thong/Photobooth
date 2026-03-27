import { useRef } from 'react'
import { Switch } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { LayoutConfig } from '@/types/photobooth'

interface CaptureControlsProps {
  isReady: boolean
  isCapturing: boolean
  countdown: number
  capturedCount: number
  totalSlots: number
  videoRecap: boolean
  onManualCapture: () => void
  onAutoCapture: () => void
  onRetake: () => void
  onUploadAll: (dataUrl: string) => void
  onToggleVideoRecap: (v: boolean) => void
  isX2: boolean
  onToggleX2: (v: boolean) => void
  layout: LayoutConfig
}

export default function CaptureControls({
  isReady,
  isCapturing,
  countdown,
  capturedCount,
  totalSlots,
  videoRecap,
  onManualCapture,
  onAutoCapture,
  onRetake,
  onUploadAll,
  onToggleVideoRecap,
  isX2,
  onToggleX2,
  layout,
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
    <div className="bg-[#111] rounded-xl border border-[#1e1e1e] px-4 py-3 flex flex-col gap-3">
      {/* Progress bar */}
      <div className="w-full h-px bg-[#1e1e1e] relative overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-500"
          style={{ width: totalSlots > 0 ? `${(capturedCount / totalSlots) * 100}%` : '0%' }}
        />
      </div>

      {/* Main buttons - 5 items in a single row */}
      <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-6 mt-1">
        
        {/* Toggle Video Recap */}
        <label
          className={`flex flex-col items-center gap-1.5 select-none ${countdown === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          title={countdown === 0 ? "Không hỗ trợ quay video khi chụp 0s" : "Quay video"}
        >
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border transition-all duration-150
            ${videoRecap && countdown > 0
              ? 'bg-[#1a1a1a] border-[#4da6ff] shadow-[0_0_12px_rgba(77,166,255,0.15)]'
              : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#444]'
            }`}>
            <Switch size="small" disabled={countdown === 0} checked={videoRecap} onChange={onToggleVideoRecap} style={{ background: videoRecap && countdown > 0 ? '#4da6ff' : undefined }} />
          </div>
          <span className={`text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.12em] whitespace-nowrap ${videoRecap && countdown > 0 ? 'text-[#4da6ff]' : 'text-[#555]'}`}>
            Video
          </span>
        </label>

        {/* X2 Duplication (only for vertical strips) */}
        {layout.cols === 1 && layout.slots > 1 && (
          <button
            onClick={() => onToggleX2(!isX2)}
            title="Nhân đôi strip (side-by-side)"
            className="flex flex-col items-center gap-1.5"
          >
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border transition-all duration-150
              ${isX2
                ? 'bg-[#1a1a1a] border-[#ff9f4d] shadow-[0_0_12px_rgba(255,159,77,0.15)] text-[#ff9f4d]'
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#999]'
              }`}>
              <span className="text-[12px] font-bold">x2</span>
            </div>
            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.12em] whitespace-nowrap ${isX2 ? 'text-[#ff9f4d]' : 'text-[#555]'}`}>
              Double
            </span>
          </button>
        )}

        {/* Manual capture */}
        <button
          onClick={onManualCapture}
          disabled={disabled || allDone}
          title="Chụp một ảnh"
          className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
        >
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border transition-all duration-150
            ${disabled || allDone
              ? 'bg-[#141414] border-[#1e1e1e] text-[#2e2e2e]'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#999] hover:border-[#444] hover:text-white active:scale-95'
            }`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
              <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z" />
            </svg>
          </div>
          <span className={`text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.12em] whitespace-nowrap ${disabled || allDone ? 'text-[#2e2e2e]' : 'text-[#555]'}`}>
            Chụp
          </span>
        </button>

        {/* AUTO */}
        <button
          onClick={onAutoCapture}
          disabled={disabled || allDone}
          title="Tự động chụp hết"
          className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed transform -translate-y-1"
        >
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-150
            ${disabled || allDone
              ? 'bg-[#141414] border border-[#1e1e1e] text-[#2e2e2e]'
              : isCapturing
                ? 'bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.15)]'
                : 'bg-white text-black hover:bg-[#e8e8e8] active:scale-95 shadow-[0_0_16px_rgba(255,255,255,0.08)]'
            }`}>
            {isCapturing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-6 sm:h-6 animate-pulse">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-7 sm:h-7">
                <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
              </svg>
            )}
          </div>
          <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.05em] sm:tracking-[0.12em] whitespace-nowrap ${disabled || allDone ? 'text-[#2e2e2e]' : 'text-white'}`}>
            {isCapturing ? 'Chụp...' : 'AUTO'}
          </span>
        </button>

        {/* Retake */}
        <button
          onClick={onRetake}
          disabled={capturedCount === 0}
          title="Chụp lại từ đầu"
          className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
        >
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border transition-all duration-150
            ${capturedCount === 0
              ? 'bg-[#141414] border-[#1e1e1e] text-[#2e2e2e]'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#999] hover:border-[#444] hover:text-white active:scale-95'
            }`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </div>
          <span className={`text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.12em] whitespace-nowrap ${capturedCount === 0 ? 'text-[#2e2e2e]' : 'text-[#555]'}`}>
            Lại
          </span>
        </button>

        {/* Upload File */}
        <button
          onClick={() => uploadRef.current?.click()}
          title="Tải ảnh lên thay vì chụp"
          className="flex flex-col items-center gap-1.5 group"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border bg-[#1a1a1a] border-[#2a2a2a] text-[#999] group-hover:border-[#444] group-hover:text-white group-active:scale-95 transition-all duration-150">
            <UploadOutlined style={{ fontSize: 16 }} />
          </div>
          <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.12em] whitespace-nowrap text-[#555] group-hover:text-[#aaa] transition-colors">
            Tải Ảnh
          </span>
        </button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleUploadFile} />
      </div>
    </div>
  )
}
