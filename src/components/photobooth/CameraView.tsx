import { FILTERS } from '@/types/photobooth'
import type { FilterType } from '@/types/photobooth'

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
  onSwitchCamera: () => void
  onToggleMirror: () => void
  onRetry: () => void
}

function CamBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition-all duration-150 border border-white/[0.05]"
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
  onSwitchCamera,
  onToggleMirror,
  onRetry,
}: CameraViewProps) {
  const filterCss = FILTERS.find(f => f.value === activeFilter)?.css ?? 'none'

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#080808] border border-[#1a1a1a] aspect-[4/3]">
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
      <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between pointer-events-none">
        <CamBtn onClick={onToggleMirror} title="Lật ngang">
          {/* Horizontal flip icon */}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zm0 8h2v-2h-2v2zm0-4h2v-2h-2v2zm-4 8h2v-2h-2v2zM5 3H3v18h2V3zm4 18h2v-2H9v2zm8-16V3l-4 4 4 4V7h2V5h-2zm-8 0h2V3H9v2z" />
          </svg>
        </CamBtn>
        <CamBtn onClick={onSwitchCamera} title="Đổi camera">
          {/* Camera rotate icon */}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm3.5-5c0-1.93-1.57-3.5-3.5-3.5S8.5 9.07 8.5 11s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5z" />
          </svg>
        </CamBtn>
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
        <span className="bg-black/55 backdrop-blur-sm text-white/80 text-[10px] font-medium px-3 py-0.5 rounded-full tracking-wider border border-white/[0.08]">
          {capturedCount} / {totalSlots}
        </span>
      </div>
    </div>
  )
}
