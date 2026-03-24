import { FILTERS, EFFECTS } from '@/types/photobooth'
import type { FilterType, EffectType } from '@/types/photobooth'

interface FilterPanelProps {
  activeFilter: FilterType
  activeEffects: EffectType[]
  onFilterChange: (f: FilterType) => void
  onEffectToggle: (e: EffectType) => void
}

const PILL = 'text-[11px] px-2.5 py-1 rounded-md border transition-all duration-150 whitespace-nowrap cursor-pointer'
const ON = `${PILL} bg-white text-black border-white font-semibold`
const OFF = `${PILL} border-[#222] text-[#5a5a5a] hover:border-[#333] hover:text-[#aaa]`

export default function FilterPanel({
  activeFilter,
  activeEffects,
  onFilterChange,
  onEffectToggle,
}: FilterPanelProps) {
  return (
    <div className="bg-[#111] rounded-xl border border-[#1e1e1e] px-4 py-3 flex flex-col gap-3">
      <div>
        <p className="text-[#3a3a3a] text-[9px] font-semibold uppercase tracking-[0.18em] mb-2">Bộ lọc màu</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => onFilterChange(f.value)} className={activeFilter === f.value ? ON : OFF}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-px bg-[#181818]" />
      <div>
        <p className="text-[#3a3a3a] text-[9px] font-semibold uppercase tracking-[0.18em] mb-2">
          Hiệu ứng{' '}
          <span className="normal-case font-normal text-[#2a2a2a]">(sau khi chụp)</span>
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
