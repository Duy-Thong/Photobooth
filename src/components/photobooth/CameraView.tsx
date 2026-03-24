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
    <div className="relative w-full rounded-2xl overflow-hidden bg-pink-50 border border-pink-200 aspect-[4/3]">
      {/* Video */}
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

      {/* Loading state */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-pink-400 gap-2">
          <div className="w-8 h-8 border-4 border-pink-300 border-t-pink-500 rounded-full animate-spin" />
          <span className="text-sm">Đang khởi động camera...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
          <p className="text-red-400 text-sm leading-relaxed">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-pink-400 text-white text-sm rounded-full hover:bg-pink-500 active:scale-95 transition"
          >
            🔄 Thử lại
          </button>
        </div>
      )}

      {/* Top controls */}
      <div className="absolute top-2 left-2 right-2 flex justify-between">
        {/* Flash / Mirror toggle */}
        <button
          onClick={onToggleMirror}
          className="w-8 h-8 rounded-full bg-white/70 backdrop-blur flex items-center justify-center text-pink-500 hover:bg-white transition shadow"
          title="Lật camera"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" />
          </svg>
        </button>
        <button
          onClick={onSwitchCamera}
          className="w-8 h-8 rounded-full bg-white/70 backdrop-blur flex items-center justify-center text-pink-500 hover:bg-white transition shadow"
          title="Đổi camera"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            <path d="M12 11l-2.5 2.5L12 11zm0 0l2.5 2.5L12 11z" />
            <path d="M12 9v6M9.5 13.5l2.5 2.5 2.5-2.5" />
          </svg>
        </button>
      </div>

      {/* Countdown overlay */}
      {countdownValue !== null && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-white font-bold drop-shadow-lg"
            style={{ fontSize: '20vw', lineHeight: 1, textShadow: '0 0 40px rgba(0,0,0,0.5)' }}
          >
            {countdownValue}
          </span>
        </div>
      )}

      {/* Flash overlay */}
      {showFlash && (
        <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.85 }} />
      )}

      {/* Progress badge */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <span className="bg-pink-400/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          Đã Chụp {capturedCount}/{totalSlots}
        </span>
      </div>
    </div>
  )
}
