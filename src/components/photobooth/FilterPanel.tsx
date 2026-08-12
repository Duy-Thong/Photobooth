import { FILTERS, EFFECTS } from '@/types/photobooth'
import type { FilterType, EffectType } from '@/types/photobooth'
import { useThemeClass } from '@/stores/themeStore'

interface FilterPanelProps {
  activeFilter: FilterType
  activeEffects: EffectType[]
  onFilterChange: (f: FilterType) => void
  onEffectToggle: (e: EffectType) => void
}

export default function FilterPanel({
  activeFilter,
  activeEffects,
  onFilterChange,
  onEffectToggle,
}: FilterPanelProps) {
  const tc = useThemeClass()

  const PILL = 'text-[11px] px-2.5 py-1 rounded-md border transition-all duration-150 whitespace-nowrap cursor-pointer'
  const ON = `${PILL} ${tc('bg-white text-black border-white font-semibold', 'bg-black text-white border-black font-semibold')}`
  const OFF = `${PILL} ${tc('border-[#222] text-[#5a5a5a] hover:border-[#333] hover:text-[#aaa]', 'border-[#d0d0d0] text-[#888] hover:border-[#999] hover:text-[#333]')}`

  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-3 ${tc('bg-[#111] border-[#1e1e1e]', 'bg-white border-[#e0e0e0]')}`}>
      <div>
        <p className={`text-[9px] font-semibold uppercase tracking-[0.18em] mb-2 ${tc('text-[#3a3a3a]', 'text-[#aaa]')}`}>Bộ lọc màu</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => onFilterChange(f.value)} className={activeFilter === f.value ? ON : OFF}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`h-px ${tc('bg-[#181818]', 'bg-[#f0f0f0]')}`} />
      <div>
        <p className={`text-[9px] font-semibold uppercase tracking-[0.18em] mb-2 ${tc('text-[#3a3a3a]', 'text-[#aaa]')}`}>
          Hiệu ứng{' '}
          <span className={`normal-case font-normal ${tc('text-[#2a2a2a]', 'text-[#ccc]')}`}>(sau khi chụp)</span>
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {EFFECTS.map((e) => (
            <button key={e.value} onClick={() => onEffectToggle(e.value)} className={activeEffects.includes(e.value) ? ON : OFF}>
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
