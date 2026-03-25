import { useState } from 'react'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { FILTERS, EFFECTS, BACKGROUNDS } from '@/types/photobooth'
import { MODEL_REGISTRY } from '@/lib/modelRegistry'
import type { FilterType, EffectType, AR3DFilterType, BackgroundType } from '@/types/photobooth'

interface FilterPanelProps {
  activeFilter: FilterType | null
  activeEffects: EffectType[]
  active3DFilter: AR3DFilterType | null
  onFilterChange: (f: FilterType | null) => void
  onEffectToggle: (e: EffectType) => void
  on3DFilterChange: (f: AR3DFilterType | null) => void
}

const ON = 'text-[11px] px-2.5 py-1 rounded-md border border-white bg-white text-black transition-all duration-150 whitespace-nowrap cursor-pointer'
const OFF = 'text-[11px] px-2.5 py-1 rounded-md border border-[#222] text-[#5a5a5a] hover:border-[#333] hover:text-[#aaa] transition-all duration-150 whitespace-nowrap cursor-pointer'

const AR3D_EMOJI: Record<string, string> = {
  hat: '🤠',
  glasses: '🕶️',
}

export default function FilterPanel({
  activeFilter,
  activeEffects,
  active3DFilter,
  onFilterChange,
  onEffectToggle,
  on3DFilterChange,
}: FilterPanelProps) {
  const activeBackground = usePhotoboothStore((s) => s.activeBackground) as BackgroundType | null
  const setBackground = usePhotoboothStore((s) => s.setBackground)

  const [activeTab, setActiveTab] = useState<'2d' | '3d' | 'background'>('2d')

  return (
    <div className="bg-[#111] rounded-xl border border-[#1e1e1e] px-4 py-3 flex flex-col gap-3">
      <div className="flex gap-1.5">
        <button onClick={() => setActiveTab('2d')} className={activeTab === '2d' ? ON : OFF}>
          Bộ lọc màu
        </button>
        <button onClick={() => setActiveTab('3d')} className={activeTab === '3d' ? ON : OFF}>
          3D Phụ kiện AR
        </button>
        <button onClick={() => setActiveTab('background')} className={activeTab === 'background' ? ON : OFF}>
          Phông nền
        </button>
      </div>

      <div className="h-px bg-[#181818]" />

      {activeTab === '2d' ? (
        <>
          <div>
            <p className="text-[#3a3a3a] text-[9px] font-semibold uppercase tracking-[0.18em] mb-2">Bộ lọc màu</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => (
                <button 
                  key={f.value} 
                  onClick={() => onFilterChange(activeFilter === f.value ? null : f.value)} 
                  className={activeFilter === f.value ? ON : OFF}
                >
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
                <button 
                  key={e.value} 
                  onClick={() => onEffectToggle(e.value)} 
                  className={activeEffects.includes(e.value) ? ON : OFF}
                >
                  {e.emoji} {e.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : activeTab === '3d' ? (
        <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => on3DFilterChange(null)}
            className={`flex-none group relative w-20 aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
              active3DFilter === null ? 'border-white' : 'border-[#222] text-[#5a5a5a] hover:border-[#333] hover:text-[#aaa]'
            } bg-white/5 flex flex-col items-center justify-center`}
          >
            <div className="text-white/40 text-[10px]">None</div>
          </button>
          {MODEL_REGISTRY.map((model) => (
            <button
              key={model.id}
              onClick={() => on3DFilterChange(active3DFilter === model.id ? null : (model.id as AR3DFilterType))}
              className={`flex-none group relative w-20 aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                active3DFilter === model.id ? 'border-white' : 'border-[#222] text-[#5a5a5a] hover:border-[#333] hover:text-[#aaa]'
              } bg-white/5 flex flex-col items-center justify-center`}
              title={model.name}
            >
              <div className="text-2xl">{AR3D_EMOJI[model.type] || '✨'}</div>
              <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 text-[10px] text-center font-medium">
                {model.name}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setBackground(bg.id)}
              className={`flex-none group relative w-20 aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                (activeBackground === bg.id || (bg.id === 'none' && !activeBackground)) ? 'border-white' : 'border-[#222] text-[#5a5a5a] hover:border-[#333] hover:text-[#aaa]'
              } bg-white/5 flex flex-col items-center justify-center`}
            >
              <div className={`w-10 h-10 rounded overflow-hidden ${
                bg.id === 'blur' ? 'bg-white/10 blur-sm' : 
                bg.id === 'studio' ? 'bg-[radial-gradient(circle,_#a50000_0%,_#050000_100%)]' : 
                bg.id === 'studio-blue' ? 'bg-[#2f5bd4]' : 
                'border border-dashed border-white/20'
              }`}>
                {bg.url && <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />}
              </div>
              <span className="text-[10px] mt-1">{bg.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
