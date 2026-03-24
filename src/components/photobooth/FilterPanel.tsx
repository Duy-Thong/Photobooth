import { FILTERS, EFFECTS } from '@/types/photobooth'
import type { FilterType, EffectType } from '@/types/photobooth'

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
  return (
    <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] p-4 flex flex-col gap-4">
      {/* Color filters */}
      <div>
        <h3 className="text-[#888] text-[10px] font-medium uppercase tracking-wider mb-2">Bộ lọc màu</h3>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`text-xs px-3 py-1 rounded-md border transition
                ${activeFilter === f.value
                  ? 'bg-white text-black border-white font-medium'
                  : 'border-[#333] text-[#888] hover:border-[#555] hover:text-white'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Effects */}
      <div>
        <h4 className="text-[#888] text-[10px] font-medium uppercase tracking-wider mb-2">
          Hiệu ứng{' '}
          <span className="text-[#555] normal-case font-normal">(hiện sau khi chụp)</span>
        </h4>
        <div className="flex flex-wrap gap-2">
          {EFFECTS.map((e) => (
            <button
              key={e.value}
              onClick={() => onEffectToggle(e.value)}
              className={`text-xs px-3 py-1 rounded-md border transition
                ${activeEffects.includes(e.value)
                  ? 'bg-white text-black border-white font-medium'
                  : 'border-[#333] text-[#888] hover:border-[#555] hover:text-white'
                }`}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
