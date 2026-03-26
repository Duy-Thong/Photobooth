import { CloseOutlined, SoundOutlined, MutedOutlined } from '@ant-design/icons'
import { COUNTDOWN_OPTIONS } from '@/types/photobooth'
import { frameImageUrl, type FrameItem } from '@/lib/frameService'

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

const PILL = 'text-[13px] font-medium px-4 py-2 rounded-lg border transition-all duration-150'
const PILL_ON = `${PILL} bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.15)]`
const PILL_OFF = `${PILL} border-[#252525] text-[#888] hover:border-[#444] hover:text-[#ddd]`

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
  return (
    <div className="flex items-center gap-8 flex-wrap">
      {/* Chọn Khung */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-[10px] font-bold uppercase tracking-[0.12em] opacity-50">Khung</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onChooseFrame}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-semibold transition-all duration-150 ${
              selectedFrame
                ? 'border-white/20 text-white bg-[#1a1a1a] hover:bg-[#222]'
                : 'border-dashed border-[#252525] text-[#c9c9c9] hover:border-[#383838] hover:text-white'
            }`}
          >
            {selectedFrame ? (
              <>
                <img 
                  src={frameImageUrl(selectedFrame.filename, selectedFrame.storageUrl)} 
                  alt="" 
                  className="w-3.5 h-4.5 object-contain shrink-0 opacity-90" 
                />
                <span>Đổi khung</span>
              </>
            ) : (
              <span>🖼 Chọn khung</span>
            )}
          </button>
          {selectedFrame && (
            <button
              onClick={onClearFrame}
              title="Bỏ khung"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-white hover:text-red-400 hover:border-red-400/30 transition"
            >
              <CloseOutlined style={{ fontSize: 11 }} />
            </button>
          )}
          <button
            onClick={onContributeFrame}
            title="Đóng góp khung ảnh của bạn"
            className="text-[11px] px-3 py-2 rounded-lg border border-dashed border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888] transition"
          >
            + Đóng góp
          </button>
        </div>
      </div>

      <div className="w-px h-10 bg-[#1e1e1e] hidden sm:block" />

      {/* Countdown pills */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-[10px] font-bold uppercase tracking-[0.12em] opacity-50">Đếm Ngược</span>
        <div className="flex gap-1.5">
          {COUNTDOWN_OPTIONS.map(n => {
            const isDisabled = n === 0 && videoRecap
            return (
              <button
                key={n}
                onClick={() => onCountdownChange(n)}
                disabled={isDisabled}
                title={isDisabled ? "Vui lòng tắt Video Recap để dùng 0s" : `${n} giây`}
                className={`${countdown === n ? PILL_ON : PILL_OFF} ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                style={{ minWidth: '42px' }}
              >
                {n}s
              </button>
            )
          })}
        </div>
      </div>

      <div className="w-px h-10 bg-[#1e1e1e] hidden sm:block" />

      {/* Sound toggle */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-[10px] font-bold uppercase tracking-[0.12em] opacity-50">Âm Thanh</span>
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Tắt âm thanh chụp' : 'Bật âm thanh chụp'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-150 ${
            soundEnabled
              ? 'border-white/20 bg-[#1a1a1a] text-white hover:bg-[#222]'
              : 'border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888]'
          }`}
        >
          {soundEnabled ? <SoundOutlined style={{ fontSize: 15 }} /> : <MutedOutlined style={{ fontSize: 15 }} />}
        </button>
      </div>
    </div>
  )
}
