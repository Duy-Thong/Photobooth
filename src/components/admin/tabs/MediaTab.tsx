import { useState, useMemo, useEffect, useCallback } from 'react'
import { Spin, Empty, Modal, Button, DatePicker, Input, Tooltip, message } from 'antd'
import {
  CalendarOutlined,
  SearchOutlined,
  ClearOutlined,
  DownloadOutlined,
  DeleteFilled,
  LinkOutlined,
  PrinterOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { deleteSession, markSessionPrinted } from '@/lib/sessionService'
import type { MediaItem } from '@/lib/adminMediaService'
import { formatBytes, formatDate, deleteStorageFile, deleteStorageFiles } from '@/utils'
import { useThemeClass } from '@/stores/themeStore'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { downloadSingleMedia, downloadMultipleMedia } from '@/lib/downloadService'
import { printSingleImage, printMultipleImages } from '@/lib/printService'
import { MediaCard } from '@/components/admin/MediaCard'
import { BulkActionBar } from '@/components/admin/BulkActionBar'

export interface MediaTabProps {
  tab: 'photos' | 'videos'
  items: MediaItem[]
  loading: boolean
  canDelete: boolean
  initialPrintedPaths?: Set<string>
  onItemDeleted?: (item: MediaItem) => void
  onItemsDeleted?: (items: MediaItem[]) => void
}

export default function MediaTab({
  tab,
  items,
  loading,
  canDelete,
  initialPrintedPaths = new Set(),
  onItemDeleted,
  onItemsDeleted,
}: MediaTabProps) {
  const tc = useThemeClass()

  // Selection Hook
  const selection = useBulkSelection<string>()

  // Clear selection on tab change
  useEffect(() => {
    selection.clear()
  }, [tab, selection.clear])

  // Local media state
  const [brokenPaths, setBrokenPaths] = useState<Set<string>>(new Set())
  const [printedPaths, setPrintedPaths] = useState<Set<string>>(initialPrintedPaths)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [previewDownloading, setPreviewDownloading] = useState(false)

  // Keep printed paths in sync with parent prop
  useEffect(() => {
    setPrintedPaths((prev) => new Set([...prev, ...initialPrintedPaths]))
  }, [initialPrintedPaths])

  // Filters state
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'>('all')
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Filtered items memo
  const filteredItems = useMemo(() => {
    let result = items

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.sessionId && item.sessionId.toLowerCase().includes(q)) ||
          item.fullPath.toLowerCase().includes(q),
      )
    }

    // Date preset
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

  const resetFilters = () => {
    setDatePreset('all')
    setCustomRange(null)
    setSearchQuery('')
  }

  // Filtered paths for quick select
  const filteredPaths = useMemo(() => filteredItems.map((i) => i.fullPath), [filteredItems])
  const areAllFilteredSelected = useMemo(
    () => filteredPaths.length > 0 && filteredPaths.every((p) => selection.isSelected(p)),
    [filteredPaths, selection],
  )

  // 2. Print Actions
  const handlePrintSingle = useCallback((item: MediaItem) => {
    printSingleImage(item.url, () => {
      setPrintedPaths((prev) => new Set(prev).add(item.fullPath))
      if (item.sessionId) {
        markSessionPrinted(item.sessionId).catch(() => {})
      }
    })
  }, [])

  const handlePrintSelected = useCallback(() => {
    const toPrint = items.filter((i) => selection.isSelected(i.fullPath))
    if (toPrint.length === 0) return

    const executePrint = () => {
      printMultipleImages(
        toPrint.map((i) => i.url),
        () => {
          setPrintedPaths((prev) => {
            const next = new Set(prev)
            toPrint.forEach((it) => next.add(it.fullPath))
            return next
          })
          toPrint.forEach((it) => {
            if (it.sessionId) markSessionPrinted(it.sessionId).catch(() => {})
          })
        },
      )
    }

    if (toPrint.length > 5) {
      Modal.confirm({
        title: `In ${toPrint.length} ảnh?`,
        content: `Sẽ in ${toPrint.length} ảnh, mỗi ảnh trên 1 trang 4x6in. Tiếp tục?`,
        onOk: executePrint,
        centered: true,
      })
    } else {
      executePrint()
    }
  }, [items, selection])

  // 3. Download Actions
  const handleDownloadSingle = useCallback(async (item: MediaItem) => {
    await downloadSingleMedia(item)
  }, [])

  const executeBulkDownload = useCallback(
    async (itemsToDownload: MediaItem[], zipName: string) => {
      if (itemsToDownload.length === 0) return
      setBulkDownloading(true)
      const msgKey = 'bulk-download'
      message.loading({
        content: `Đang chuẩn bị tải ${itemsToDownload.length} file...`,
        key: msgKey,
        duration: 0,
      })

      try {
        const { successCount, failCount } = await downloadMultipleMedia(itemsToDownload, {
          zipFilename: zipName,
          onProgress: (progress) => {
            if (progress.status === 'compressing') {
              message.loading({
                content: `Đang nén ${itemsToDownload.length} file thành ZIP (${progress.percentage}%)...`,
                key: msgKey,
                duration: 0,
              })
            } else if (progress.status === 'fetching') {
              message.loading({
                content: `Đang tải ${progress.current}/${progress.total} file (${progress.percentage}%)...`,
                key: msgKey,
                duration: 0,
              })
            }
          },
        })

        if (failCount > 0) {
          message.warning({
            content: `Đã tải ${successCount}/${itemsToDownload.length} file (thất bại ${failCount} file).`,
            key: msgKey,
            duration: 4,
          })
        } else {
          message.success({
            content: `Đã tải về thành công ${successCount} ${tab === 'photos' ? 'ảnh' : 'video'}!`,
            key: msgKey,
            duration: 3,
          })
        }
      } catch (err: any) {
        message.error({
          content: err?.message || 'Có lỗi xảy ra khi tải file.',
          key: msgKey,
          duration: 4,
        })
      } finally {
        setBulkDownloading(false)
      }
    },
    [tab],
  )

  const handleDownloadSelected = useCallback(() => {
    const toDownload = items.filter((i) => selection.isSelected(i.fullPath))
    if (toDownload.length === 0) return
    const zipName = `photobooth-${tab}-${dayjs().format('YYYYMMDD-HHmmss')}.zip`
    executeBulkDownload(toDownload, zipName)
  }, [items, selection, tab, executeBulkDownload])

  const handleDownloadAll = useCallback(() => {
    if (items.length === 0) return
    const zipName = `photobooth-all-${tab}-${dayjs().format('YYYYMMDD-HHmmss')}.zip`

    if (items.length > 5) {
      Modal.confirm({
        title: `Tải tất cả ${items.length} ${tab === 'photos' ? 'ảnh' : 'video'}?`,
        content: `Hệ thống sẽ tải toàn bộ ${items.length} file và nén thành 1 file ZIP để tải về máy. Tiếp tục?`,
        okText: 'Tải về (ZIP)',
        cancelText: 'Hủy',
        centered: true,
        onOk: () => executeBulkDownload(items, zipName),
      })
    } else {
      executeBulkDownload(items, zipName)
    }
  }, [items, tab, executeBulkDownload])

  // 4. Delete Actions
  const handleDeleteSingle = useCallback(
    (item: MediaItem) => {
      Modal.confirm({
        title: 'Xóa file này?',
        content: item.name,
        okText: 'Xóa',
        okButtonProps: { danger: true },
        cancelText: 'Hủy',
        centered: true,
        onOk: async () => {
          setDeletingPath(item.fullPath)
          try {
            await deleteStorageFile(item.fullPath)
            if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
            selection.deselect(item.fullPath)
            onItemDeleted?.(item)
          } finally {
            setDeletingPath(null)
          }
        },
      })
    },
    [selection, onItemDeleted],
  )

  const handleDeleteSelected = useCallback(() => {
    const toDelete = items.filter((i) => selection.isSelected(i.fullPath))
    if (toDelete.length === 0) return

    Modal.confirm({
      title: `Xóa ${toDelete.length} file đã chọn?`,
      content: 'Hành động này không thể hoàn tác.',
      okText: `Xóa ${toDelete.length} file`,
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await deleteStorageFiles(toDelete.map((i) => i.fullPath))
          await Promise.allSettled(
            toDelete.filter((i) => i.sessionId).map((i) => deleteSession(i.sessionId!)),
          )
          selection.clear()
          onItemsDeleted?.(toDelete)
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }, [items, selection, onItemsDeleted])

  const handleDeleteAll = useCallback(() => {
    if (items.length === 0) return

    Modal.confirm({
      title: 'Xóa tất cả?',
      content: `Sẽ xóa ${items.length} file trong tab "${tab === 'photos' ? 'Ảnh' : 'Video'}". Hành động này không thể hoàn tác.`,
      okText: 'Xóa tất cả',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await deleteStorageFiles(items.map((i) => i.fullPath))
          await Promise.allSettled(
            items.filter((i) => i.sessionId).map((i) => deleteSession(i.sessionId!)),
          )
          selection.clear()
          onItemsDeleted?.(items)
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }, [items, tab, selection, onItemsDeleted])

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
        {/* Preset Date Filters */}
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
              onClick={resetFilters}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Đặt lại
            </Button>
          )}
        </div>

        {/* Search, Filter count & Global Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            size="small"
            placeholder="Tìm session ID, tên..."
            prefix={<SearchOutlined className="opacity-50" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="w-full md:w-52"
          />

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-medium ${tc('text-slate-400', 'text-slate-500')}`}>
              {filteredItems.length} / {items.length} {tab === 'photos' ? 'ảnh' : 'video'}
            </span>

            {filteredItems.length > 0 && (
              <Button
                size="small"
                type="dashed"
                onClick={() => {
                  if (areAllFilteredSelected) {
                    selection.deselect(filteredPaths)
                  } else {
                    selection.select(filteredPaths)
                  }
                }}
                className="text-xs h-6 px-2"
              >
                {areAllFilteredSelected ? 'Bỏ chọn lọc' : `Chọn ${filteredItems.length}`}
              </Button>
            )}

            <Tooltip title={`Tải tất cả ${items.length} file (ZIP)`}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownloadAll}
                loading={bulkDownloading}
              >
                <span className="hidden sm:inline">Tải tất cả</span>
              </Button>
            </Tooltip>

            {canDelete && (
              <Tooltip title="Xóa tất cả file trong tab hiện tại">
                <Button
                  size="small"
                  danger
                  icon={<DeleteFilled />}
                  onClick={handleDeleteAll}
                  loading={bulkDeleting}
                >
                  <span className="hidden sm:inline">Xóa tất cả</span>
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar (when items are selected) */}
      {selection.selectedCount > 0 && (
        <div className="sticky top-16 z-20 mb-4">
          <BulkActionBar
            selectedCount={selection.selectedCount}
            itemType={tab}
            canDelete={canDelete}
            isDownloading={bulkDownloading}
            isDeleting={bulkDeleting}
            onPrint={tab === 'photos' ? handlePrintSelected : undefined}
            onDownload={handleDownloadSelected}
            onDelete={canDelete ? handleDeleteSelected : undefined}
            onClear={selection.clear}
          />
        </div>
      )}

      {/* Media Grid or Empty State */}
      {filteredItems.length === 0 ? (
        <Empty
          description={
            <span className={tc('text-slate-500', 'text-slate-400')}>
              Không tìm thấy file nào trong khoảng thời gian đã lọc
            </span>
          }
          className="my-16"
        >
          <Button size="small" onClick={resetFilters}>
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
            <MediaCard
              key={item.fullPath}
              item={item}
              isSelected={selection.isSelected(item.fullPath)}
              isBroken={brokenPaths.has(item.fullPath)}
              isPrinted={printedPaths.has(item.fullPath)}
              isDeleting={deletingPath === item.fullPath}
              canDelete={canDelete}
              hasActiveSelection={selection.selectedCount > 0}
              onToggleSelect={(it) => selection.toggle(it.fullPath)}
              onPreview={setPreviewItem}
              onPrint={tab === 'photos' ? handlePrintSingle : undefined}
              onDownload={handleDownloadSingle}
              onDelete={canDelete ? handleDeleteSingle : undefined}
              onBroken={(it) => setBrokenPaths((prev) => new Set(prev).add(it.fullPath))}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
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
                <Button size="middle" icon={<LinkOutlined />} className="rounded-lg font-medium">
                  Trang Session
                </Button>
              </a>
            )}

            <Button
              size="middle"
              type="primary"
              icon={<DownloadOutlined />}
              loading={previewDownloading}
              onClick={async () => {
                if (!previewItem) return
                setPreviewDownloading(true)
                try {
                  await handleDownloadSingle(previewItem)
                } finally {
                  setPreviewDownloading(false)
                }
              }}
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
                  if (previewItem) handlePrintSingle(previewItem)
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
                    handleDeleteSingle(previewItem)
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
