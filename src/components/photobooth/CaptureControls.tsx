import { useRef } from 'react'
import { Switch } from 'antd'
import {
  UploadOutlined,
  CloseOutlined,
  SoundOutlined,
  MutedOutlined,
} from '@ant-design/icons'
import type { LayoutConfig } from '@/types/photobooth'
import { COUNTDOWN_OPTIONS } from '@/types/photobooth'
import { frameImageUrl, type FrameItem } from '@/lib/frameService'
import { useThemeClass } from '@/stores/themeStore'

interface CaptureControlsProps {
  isReady: boolean
  isCapturing: boolean
  countdown: number
  capturedCount: number
  totalSlots: number
  videoRecap: boolean
  selectedFrame: FrameItem | null
  soundEnabled: boolean
  onManualCapture: () => void
  onAutoCapture: () => void
  onRetake: () => void
  onUploadAll: (dataUrl: string) => void
  onToggleVideoRecap: (v: boolean) => void
  onChooseFrame: () => void
  onClearFrame: () => void
  onContributeFrame: () => void
  onCountdownChange: (n: number) => void
  onToggleSound: () => void
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
  selectedFrame,
  soundEnabled,
  onManualCapture,
  onAutoCapture,
  onRetake,
  onUploadAll,
  onToggleVideoRecap,
  onChooseFrame,
  onClearFrame,
  onContributeFrame,
  onCountdownChange,
  onToggleSound,
  isX2,
  onToggleX2,
  layout,
}: CaptureControlsProps) {
  const tc = useThemeClass()
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
    <div
      id="tour-capture-controls"
      className={`relative w-full rounded-2xl border px-2.5 sm:px-3.5 py-2 flex items-center justify-between gap-1.5 sm:gap-2 shadow-2xl ${tc(
        'bg-[#111] border-[#222]',
        'bg-white border-[#d8d8d8]'
      )}`}
    >
      {/* ── Progress bar top line ── */}
      <div className={`absolute top-0 inset-x-0 h-1 overflow-hidden rounded-t-2xl ${tc('bg-[#1a1a1a]', 'bg-[#e5e5e5]')}`}>
        <div
          className={`h-full transition-all duration-500 rounded-full ${tc('bg-white/80', 'bg-black/70')}`}
          style={{ width: totalSlots > 0 ? `${(capturedCount / totalSlots) * 100}%` : '0%' }}
        />
      </div>

      {/* ── Group 1: Khung Ảnh ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          id="tour-frame-button"
          onClick={onChooseFrame}
          disabled={isCapturing}
          className={`h-10 px-2.5 sm:px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-95 shadow-sm ${
            isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
          } ${
            selectedFrame
              ? tc(
                  'border-white/30 text-white bg-[#181818] hover:bg-[#222]',
                  'border-black/30 text-black bg-[#f0f0f0] hover:bg-[#e4e4e4]'
                )
              : tc(
                  'border-amber-400/80 text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 shadow-[0_0_16px_rgba(251,191,36,0.35)] animate-pulse',
                  'border-amber-500 text-amber-900 bg-amber-100 hover:bg-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.35)] animate-pulse'
                )
          }`}
        >
          {selectedFrame ? (
            <>
              <img
                src={frameImageUrl(selectedFrame.filename, selectedFrame.storageUrl)}
                alt=""
                className="w-3.5 h-4.5 object-contain shrink-0 rounded-xs"
              />
              <span className="truncate max-w-[80px] sm:max-w-[120px]">{selectedFrame.name}</span>
            </>
          ) : (
            <>
              <span className="text-sm sm:text-base">🖼️</span>
              <span>Chọn khung</span>
            </>
          )}
        </button>

        {selectedFrame && (
          <button
            onClick={onClearFrame}
            disabled={isCapturing}
            title="Bỏ khung"
            className={`w-9 h-10 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition active:scale-95 ${
              isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
            } ${tc(
              'border-[#2a2a2a] bg-[#161616] text-[#999] hover:text-red-400 hover:border-red-400/40',
              'border-[#d0d0d0] bg-white text-[#666] hover:text-red-500 hover:border-red-400/40'
            )}`}
          >
            <CloseOutlined style={{ fontSize: 11 }} />
          </button>
        )}

        <button
          onClick={onContributeFrame}
          disabled={isCapturing}
          title="Đóng góp khung"
          className={`h-10 px-2.5 rounded-xl border border-dashed text-xs font-semibold transition active:scale-95 hidden 2xl:flex items-center ${
            isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
          } ${tc(
            'border-[#2a2a2a] text-[#777] hover:border-[#555] hover:text-[#ddd] bg-[#0a0a0a]',
            'border-[#d0d0d0] text-[#777] hover:border-[#999] hover:text-[#111] bg-[#f9f9f9]'
          )}`}
        >
          + Đóng góp
        </button>
      </div>

      {/* ── Divider ── */}
      <div className={`w-px h-6 shrink-0 ${tc('bg-[#262626]', 'bg-[#e0e0e0]')}`} />

      {/* ── Group 2: Countdown & Sound ── */}
      <div className="flex items-center gap-1 shrink-0">
        {COUNTDOWN_OPTIONS.map((n) => {
          const isDisabled = (n === 0 && videoRecap) || isCapturing
          return (
            <button
              key={n}
              onClick={() => onCountdownChange(n)}
              disabled={isDisabled}
              title={n === 0 && videoRecap ? 'Tắt Video để dùng 0s' : `${n} giây`}
              className={`h-10 min-w-[34px] sm:min-w-[38px] px-1.5 sm:px-2 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                countdown === n
                  ? tc(
                      'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.25)]',
                      'bg-black text-white border-black shadow-[0_0_12px_rgba(0,0,0,0.25)]'
                    )
                  : tc(
                      'border-[#262626] bg-[#0e0e0e] text-[#888] hover:border-[#444] hover:text-[#eee]',
                      'border-[#d0d0d0] bg-white text-[#666] hover:border-[#999] hover:text-[#111]'
                    )
              } ${isDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-95'}`}
            >
              {n}s
            </button>
          )
        })}

        <button
          id="tour-sound-button"
          onClick={onToggleSound}
          disabled={isCapturing}
          title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          className={`w-9 h-10 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition ${
            isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-95'
          } ${
            soundEnabled
              ? tc('border-white/30 bg-[#181818] text-white', 'border-black/30 bg-white text-black')
              : tc('border-[#262626] bg-[#0e0e0e] text-[#666] hover:border-[#444] hover:text-[#aaa]', 'border-[#d0d0d0] bg-white text-[#999] hover:border-[#999] hover:text-[#444]')
          }`}
        >
          {soundEnabled ? <SoundOutlined style={{ fontSize: 14 }} /> : <MutedOutlined style={{ fontSize: 14 }} />}
        </button>
      </div>

      {/* ── Divider ── */}
      <div className={`w-px h-6 shrink-0 ${tc('bg-[#262626]', 'bg-[#e0e0e0]')}`} />

      {/* ── Group 3: Capture Actions ── */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Video Recap */}
        <label
          id="tour-video-btn"
          className={`h-10 px-2 sm:px-2.5 rounded-xl border flex items-center gap-1.5 select-none transition-all ${
            countdown === 0 || isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-95'
          } ${
            videoRecap && countdown > 0
              ? tc('bg-[#0a0a0a] border-[#4da6ff] text-[#4da6ff] shadow-[0_0_12px_rgba(77,166,255,0.25)]', 'bg-white border-[#4da6ff] text-[#4da6ff] shadow-[0_0_12px_rgba(77,166,255,0.25)]')
              : tc('bg-[#0e0e0e] border-[#262626] text-[#888] hover:border-[#444]', 'bg-white border-[#d0d0d0] text-[#777] hover:border-[#999]')
          }`}
          title={countdown === 0 ? 'Không hỗ trợ quay video khi chụp 0s' : 'Quay video recap'}
        >
          <Switch
            size="small"
            disabled={countdown === 0 || isCapturing}
            checked={videoRecap}
            onChange={onToggleVideoRecap}
            style={{ background: videoRecap && countdown > 0 ? '#4da6ff' : undefined }}
          />
          <span className="text-xs font-bold uppercase tracking-wider hidden xl:inline">Video</span>
        </label>

        {/* Double x2 */}
        {layout.cols === 1 && layout.slots > 1 && (
          <button
            id="tour-double-btn"
            onClick={() => onToggleX2(!isX2)}
            disabled={isCapturing}
            title="Nhân đôi strip (side-by-side)"
            className={`h-10 px-2.5 rounded-xl border text-xs font-black transition-all ${
              isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-95'
            } ${
              isX2
                ? tc('bg-[#0a0a0a] border-[#ff9f4d] text-[#ff9f4d] shadow-[0_0_12px_rgba(255,159,77,0.25)]', 'bg-white border-[#ff9f4d] text-[#ff9f4d] shadow-[0_0_12px_rgba(255,159,77,0.25)]')
                : tc('bg-[#0e0e0e] border-[#262626] text-[#888] hover:border-[#444] hover:text-[#ccc]', 'bg-white border-[#d0d0d0] text-[#777] hover:border-[#999] hover:text-[#333]')
            }`}
          >
            x2
          </button>
        )}

        {/* Retake */}
        <button
          id="tour-retake-btn"
          onClick={onRetake}
          disabled={capturedCount === 0 || isCapturing}
          title="Chụp lại từ đầu"
          className={`w-9 h-10 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all ${
            capturedCount === 0 || isCapturing
              ? 'opacity-30 cursor-not-allowed pointer-events-none'
              : 'cursor-pointer active:scale-95'
          } ${
            capturedCount === 0
              ? tc('bg-[#141414] border-[#1e1e1e] text-[#333]', 'bg-[#f0f0f0] border-[#e0e0e0] text-[#ccc]')
              : tc('bg-[#0e0e0e] border-[#262626] text-[#bbb] hover:border-[#555] hover:text-white', 'bg-white border-[#d0d0d0] text-[#666] hover:border-[#999] hover:text-black')
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
          </svg>
        </button>

        {/* Upload file */}
        <button
          id="tour-upload-btn"
          onClick={() => uploadRef.current?.click()}
          disabled={isCapturing}
          title="Tải ảnh lên thay vì chụp"
          className={`w-9 h-10 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all ${
            isCapturing ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-95'
          } ${tc(
            'bg-[#0e0e0e] border-[#262626] text-[#bbb] hover:border-[#555] hover:text-white',
            'bg-white border-[#d0d0d0] text-[#666] hover:border-[#999] hover:text-black'
          )}`}
        >
          <UploadOutlined style={{ fontSize: 16 }} />
        </button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleUploadFile} disabled={isCapturing} />

        {/* Single Manual Capture */}
        <button
          id="tour-manual-btn"
          onClick={onManualCapture}
          disabled={disabled || allDone}
          title="Chụp một ảnh"
          className={`h-10 px-3 sm:px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer ${
            disabled || allDone
              ? tc('bg-[#141414] border-[#1e1e1e] text-[#333]', 'bg-[#f0f0f0] border-[#e0e0e0] text-[#ccc]')
              : tc('bg-[#0e0e0e] border-[#262626] text-[#ddd] hover:border-[#555] hover:text-white shadow-sm', 'bg-white border-[#d0d0d0] text-[#444] hover:border-[#999] hover:text-black shadow-sm')
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z" />
          </svg>
          <span className="hidden sm:inline">Chụp</span>
        </button>

        {/* AUTO Capture (Primary Prominent Button) */}
        <button
          id="tour-auto-btn"
          onClick={onAutoCapture}
          disabled={disabled || allDone}
          title="Tự động chụp hết"
          className={`h-10 sm:h-10.5 px-3.5 sm:px-5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer shadow-xl ${
            disabled || allDone
              ? tc('bg-[#141414] border border-[#1e1e1e] text-[#333]', 'bg-[#f0f0f0] border border-[#e0e0e0] text-[#ccc]')
              : isCapturing
                ? tc('bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105', 'bg-black text-white shadow-[0_0_20px_rgba(0,0,0,0.4)] scale-105')
                : tc(
                    'bg-white text-black hover:bg-[#ececec] shadow-[0_0_14px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]',
                    'bg-black text-white hover:bg-[#222] shadow-[0_0_14px_rgba(0,0,0,0.2)] hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]'
                  )
          }`}
        >
          {isCapturing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 animate-pulse">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            </svg>
          )}
          <span>{isCapturing ? 'Chụp...' : 'AUTO'}</span>
        </button>
      </div>
    </div>
  )
}
