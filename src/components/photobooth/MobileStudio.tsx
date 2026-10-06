import { useRef } from 'react'
import {
  SyncOutlined,
  UndoOutlined,
  UploadOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  MutedOutlined,
} from '@ant-design/icons'
import type { CameraDevice } from '@/hooks/useCamera'
import type { CapturedSlot, EffectType, LayoutConfig } from '@/types/photobooth'
import { COUNTDOWN_OPTIONS } from '@/types/photobooth'
import type { FrameItem } from '@/lib/frameService'
import { useThemeClass } from '@/stores/themeStore'
import PhotoStrip from '@/components/photobooth/PhotoStrip'

export interface MobileStudioProps {
  isMobile: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  isMirrored: boolean
  isReady: boolean
  devices: CameraDevice[]
  activeDeviceId: string | null
  onSelectDevice: (deviceId: string) => void
  onToggleMirror: () => void

  layout: LayoutConfig
  capturedSlots: (CapturedSlot | null)[]
  capturedCount: number
  finalImageUrl: string | null
  selectedFrame: FrameItem | null
  activeEffects: EffectType[]
  isCapturing: boolean
  countdownValue: number | null
  showFlash: boolean
  countdown: number
  videoRecap: boolean
  soundEnabled: boolean
  isX2: boolean
  buildingStrip: boolean

  onManualCapture: () => void
  onAutoCapture: () => void
  onRetake: () => void
  onUploadAll: (dataUrl: string) => void
  onToggleVideoRecap: (v: boolean) => void
  onChooseFrame: () => void
  onCountdownChange: (n: number) => void
  onToggleSound: () => void
  onToggleX2: (v: boolean) => void
  onUploadSlot: (index: number, dataUrl: string) => void
  onRemoveSlot: (index: number) => void
  onDownload: () => void
  onBuildStrip: () => void
}

export default function MobileStudio({
  isMobile,
  videoRef,
  stream,
  isMirrored,
  isReady,
  devices,
  activeDeviceId,
  onSelectDevice,
  onToggleMirror,
  layout,
  capturedSlots,
  capturedCount,
  finalImageUrl,
  selectedFrame,
  activeEffects,
  isCapturing,
  countdownValue,
  showFlash,
  countdown,
  videoRecap,
  soundEnabled,
  isX2,
  buildingStrip,
  onManualCapture,
  onAutoCapture,
  onRetake,
  onUploadAll,
  onToggleVideoRecap,
  onChooseFrame,
  onCountdownChange,
  onToggleSound,
  onToggleX2,
  onUploadSlot,
  onRemoveSlot,
  onDownload,
  onBuildStrip,
}: MobileStudioProps) {
  const tc = useThemeClass()
  const mobileUploadRef = useRef<HTMLInputElement>(null)

  const handleMobileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onUploadAll(ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      {/* Mobile Background Headless Camera Feed (so captureFrame and videoRecap work flawlessly) */}
      {isMobile && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="fixed -top-[9999px] -left-[9999px] w-[640px] h-[480px] opacity-0 pointer-events-none"
          style={{
            transform: isMirrored ? 'scaleX(-1)' : 'none',
          }}
        />
      )}

      {/* ══════════════ MOBILE FRAME-FIRST STUDIO (flex md:hidden) ══════════════ */}
      <div className="flex md:hidden flex-col h-full justify-between items-center w-full overflow-hidden min-h-0 pb-1">
        {/* Mobile Top Tools: Camera Flip & Mirror */}
        <div className="w-full flex items-center justify-between px-1 py-0.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {devices.length > 1 && (
              <div className="relative inline-flex items-center">
                <select
                  value={activeDeviceId ?? ''}
                  onChange={e => onSelectDevice(e.target.value)}
                  title="Chọn camera"
                  className={`h-8 pl-6.5 pr-5 rounded-xl border text-[11px] font-bold transition active:scale-95 cursor-pointer shadow-xs appearance-none outline-none max-w-[130px] truncate ${tc(
                    'bg-[#141414] border-[#282828] text-white',
                    'bg-white border-[#d8d8d8] text-black'
                  )}`}
                >
                  {devices.map((d, i) => (
                    <option
                      key={d.deviceId}
                      value={d.deviceId}
                      className={tc('bg-[#141414] text-white', 'bg-white text-black')}
                    >
                      {d.label ? (d.label.length > 16 ? d.label.slice(0, 14) + '…' : d.label) : `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
                <SyncOutlined className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] opacity-70" />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] opacity-60">
                  ▾
                </span>
              </div>
            )}

            <button
              onClick={onToggleMirror}
              title="Lật gương camera"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs ${tc(
                'bg-[#141414] border-[#282828] text-white',
                'bg-white border-[#d8d8d8] text-black'
              )}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zm0 8h2v-2h-2v2zm0-4h2v-2h-2v2zm-4 8h2v-2h-2v2zM5 3H3v18h2V3zm4 18h2v-2H9v2zm8-16V3l-4 4 4 4V7h2V5h-2zm-8 0h2V3H9v2z" />
              </svg>
              <span className="text-[11px] font-bold">{isMirrored ? 'Đang lật' : 'Gương'}</span>
            </button>
          </div>

          {/* Progress badge */}
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-wider ${tc(
              'bg-[#141414] border-[#262626] text-white/80',
              'bg-white border-[#e0e0e0] text-black/80'
            )}`}
          >
            {capturedCount} / {layout.slots} ảnh
          </div>
        </div>

        {/* Mobile Hero: PhotoStrip as Viewfinder */}
        <div className="flex-1 h-full w-full flex flex-col justify-start items-center pt-0.5 pb-1 overflow-hidden min-h-0">
          <PhotoStrip
            layout={layout}
            slots={capturedSlots}
            finalImageUrl={finalImageUrl}
            selectedFrame={selectedFrame}
            activeEffects={activeEffects}
            stream={stream}
            isMirrored={isMirrored}
            isCapturing={isCapturing}
            countdownValue={countdownValue}
            showFlash={showFlash}
            onUploadSlot={onUploadSlot}
            onRemoveSlot={onRemoveSlot}
            onDownload={onDownload}
            onBuildStrip={onBuildStrip}
          />
        </div>

        {/* Mobile Bottom Deck: Quick Settings + Shutter */}
        <div className="w-full flex flex-col gap-1.5 shrink-0 pt-0.5 pb-1.5">
          {/* Row 1: Quick Settings Pill Bar */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
            {/* Frame Picker */}
            <button
              onClick={onChooseFrame}
              disabled={isCapturing}
              className={`h-8.5 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer shadow-xs ${
                selectedFrame
                  ? tc('bg-[#161616] border-[#333] text-white', 'bg-white border-[#ccc] text-black')
                  : tc(
                      'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse',
                      'bg-amber-100 border-amber-400 text-amber-900 animate-pulse'
                    )
              }`}
            >
              <span>🖼️</span>
              <span className="truncate max-w-[85px]">{selectedFrame?.name || 'Chọn khung'}</span>
              <span className="text-[8px] opacity-60">▾</span>
            </button>

            {/* Countdown Timer Pill */}
            <button
              onClick={() => {
                const curIdx = COUNTDOWN_OPTIONS.indexOf(countdown)
                const next = COUNTDOWN_OPTIONS[(curIdx + 1) % COUNTDOWN_OPTIONS.length]
                onCountdownChange(next)
              }}
              disabled={isCapturing}
              className={`h-8.5 px-2.5 rounded-xl border text-[11px] font-bold shrink-0 flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs ${
                countdown > 0
                  ? tc('bg-white text-black border-white', 'bg-black text-white border-black')
                  : tc('bg-[#141414] border-[#262626] text-[#888]', 'bg-white border-[#d8d8d8] text-[#666]')
              }`}
              title="Chạm để đổi số giây đếm ngược"
            >
              <span>⏱️</span>
              <span>{countdown}s</span>
            </button>

            {/* Video Recap Pill */}
            <button
              onClick={() => {
                if (countdown > 0 && !isCapturing) {
                  onToggleVideoRecap(!videoRecap)
                }
              }}
              disabled={countdown === 0 || isCapturing}
              className={`h-8.5 px-2 rounded-xl border text-[11px] font-bold shrink-0 flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs ${
                videoRecap && countdown > 0
                  ? tc(
                      'bg-[#0a0a0a] border-[#4da6ff] text-[#4da6ff] shadow-[0_0_10px_rgba(77,166,255,0.3)]',
                      'bg-white border-[#4da6ff] text-[#4da6ff] shadow-[0_0_10px_rgba(77,166,255,0.3)]'
                    )
                  : tc('bg-[#141414] border-[#262626] text-[#888]', 'bg-white border-[#d8d8d8] text-[#777]')
              }`}
            >
              <VideoCameraOutlined style={{ fontSize: 12 }} />
              <span>Video</span>
              <span
                className={`text-[8px] font-black px-1 rounded ${
                  videoRecap && countdown > 0 ? 'bg-[#4da6ff] text-black' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {videoRecap && countdown > 0 ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* x2 Pill */}
            {layout.cols === 1 && layout.slots > 1 && (
              <button
                onClick={() => onToggleX2(!isX2)}
                disabled={isCapturing}
                className={`h-8.5 px-2 rounded-xl border text-[11px] font-black shrink-0 transition active:scale-95 cursor-pointer shadow-xs ${
                  isX2
                    ? tc('bg-[#0a0a0a] border-[#ff9f4d] text-[#ff9f4d]', 'bg-white border-[#ff9f4d] text-[#ff9f4d]')
                    : tc('bg-[#141414] border-[#262626] text-[#888]', 'bg-white border-[#d8d8d8] text-[#777]')
                }`}
              >
                x2
              </button>
            )}

            {/* Sound Pill */}
            <button
              onClick={onToggleSound}
              disabled={isCapturing}
              className={`w-8.5 h-8.5 rounded-xl border shrink-0 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
                soundEnabled
                  ? tc('bg-[#1a1a1a] border-white/20 text-white', 'bg-white border-black/20 text-black')
                  : tc('bg-[#141414] border-[#262626] text-[#666]', 'bg-white border-[#d8d8d8] text-[#999]')
              }`}
            >
              {soundEnabled ? <SoundOutlined style={{ fontSize: 12 }} /> : <MutedOutlined style={{ fontSize: 12 }} />}
            </button>
          </div>

          {/* Row 2: Shutter Action Bar */}
          <div className="flex items-center justify-between gap-2 pt-0.5 px-0.5">
            {/* Retake & Upload Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onRetake}
                disabled={capturedCount === 0 || isCapturing}
                title="Chụp lại từ đầu"
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
                  capturedCount === 0 || isCapturing
                    ? 'opacity-30 pointer-events-none'
                    : tc('bg-[#141414] border-[#262626] text-white', 'bg-white border-[#d8d8d8] text-black')
                }`}
              >
                <UndoOutlined style={{ fontSize: 15 }} />
              </button>

              <button
                onClick={() => mobileUploadRef.current?.click()}
                disabled={isCapturing}
                title="Tải ảnh lên"
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${tc(
                  'bg-[#141414] border-[#262626] text-white',
                  'bg-white border-[#d8d8d8] text-black'
                )}`}
              >
                <UploadOutlined style={{ fontSize: 15 }} />
              </button>
              <input
                ref={mobileUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMobileUpload}
                disabled={isCapturing}
              />
            </div>

            {/* Center: Main Shutter Button or Finish Button */}
            {capturedCount === layout.slots || finalImageUrl ? (
              <button
                onClick={finalImageUrl ? onDownload : onBuildStrip}
                disabled={buildingStrip}
                className={`flex-1 h-12 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 ${tc(
                  'bg-white text-black hover:bg-gray-100 shadow-[0_0_20px_rgba(255,255,255,0.2)]',
                  'bg-black text-white hover:bg-gray-900 shadow-[0_0_20px_rgba(0,0,0,0.2)]'
                )}`}
              >
                {buildingStrip ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ĐANG TẠO ẢNH...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>
                      NHẬN ẢNH ({capturedCount}/{layout.slots})
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onManualCapture}
                disabled={!isReady || isCapturing}
                className={`flex-1 h-12 rounded-2xl font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xl ${
                  !isReady || isCapturing
                    ? 'opacity-40 cursor-not-allowed'
                    : tc('bg-white text-black hover:bg-gray-100', 'bg-black text-white hover:bg-gray-900')
                }`}
              >
                {isCapturing ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  </span>
                )}
                <span>{isCapturing ? 'ĐANG CHỤP...' : `CHỤP (${capturedCount + 1}/${layout.slots})`}</span>
              </button>
            )}

            {/* AUTO Shoot Button */}
            <button
              onClick={onAutoCapture}
              disabled={!isReady || isCapturing || capturedCount === layout.slots}
              className={`h-11 px-3.5 rounded-2xl border font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs shrink-0 ${
                !isReady || isCapturing || capturedCount === layout.slots
                  ? 'opacity-30 pointer-events-none'
                  : tc('bg-[#181818] border-[#333] text-white hover:bg-[#222]', 'bg-[#f0f0f0] border-[#ccc] text-black hover:bg-[#e4e4e4]')
              }`}
            >
              <span>⚡</span>
              <span>AUTO</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
