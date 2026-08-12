import { CloseOutlined, SoundOutlined, MutedOutlined } from '@ant-design/icons'
import { COUNTDOWN_OPTIONS } from '@/types/photobooth'
import { frameImageUrl, type FrameItem } from '@/lib/frameService'
import { useThemeClass } from '@/stores/themeStore'

interface TopControlsProps {
  countdown: number
  videoRecap: boolean
  selectedFrame: FrameItem | null
  soundEnabled: boolean
  onCountdownChange: (n: number) => void
  onChooseFrame: () => void
  onClearFrame: () => void
  onContributeFrame: () => void
  onToggleSound: () => void
}

export default function TopControls({
  countdown,
  videoRecap,
  selectedFrame,
  soundEnabled,
  onCountdownChange,
  onChooseFrame,
  onClearFrame,
  onContributeFrame,
  onToggleSound,
}: TopControlsProps) {
  const tc = useThemeClass()

  const PILL = 'text-sm font-bold px-5 py-2.5 rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer'
  const PILL_ON = `${PILL} ${tc(
    'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]',
    'bg-black text-white border-black shadow-[0_0_20px_rgba(0,0,0,0.2)]'
  )}`
  const PILL_OFF = `${PILL} ${tc(
    'border-[#252525] bg-[#0d0d0d] text-[#888] hover:border-[#444] hover:text-[#eee]',
    'border-[#d0d0d0] bg-white text-[#666] hover:border-[#999] hover:text-[#111]'
  )}`

  return (
    <div className="flex items-center gap-6 sm:gap-10 flex-wrap">
      {/* Chọn Khung */}
      <div className="flex flex-col gap-2">
        <span className={`text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-60 ${tc('text-white', 'text-black')}`}>Khung Ảnh</span>
        <div className="flex items-center gap-2">
          <button
            id="tour-frame-button"
            onClick={onChooseFrame}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border text-sm font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-sm ${
              selectedFrame
                ? tc(
                    'border-white/30 text-white bg-[#141414] hover:bg-[#1f1f1f]',
                    'border-black/30 text-black bg-white hover:bg-[#f0f0f0]'
                  )
                : tc(
                    'border-dashed border-[#2a2a2a] text-[#ddd] hover:border-[#555] hover:text-white bg-[#0d0d0d]',
                    'border-dashed border-[#d0d0d0] text-[#555] hover:border-[#888] hover:text-black bg-white'
                  )
            }`}
          >
            {selectedFrame ? (
              <>
                <img 
                  src={frameImageUrl(selectedFrame.filename, selectedFrame.storageUrl)} 
                  alt="" 
                  className="w-4 h-5 object-contain shrink-0 opacity-90 rounded-sm" 
                />
                <span>Đổi khung ({selectedFrame.name.length > 14 ? selectedFrame.name.slice(0, 12) + '…' : selectedFrame.name})</span>
              </>
            ) : (
              <span>🖼️ Chọn khung ảnh</span>
            )}
          </button>
          {selectedFrame && (
            <button
              onClick={onClearFrame}
              title="Bỏ khung"
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition cursor-pointer active:scale-95 ${tc(
                'border-[#2a2a2a] bg-[#141414] text-white hover:text-red-400 hover:border-red-400/40',
                'border-[#d9d9d9] bg-white text-black hover:text-red-500 hover:border-red-400/40'
              )}`}
            >
              <CloseOutlined style={{ fontSize: 13 }} />
            </button>
          )}
          <button
            onClick={onContributeFrame}
            title="Đóng góp khung ảnh của bạn"
            className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed transition active:scale-95 cursor-pointer ${tc(
              'border-[#252525] text-[#777] hover:border-[#444] hover:text-[#bbb] bg-[#0a0a0a]',
              'border-[#d0d0d0] text-[#888] hover:border-[#999] hover:text-[#333] bg-white'
            )}`}
          >
            + Đóng góp
          </button>
        </div>
      </div>

      <div className={`w-px h-11 hidden sm:block ${tc('bg-[#1e1e1e]', 'bg-[#e0e0e0]')}`} />

      {/* Countdown pills */}
      <div className="flex flex-col gap-2">
        <span className={`text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-60 ${tc('text-white', 'text-black')}`}>Đếm Ngược</span>
        <div className="flex gap-2">
          {COUNTDOWN_OPTIONS.map(n => {
            const isDisabled = n === 0 && videoRecap
            return (
              <button
                key={n}
                onClick={() => onCountdownChange(n)}
                disabled={isDisabled}
                title={isDisabled ? "Vui lòng tắt Video Recap để dùng 0s" : `${n} giây`}
                className={`${countdown === n ? PILL_ON : PILL_OFF} ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                style={{ minWidth: '48px' }}
              >
                {n}s
              </button>
            )
          })}
        </div>
      </div>

      <div className={`w-px h-11 hidden sm:block ${tc('bg-[#1e1e1e]', 'bg-[#e0e0e0]')}`} />

      {/* Sound toggle */}
      <div className="flex flex-col gap-2">
        <span className={`text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-60 ${tc('text-white', 'text-black')}`}>Âm Thanh</span>
        <button
          id="tour-sound-button"
          onClick={onToggleSound}
          title={soundEnabled ? 'Tắt âm thanh chụp' : 'Bật âm thanh chụp'}
          className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer ${
            soundEnabled
              ? tc(
                  'border-white/30 bg-[#141414] text-white hover:bg-[#1f1f1f] shadow-[0_0_12px_rgba(255,255,255,0.1)]',
                  'border-black/30 bg-white text-black hover:bg-[#f0f0f0] shadow-[0_0_12px_rgba(0,0,0,0.1)]'
                )
              : tc(
                  'border-[#252525] bg-[#0d0d0d] text-[#666] hover:border-[#444] hover:text-[#aaa]',
                  'border-[#d0d0d0] bg-white text-[#888] hover:border-[#999] hover:text-[#444]'
                )
          }`}
        >
          {soundEnabled ? <SoundOutlined style={{ fontSize: 17 }} /> : <MutedOutlined style={{ fontSize: 17 }} />}
        </button>
      </div>
    </div>
  )
}
