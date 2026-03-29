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
      className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all duration-150 border border-white/10 shadow-lg"
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
    <div className={`relative w-full rounded-xl overflow-hidden border aspect-4/3 ${tc('bg-[#080808] border-[#222]', 'bg-[#e8e8e8] border-[#d0d0d0]')}`}>
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
          <div className={`w-6 h-6 border-2 rounded-full animate-spin ${tc('border-white/5 border-t-white/40', 'border-black/10 border-t-black/40')}`} />
          <span className={`text-[11px] tracking-[0.15em] font-bold uppercase ${tc('text-white/30', 'text-black/30')}`}>Khởi động camera...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-3 text-center">
          <p className={`text-sm leading-relaxed ${tc('text-[#555]', 'text-[#888]')}`}>{error}</p>
          <button
            onClick={onRetry}
            className={`px-6 py-2.5 text-[13px] font-bold rounded-xl active:scale-95 transition shadow-xl ${tc(
              'bg-white text-black hover:bg-[#e8e8e8]',
              'bg-black text-white hover:bg-[#222]'
            )}`}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Corner controls */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
        <CamBtn onClick={onToggleMirror} title="Lật ngang">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zm0 8h2v-2h-2v2zm0-4h2v-2h-2v2zm-4 8h2v-2h-2v2zM5 3H3v18h2V3zm4 18h2v-2H9v2zm8-16V3l-4 4 4 4V7h2V5h-2zm-8 0h2V3H9v2z" />
          </svg>
        </CamBtn>

        {/* Camera selector */}
        {devices.length > 1 ? (
          <select
            value={activeDeviceId ?? ''}
            onChange={e => onSelectDevice(e.target.value)}
            className={`h-10 max-w-48 px-3 rounded-xl bg-black/60 backdrop-blur-md text-white/90 text-xs font-bold border border-white/10 hover:bg-black/80 transition cursor-pointer outline-none shadow-lg`}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className={tc('bg-[#0a0a0a] text-white', 'bg-white text-black')}>
                {d.label.length > 28 ? d.label.slice(0, 26) + '…' : d.label || `Camera ${i + 1}`}
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
        <span className="bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wider border border-white/10 shadow-lg">
          {capturedCount} / {totalSlots}
        </span>
      </div>
    </div>
  )
}
