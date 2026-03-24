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
    <div className="bg-white rounded-2xl border border-pink-100 p-4 flex flex-col gap-4">
      {/* Color filters */}
      <div>
        <h3 className="text-pink-500 font-semibold text-sm mb-2">Bộ lọc màu</h3>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`text-xs px-3 py-1 rounded-full border transition
                ${activeFilter === f.value
                  ? 'bg-pink-400 text-white border-pink-400'
                  : 'border-pink-200 text-gray-600 hover:border-pink-400 hover:text-pink-500'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Effects */}
      <div>
        <h4 className="text-pink-500 font-semibold text-sm mb-1">
          Hiệu ứng{' '}
          <span className="text-gray-400 font-normal text-xs">(Chụp Xong Sẽ Thấy Hiệu Ứng)</span>
        </h4>
        <div className="flex flex-wrap gap-2">
          {EFFECTS.map((e) => (
            <button
              key={e.value}
              onClick={() => onEffectToggle(e.value)}
              className={`text-xs px-3 py-1 rounded-full border transition
                ${activeEffects.includes(e.value)
                  ? 'bg-pink-400 text-white border-pink-400'
                  : 'border-pink-200 text-gray-600 hover:border-pink-400 hover:text-pink-500'
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
