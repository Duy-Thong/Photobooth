import { memo } from 'react'
import { Spin, Tooltip } from 'antd'
import {
  PlayCircleOutlined,
  CloseOutlined,
  CheckOutlined,
  PictureOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { MediaItem } from '@/lib/adminMediaService'
import { formatBytes, formatDate } from '@/utils/format'
import { useThemeClass } from '@/stores/themeStore'

export interface MediaCardProps {
  item: MediaItem
  isSelected: boolean
  isBroken: boolean
  isPrinted: boolean
  isDeleting: boolean
  canDelete: boolean
  hasActiveSelection: boolean
  onToggleSelect: (item: MediaItem) => void
  onPreview: (item: MediaItem) => void
  onPrint?: (item: MediaItem) => void
  onDownload?: (item: MediaItem) => void
  onDelete?: (item: MediaItem) => void
  onBroken?: (item: MediaItem) => void
}

function MediaCardComponent({
  item,
  isSelected,
  isBroken,
  isPrinted,
  isDeleting,
  canDelete,
  hasActiveSelection,
  onToggleSelect,
  onPreview,
  onPrint,
  onDownload,
  onDelete,
  onBroken,
}: MediaCardProps) {
  const tc = useThemeClass()

  const handleCardClick = () => {
    if (hasActiveSelection) {
      onToggleSelect(item)
    } else if (!isBroken) {
      onPreview(item)
    }
  }

  return (
    <div
      className={`group relative rounded-xl overflow-hidden transition-all duration-200 border shadow-xs hover:shadow-md ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : tc(
              'bg-[#141414] border-[#262626] hover:border-[#444]',
              'bg-white border-slate-200 hover:border-slate-300',
            )
      }`}
    >
      {/* Thumbnail */}
      <div className="relative cursor-pointer" onClick={handleCardClick}>
        {item.type === 'photo' ? (
          isBroken ? (
            <div
              className={`w-full aspect-3/4 flex flex-col items-center justify-center gap-2 ${tc(
                'bg-[#0a0a0a] text-slate-600',
                'bg-slate-100 text-slate-400',
              )}`}
            >
              <CloseOutlined style={{ fontSize: 24 }} />
              <span className="text-[10px] uppercase font-semibold">File missing</span>
            </div>
          ) : (
            <img
              src={item.url}
              alt={item.name}
              className="w-full aspect-3/4 object-cover"
              loading="lazy"
              onError={() => onBroken?.(item)}
            />
          )
        ) : (
          <div className="w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
            {isBroken ? (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                <CloseOutlined style={{ fontSize: 24 }} />
                <span className="text-[10px] uppercase font-semibold">Video missing</span>
              </div>
            ) : (
              <>
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  onError={() => onBroken?.(item)}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <PlayCircleOutlined className="text-white text-4xl opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Checkbox indicator */}
        <div
          className={`absolute top-2 left-2 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-blue-600 border-blue-600 text-white opacity-100'
              : 'bg-black/40 border-white/50 opacity-0 group-hover:opacity-100 text-white'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(item)
          }}
        >
          {isSelected && <CheckOutlined className="text-[10px]" />}
        </div>

        {/* Printed badge */}
        {isPrinted && (
          <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-xs">
            Đã in
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className={`text-[11px] font-medium truncate ${tc('text-slate-300', 'text-slate-700')}`}>
          {formatDate(item.timeCreated)}
        </p>
        {item.size > 0 && (
          <p className={`text-[10px] mt-0.5 ${tc('text-slate-500', 'text-slate-400')}`}>
            {formatBytes(item.size)}
          </p>
        )}
      </div>

      {/* Hover action buttons */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
        {item.type === 'photo' && onPrint && (
          <Tooltip title="In ảnh">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPrint(item)
              }}
              className="bg-black/70 hover:bg-emerald-600 text-white rounded-lg p-1.5 transition-colors cursor-pointer"
            >
              <PictureOutlined />
            </button>
          </Tooltip>
        )}

        {onDownload && (
          <Tooltip title={item.type === 'photo' ? 'Tải ảnh' : 'Tải video'}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload(item)
              }}
              className="bg-black/70 hover:bg-blue-600 text-white rounded-lg p-1.5 transition-colors cursor-pointer"
            >
              <DownloadOutlined />
            </button>
          </Tooltip>
        )}

        {canDelete && onDelete && (
          <Tooltip title="Xóa">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item)
              }}
              disabled={isDeleting}
              className="bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5 transition-colors cursor-pointer"
            >
              {isDeleting ? <Spin size="small" /> : <DeleteOutlined />}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export const MediaCard = memo(MediaCardComponent)
