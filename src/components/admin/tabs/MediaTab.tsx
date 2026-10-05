import { useState, useMemo } from 'react'
import { Spin, Empty, Tooltip, Modal, Button, DatePicker, Input } from 'antd'
import {
  PlayCircleOutlined,
  CloseOutlined,
  CheckOutlined,
  PictureOutlined,
  DeleteOutlined,
  CalendarOutlined,
  SearchOutlined,
  ClearOutlined,
  DownloadOutlined,
  LinkOutlined,
  PrinterOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
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
  const [downloading, setDownloading] = useState(false)

  // Date & Search Filter state
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'>('all')
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = useMemo(() => {
    let result = items

    // 1. Search text filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.sessionId && item.sessionId.toLowerCase().includes(q)) ||
          item.fullPath.toLowerCase().includes(q),
      )
    }

    // 2. Date preset filter
    if (datePreset === 'today') {
      const startOfDay = dayjs().startOf('day').valueOf()
      result = result.filter((item) => dayjs(item.timeCreated).valueOf() >= startOfDay)
    } else if (datePreset === 'yesterday') {
      const startOfYesterday = dayjs().subtract(1, 'day').startOf('day').valueOf()
      const endOfYesterday = dayjs().subtract(1, 'day').endOf('day').valueOf()
      result = result.filter((item) => {
        const t = dayjs(item.timeCreated).valueOf()
        return t >= startOfYesterday && t <= endOfYesterday
      })
    } else if (datePreset === '7days') {
      const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').valueOf()
      result = result.filter((item) => dayjs(item.timeCreated).valueOf() >= sevenDaysAgo)
    } else if (datePreset === '30days') {
      const thirtyDaysAgo = dayjs().subtract(30, 'day').startOf('day').valueOf()
      result = result.filter((item) => dayjs(item.timeCreated).valueOf() >= thirtyDaysAgo)
    } else if (datePreset === 'custom' && customRange && customRange[0] && customRange[1]) {
      const start = customRange[0].startOf('day').valueOf()
      const end = customRange[1].endOf('day').valueOf()
      result = result.filter((item) => {
        const t = dayjs(item.timeCreated).valueOf()
        return t >= start && t <= end
      })
    }

    return result
  }, [items, searchQuery, datePreset, customRange])

  const handleDownload = async () => {
    if (!previewItem) return
    setDownloading(true)
    try {
      const res = await fetch(previewItem.url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const ext = previewItem.type === 'video' ? 'mp4' : 'jpg'
      let fileName = previewItem.name || `photobooth-${previewItem.type}-${Date.now()}.${ext}`
      if (!fileName.includes('.')) fileName += `.${ext}`
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(previewItem.url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

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
      {/* Date & Search Filter Toolbar */}
      <div
        className={`sticky top-0 z-20 mb-4 p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md backdrop-blur-md ${tc(
          'bg-[#141414]/95 border-[#222]',
          'bg-white/95 border-slate-200',
        )}`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-semibold mr-1 flex items-center gap-1 ${tc('text-slate-400', 'text-slate-600')}`}>
            <CalendarOutlined /> Thời gian:
          </span>
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'today', label: 'Hôm nay' },
            { key: 'yesterday', label: 'Hôm qua' },
            { key: '7days', label: '7 ngày qua' },
            { key: '30days', label: '30 ngày qua' },
            { key: 'custom', label: 'Tùy chọn' },
          ].map((preset) => {
            const active = datePreset === preset.key
            return (
              <button
                key={preset.key}
                onClick={() => setDatePreset(preset.key as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : tc(
                        'bg-[#1f1f1f] text-slate-300 hover:bg-[#2a2a2a] hover:text-white',
                        'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-black',
                      )
                }`}
              >
                {preset.label}
              </button>
            )
          })}

          {datePreset === 'custom' && (
            <DatePicker.RangePicker
              size="small"
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              value={customRange}
              onChange={(dates) => setCustomRange(dates as any)}
              className="ml-1"
            />
          )}

          {(datePreset !== 'all' || searchQuery.trim() !== '') && (
            <Button
              size="small"
              type="text"
              icon={<ClearOutlined />}
              onClick={() => {
                setDatePreset('all')
                setCustomRange(null)
                setSearchQuery('')
              }}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Đặt lại
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Input
            size="small"
            placeholder="Tìm session ID, tên..."
            prefix={<SearchOutlined className="opacity-50" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="w-full md:w-56"
          />
          <span className={`text-[11px] font-medium shrink-0 ${tc('text-slate-400', 'text-slate-500')}`}>
            {filteredItems.length} / {items.length} {tab === 'photos' ? 'ảnh' : 'video'}
          </span>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Empty
          description={
            <span className={tc('text-slate-500', 'text-slate-400')}>
              Không tìm thấy file nào trong khoảng thời gian đã lọc
            </span>
          }
          className="my-16"
        >
          <Button
            size="small"
            onClick={() => {
              setDatePreset('all')
              setCustomRange(null)
              setSearchQuery('')
            }}
          >
            Bỏ lọc thời gian
          </Button>
        </Empty>
      ) : (
        <div
          className={`grid gap-4 ${
            tab === 'photos'
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
          }`}
        >
          {filteredItems.map((item) => (
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
              <p className={`text-[11px] font-medium truncate ${tc('text-slate-300', 'text-slate-700')}`}>
                {formatDate(item.timeCreated)}
              </p>
              {item.size > 0 && (
                <p className={`text-[10px] mt-0.5 ${tc('text-slate-500', 'text-slate-400')}`}>
                  {formatBytes(item.size)}
                </p>
              )}
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
      )}

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
        <div className={`mt-3 pt-3 border-t flex justify-between items-center flex-wrap gap-2.5 ${tc('border-[#222]', 'border-slate-200')}`}>
          <div className="flex items-center gap-1.5 text-xs">
            <ClockCircleOutlined className={tc('text-slate-500', 'text-slate-400')} />
            <span className={tc('text-slate-300', 'text-slate-600')}>
              {previewItem ? formatDate(previewItem.timeCreated) : ''}
            </span>
            {previewItem && previewItem.size > 0 && (
              <span className={tc('text-slate-500', 'text-slate-400')}>
                · {formatBytes(previewItem.size)}
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {previewItem?.sessionId && (
              <a href={`/session/${previewItem.sessionId}`} target="_blank" rel="noopener noreferrer">
                <Button
                  size="middle"
                  icon={<LinkOutlined />}
                  className="rounded-lg font-medium"
                >
                  Trang Session
                </Button>
              </a>
            )}
            <Button
              size="middle"
              type="primary"
              icon={<DownloadOutlined />}
              loading={downloading}
              onClick={handleDownload}
              className="rounded-lg font-medium shadow-xs"
            >
              Tải xuống
            </Button>
            {previewItem?.type === 'photo' && (
              <Button
                size="middle"
                type="primary"
                icon={<PrinterOutlined />}
                style={{ background: '#10b981', borderColor: '#10b981' }}
                onClick={() => {
                  if (previewItem) onPrint(previewItem)
                }}
                className="rounded-lg font-medium shadow-xs"
              >
                In ảnh
              </Button>
            )}
            {canDelete && (
              <Button
                size="middle"
                danger
                icon={<DeleteOutlined />}
                className="rounded-lg font-medium"
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
