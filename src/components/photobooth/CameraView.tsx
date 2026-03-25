import type { CameraDevice } from '@/hooks/useCamera'
import { FILTERS } from '@/types/photobooth'
import type { FilterType, AR3DFilterType, BackgroundType } from '@/types/photobooth'
import AR3DOverlay from './AR3DOverlay'
import BackgroundView from './BackgroundView'
import { useRef, useImperativeHandle, forwardRef } from 'react'

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>
  isMirrored: boolean
  isReady: boolean
  error: string | null
  activeFilter: FilterType
  active3DFilter: AR3DFilterType | null
  activeBackground: BackgroundType | null
  capturedCount: number
  totalSlots: number
  countdownValue: number | null
  showFlash: boolean
  devices: CameraDevice[]
  activeDeviceId: string | null
  onSelectDevice: (deviceId: string) => void
  onToggleMirror: () => void
  onRetry: () => void
}

export interface CameraViewRef {
  capture: (filterCss?: string) => string | null
}

function CamBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition-all duration-150 border border-white/5"
    >
      {children}
    </button>
  )
}

const CameraView = forwardRef<CameraViewRef, CameraViewProps>(({
  videoRef,
  isMirrored,
  isReady,
  error,
  activeFilter,
  active3DFilter,
  activeBackground,
  capturedCount,
  totalSlots,
  countdownValue,
  showFlash,
  devices,
  activeDeviceId,
  onSelectDevice,
  onToggleMirror,
  onRetry,
}, ref) => {
  const filterCss = FILTERS.find(f => f.value === activeFilter)?.css ?? 'none'
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const arContainerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    capture: (filterCss?: string) => {
      const video = videoRef.current
      if (!video || !isReady) return null

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!

      if (filterCss && filterCss !== 'none') {
        ctx.filter = filterCss
      }

      if (isMirrored) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }

      // 1. Draw Background (if active) OR Video
      if (activeBackground && activeBackground !== 'none' && bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0, canvas.width, canvas.height)
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }

      // 2. Draw AR Overlay (if active)
      const arCanvas = arContainerRef.current?.querySelector('canvas')
      if (active3DFilter && arCanvas) {
        ctx.drawImage(arCanvas, 0, 0, canvas.width, canvas.height)
      }

      return canvas.toDataURL('image/jpeg', 0.95)
    }
  }))

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#080808] border border-[#1a1a1a] aspect-4/3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-300 ${activeBackground && activeBackground !== 'none' ? 'opacity-0' : 'opacity-100'}`}
        style={{
          transform: isMirrored ? 'scaleX(-1)' : 'none',
          filter: filterCss,
          display: isReady ? 'block' : 'none',
        }}
      />

      {/* AI Background Layer */}
      <BackgroundView
        ref={bgCanvasRef}
        videoElement={videoRef.current}
        activeBackground={activeBackground}
        isEnabled={isReady}
        isMirrored={isMirrored}
      />

      {/* AR 3D Filter Overlay */}
      <AR3DOverlay
        ref={arContainerRef}
        videoElement={videoRef.current}
        activeFilter={active3DFilter}
        isEnabled={!!active3DFilter && isReady}
        isMirrored={isMirrored}
      />

      {!isReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-[#222] border-t-[#555] rounded-full animate-spin" />
          <span className="text-[10px] tracking-[0.2em] uppercase text-[#3a3a3a]">Khởi động camera...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-3 text-center">
          <p className="text-[#555] text-sm leading-relaxed">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-[#e8e8e8] active:scale-95 transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Corner controls */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
        <CamBtn onClick={onToggleMirror} title="Lật ngang">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zm0 8h2v-2h-2v2zm0-4h2v-2h-2v2zm-4 8h2v-2h-2v2zM5 3H3v18h2V3zm4 18h2v-2H9v2zm8-16V3l-4 4 4 4V7h2V5h-2zm-8 0h2V3H9v2z" />
          </svg>
        </CamBtn>

        {/* Camera selector */}
        {devices.length > 1 ? (
          <select
            value={activeDeviceId ?? ''}
            onChange={e => onSelectDevice(e.target.value)}
            className="h-8 max-w-40 px-2 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 text-[11px] border border-white/8 hover:bg-black/70 transition cursor-pointer outline-none"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className="bg-[#1a1a1a] text-white">
                {d.label.length > 24 ? d.label.slice(0, 22) + '…' : d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Countdown */}
      {countdownValue !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/15">
          <span
            className="text-white font-black select-none"
            style={{ fontSize: 'clamp(80px, 20vw, 160px)', lineHeight: 1, textShadow: '0 2px 40px rgba(0,0,0,0.9)' }}
          >
            {countdownValue}
          </span>
        </div>
      )}

      {/* Flash */}
      {showFlash && <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.92 }} />}

      {/* Progress pill */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2">
        <span className="bg-black/55 backdrop-blur-sm text-white/80 text-[10px] font-medium px-3 py-0.5 rounded-full tracking-wider border border-white/8">
          {capturedCount} / {totalSlots}
        </span>
      </div>
    </div>
  )
})

export default CameraView
