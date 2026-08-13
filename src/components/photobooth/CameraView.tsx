import type { CameraDevice } from '@/hooks/useCamera'
import { FILTERS } from '@/types/photobooth'
import type { FilterType } from '@/types/photobooth'
import { useThemeClass } from '@/stores/themeStore'

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>
  isMirrored: boolean
  isReady: boolean
  error: string | null
  activeFilter: FilterType
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

function CamBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-black/65 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white hover:bg-black/85 active:scale-95 transition-all duration-150 border border-white/20 shadow-xl cursor-pointer"
    >
      {children}
    </button>
  )
}

export default function CameraView({
  videoRef,
  isMirrored,
  isReady,
  error,
  activeFilter,
  capturedCount,
  totalSlots,
  countdownValue,
  showFlash,
  devices,
  activeDeviceId,
  onSelectDevice,
  onToggleMirror,
  onRetry,
}: CameraViewProps) {
  const tc = useThemeClass()
  const filterCss = FILTERS.find(f => f.value === activeFilter)?.css ?? 'none'

  return (
    <div className={`relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[48vh] sm:max-h-[55vh] md:aspect-none md:max-h-none md:h-full md:flex-1 rounded-2xl overflow-hidden border shadow-2xl mx-auto ${tc('bg-[#080808] border-[#222]', 'bg-[#e8e8e8] border-[#d0d0d0]')}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{
          transform: isMirrored ? 'scaleX(-1)' : 'none',
          filter: filterCss,
          display: isReady ? 'block' : 'none',
        }}
      />

      {!isReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className={`w-8 h-8 border-2 rounded-full animate-spin ${tc('border-white/10 border-t-white/60', 'border-black/15 border-t-black/60')}`} />
          <span className={`text-xs tracking-[0.2em] font-bold uppercase ${tc('text-white/40', 'text-black/40')}`}>Khởi động camera...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-4 text-center">
          <p className={`text-sm sm:text-base leading-relaxed font-medium ${tc('text-[#888]', 'text-[#666]')}`}>{error}</p>
          <button
            onClick={onRetry}
            className={`px-7 py-3 text-sm font-bold rounded-xl active:scale-95 transition shadow-2xl cursor-pointer ${tc(
              'bg-white text-black hover:bg-[#e8e8e8]',
              'bg-black text-white hover:bg-[#222]'
            )}`}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Corner controls */}
      <div className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 right-2.5 sm:right-3.5 flex justify-between items-start z-10">
        <CamBtn onClick={onToggleMirror} title="Lật ngang camera">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
            <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zm0 8h2v-2h-2v2zm0-4h2v-2h-2v2zm-4 8h2v-2h-2v2zM5 3H3v18h2V3zm4 18h2v-2H9v2zm8-16V3l-4 4 4 4V7h2V5h-2zm-8 0h2V3H9v2z" />
          </svg>
        </CamBtn>

        {/* Camera selector */}
        {devices.length > 1 ? (
          <select
            value={activeDeviceId ?? ''}
            onChange={e => onSelectDevice(e.target.value)}
            className={`h-9 sm:h-11 max-w-[140px] sm:max-w-56 px-2.5 sm:px-4 rounded-xl sm:rounded-2xl bg-black/65 backdrop-blur-md text-white/95 text-xs sm:text-sm font-bold border border-white/20 hover:bg-black/80 transition cursor-pointer outline-none shadow-xl truncate`}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className={tc('bg-[#0a0a0a] text-white', 'bg-white text-black')}>
                {d.label.length > 24 ? d.label.slice(0, 22) + '…' : d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        ) : (
          <div className="w-9 sm:w-11" />
        )}
      </div>

      {/* Countdown */}
      {countdownValue !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 z-20">
          <span
            className="text-white font-black select-none tracking-tight animate-pulse"
            style={{ fontSize: 'clamp(90px, 22vw, 220px)', lineHeight: 1, textShadow: '0 4px 60px rgba(0,0,0,0.95)' }}
          >
            {countdownValue}
          </span>
        </div>
      )}

      {/* Flash */}
      {showFlash && <div className="absolute inset-0 bg-white pointer-events-none z-30" style={{ opacity: 0.95 }} />}

      {/* Progress pill */}
      <div className="absolute bottom-2.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-10">
        <span className="bg-black/75 backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full tracking-wider border border-white/15 shadow-2xl">
          {capturedCount} / {totalSlots}
        </span>
      </div>
    </div>
  )
}
