import { useState } from 'react'
import { Spin, Empty, Tooltip, Modal, Button } from 'antd'
import {
  PlayCircleOutlined,
  CloseOutlined,
  CheckOutlined,
  PictureOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { MediaItem } from '@/lib/adminMediaService'
import { formatBytes, formatDate } from '@/lib/adminUtils'
import { useThemeClass } from '@/stores/themeStore'

interface MediaTabProps {
  tab: 'photos' | 'videos'
  items: MediaItem[]
  loading: boolean
  selectedPaths: Set<string>
  brokenPaths: Set<string>
  printedPaths: Set<string>
  deletingPath: string | null
  canDelete: boolean
  onToggleSelect: (path: string) => void
  onDelete: (item: MediaItem) => void
  onPrint: (item: MediaItem) => void
  onBrokenPath: (path: string) => void
}

export default function MediaTab({
  tab,
  items,
  loading,
  selectedPaths,
  brokenPaths,
  printedPaths,
  deletingPath,
  canDelete,
  onToggleSelect,
  onDelete,
  onPrint,
  onBrokenPath,
}: MediaTabProps) {
  const tc = useThemeClass()
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Empty
        description={<span className={tc('text-slate-500', 'text-slate-400')}>Chưa có dữ liệu</span>}
        className="mt-20"
      />
    )
  }

  return (
    <>
      <div
        className={`grid gap-4 ${
          tab === 'photos'
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
        }`}
      >
        {items.map((item) => (
          <div
            key={item.fullPath}
            className={`group relative rounded-xl overflow-hidden transition-all duration-200 border shadow-xs hover:shadow-md ${
              selectedPaths.has(item.fullPath)
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : tc(
                    'bg-[#141414] border-[#262626] hover:border-[#444]',
                    'bg-white border-slate-200 hover:border-slate-300',
                  )
            }`}
          >
            {/* Thumbnail */}
            <div
              className="relative cursor-pointer"
              onClick={() => {
                if (selectedPaths.size > 0) onToggleSelect(item.fullPath)
                else if (!brokenPaths.has(item.fullPath)) setPreviewItem(item)
              }}
            >
              {item.type === 'photo' ? (
                brokenPaths.has(item.fullPath) ? (
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
                    onError={() => onBrokenPath(item.fullPath)}
                  />
                )
              ) : (
                <div className="w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {brokenPaths.has(item.fullPath) ? (
                    <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                      <CloseOutlined style={{ fontSize: 24 }} />
                      <span className="text-[10px] uppercase font-semibold">Video missing</span>
                    </div>
                  ) : (
                    <>
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        onError={() => onBrokenPath(item.fullPath)}
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
                  selectedPaths.has(item.fullPath)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-black/40 border-white/50 opacity-0 group-hover:opacity-100 text-white'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect(item.fullPath)
                }}
              >
                {selectedPaths.has(item.fullPath) && <CheckOutlined className="text-[10px]" />}
              </div>

              {/* Printed badge */}
              {printedPaths.has(item.fullPath) && (
                <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-xs">
                  Đã in
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2.5">
              <p className={`text-[11px] truncate ${tc('text-slate-400', 'text-slate-500')}`}>
                {formatDate(item.timeCreated)}
              </p>
              <p className={`text-[11px] font-medium ${tc('text-white', 'text-slate-800')}`}>
                {formatBytes(item.size)}
              </p>
            </div>

            {/* Actions btn */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
              {item.type === 'photo' && (
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

              {canDelete && (
                <Tooltip title="Xóa">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item)
                    }}
                    disabled={deletingPath === item.fullPath}
                    className="bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5 transition-colors cursor-pointer"
                  >
                    {deletingPath === item.fullPath ? <Spin size="small" /> : <DeleteOutlined />}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      <Modal
        open={!!previewItem}
        onCancel={() => setPreviewItem(null)}
        footer={null}
        centered
        width="min(90vw, 700px)"
        title={<span className="font-medium text-sm truncate">{previewItem?.name}</span>}
      >
        {previewItem?.type === 'photo' ? (
          <img
            src={previewItem.url}
            alt={previewItem.name}
            className="w-full rounded-lg"
            style={{ maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
          />
        ) : previewItem?.type === 'video' ? (
          <video src={previewItem.url} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: '75vh' }} />
        ) : null}
        <div className="pt-3 flex justify-between items-center flex-wrap gap-2">
          <span className={`text-xs ${tc('text-slate-400', 'text-slate-500')}`}>
            {previewItem ? formatDate(previewItem.timeCreated) : ''} ·{' '}
            {previewItem ? formatBytes(previewItem.size) : ''}
          </span>
          <div className="flex gap-2 items-center flex-wrap">
            {previewItem?.sessionId && (
              <a href={`/session/${previewItem.sessionId}`} target="_blank" rel="noopener noreferrer">
                <Button type="link" size="small">
                  Trang Session ↗
                </Button>
              </a>
            )}
            <Button
              size="small"
              onClick={async () => {
                if (!previewItem) return
                const res = await fetch(previewItem.url)
                const blob = await res.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = previewItem.name || 'photo'
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              Tải ảnh ↓
            </Button>
            {previewItem?.type === 'photo' && (
              <Button
                size="small"
                type="primary"
                style={{ background: '#10b981', borderColor: '#10b981' }}
                onClick={() => {
                  if (previewItem) onPrint(previewItem)
                }}
                icon={<PictureOutlined />}
              >
                In ảnh
              </Button>
            )}
            {canDelete && (
              <Button
                size="small"
                danger
                onClick={() => {
                  if (previewItem) {
                    onDelete(previewItem)
                    setPreviewItem(null)
                  }
                }}
              >
                Xóa
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
