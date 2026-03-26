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

const PILL = 'text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all duration-150'
const PILL_ON = `${PILL} bg-white text-black border-white`
const PILL_OFF = `${PILL} border-[#252525] text-[#666] hover:border-[#3a3a3a] hover:text-[#bbb]`

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
    <div className="flex items-center gap-5 flex-wrap">
      {/* Chọn Khung */}
      <div className="flex flex-col gap-1.5">
        <span className="text-white text-[9px] font-semibold uppercase tracking-[0.18em]">Khung</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onChooseFrame}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all duration-150 ${
              selectedFrame
                ? 'border-white/20 text-white bg-[#1a1a1a] hover:bg-[#222]'
                : 'border-dashed border-[#252525] text-[#c9c9c9] hover:border-[#3a3a3a] hover:text-[#bbb]'
            }`}
          >
            {selectedFrame ? (
              <>
                <img 
                  src={frameImageUrl(selectedFrame.filename, selectedFrame.storageUrl)} 
                  alt="" 
                  className="w-3 h-4 object-contain shrink-0 opacity-80" 
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
              className="w-6 h-6 flex items-center justify-center rounded border border-[#1e1e1e] text-white hover:text-[#aaa] hover:border-[#333] transition"
            >
              <CloseOutlined style={{ fontSize: 9 }} />
            </button>
          )}
          <button
            onClick={onContributeFrame}
            title="Đóng góp khung ảnh của bạn"
            className="text-[10px] px-2 py-1 rounded border border-dashed border-[#252525] text-[#444] hover:border-[#3a3a3a] hover:text-[#777] transition"
          >
            + Đóng góp
          </button>
        </div>
      </div>

      <div className="w-px h-8 bg-[#1e1e1e] hidden sm:block" />

      {/* Countdown pills */}
      <div className="flex flex-col gap-1.5">
        <span className="text-white text-[9px] font-semibold uppercase tracking-[0.18em]">Đếm Ngược</span>
        <div className="flex gap-1">
          {COUNTDOWN_OPTIONS.map(n => {
            const isDisabled = n === 0 && videoRecap
            return (
              <button
                key={n}
                onClick={() => onCountdownChange(n)}
                disabled={isDisabled}
                title={isDisabled ? "Vui lòng tắt Video Recap để dùng 0s" : `${n} giây`}
                className={`${countdown === n ? PILL_ON : PILL_OFF} ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {n}s
              </button>
            )
          })}
        </div>
      </div>

      <div className="w-px h-8 bg-[#1e1e1e] hidden sm:block" />

      {/* Sound toggle */}
      <div className="flex flex-col gap-1.5">
        <span className="text-white text-[9px] font-semibold uppercase tracking-[0.18em]">Âm Thanh</span>
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Tắt âm thanh chụp' : 'Bật âm thanh chụp'}
          className={`w-7 h-7 flex items-center justify-center rounded border transition-all duration-150 ${
            soundEnabled
              ? 'border-white/20 bg-[#1a1a1a] text-white hover:bg-[#222]'
              : 'border-[#252525] text-[#444] hover:border-[#3a3a3a] hover:text-[#777]'
          }`}
        >
          {soundEnabled ? <SoundOutlined style={{ fontSize: 13 }} /> : <MutedOutlined style={{ fontSize: 13 }} />}
        </button>
      </div>
    </div>
  )
}
