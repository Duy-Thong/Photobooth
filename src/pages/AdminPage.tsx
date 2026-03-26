import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ref, listAll, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import {
  fetchCustomFrames as fetchCustomFramesService,
  uploadFrame as uploadFrameService,
  deleteCustomFrame as deleteCustomFrameService,
  frameImageUrl,
  type FrameItem,
} from '@/lib/frameService'
import { detectFrameSlots } from '@/lib/imageProcessing'
import { Button, Input, Modal, Select, Spin, Empty, Tooltip } from 'antd'
import { DeleteOutlined, ReloadOutlined, LogoutOutlined, PlayCircleOutlined, DeleteFilled, ClockCircleOutlined, UploadOutlined, PictureOutlined } from '@ant-design/icons'

interface MediaItem {
  name: string
  fullPath: string
  url: string
  timeCreated: string
  size: number
  type: 'photo' | 'video'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminPage() {
  const { logout, user } = useAdminAuth()
  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [tab, setTab] = useState<'photos' | 'videos' | 'frames'>('photos')

  // ── Frames tab state ────────────────────────────────────────────────────────
  const [customFrames, setCustomFrames] = useState<FrameItem[]>([])
  const [framesLoading, setFramesLoading] = useState(false)
  const [deletingFrameId, setDeletingFrameId] = useState<string | null>(null)
  const [frameSearch, setFrameSearch] = useState('')
  const [frameSlotFilter, setFrameSlotFilter] = useState<number | null>(null)
  const [frameCategoryFilter, setFrameCategoryFilter] = useState<string | null>(null)

  const frameSlotOptions = useMemo(() =>
    [...new Set(customFrames.map(f => f.slots))].sort((a, b) => a - b)
  , [customFrames])

  const frameCategoryOptions = useMemo(() => {
    const base = frameSlotFilter !== null ? customFrames.filter(f => f.slots === frameSlotFilter) : customFrames
    return [...new Set(base.map(f => f.categoryName))].sort((a, b) => a.localeCompare(b, 'vi'))
  }, [customFrames, frameSlotFilter])

  const filteredFrames = useMemo(() => {
    let list = customFrames
    if (frameSlotFilter !== null) list = list.filter(f => f.slots === frameSlotFilter)
    if (frameCategoryFilter !== null) list = list.filter(f => f.categoryName === frameCategoryFilter)
    if (frameSearch.trim()) {
      const q = frameSearch.toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q) || f.categoryName.toLowerCase().includes(q))
    }
    return list
  }, [customFrames, frameSlotFilter, frameCategoryFilter, frameSearch])

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [detectingSlots, setDetectingSlots] = useState(false)
  const [uploadSlots, setUploadSlots] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadFrameType, setUploadFrameType] = useState<FrameItem['frame']>('square')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [photoList, videoList] = await Promise.all([
        listAll(ref(storage, 'photobooth')),
        listAll(ref(storage, 'recap')),
      ])

      const toItems = async (refs: typeof photoList.items, type: 'photo' | 'video'): Promise<MediaItem[]> => {
        const settled = await Promise.allSettled(
          refs.map(async (r) => {
            const [url, meta] = await Promise.all([getDownloadURL(r), getMetadata(r)])
            return {
              name: r.name,
              fullPath: r.fullPath,
              url,
              timeCreated: meta.timeCreated,
              size: meta.size,
              type,
            } satisfies MediaItem
          }),
        )
        return (settled.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<MediaItem>[])
          .map(r => r.value)
          .sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())
      }

      const [p, v] = await Promise.all([toItems(photoList.items, 'photo'), toItems(videoList.items, 'video')])
      setPhotos(p)
      setVideos(v)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const loadCustomFrames = useCallback(async () => {
    setFramesLoading(true)
    try {
      const frames = await fetchCustomFramesService()
      setCustomFrames(frames)
    } finally {
      setFramesLoading(false)
    }
  }, [])

  useEffect(() => { loadCustomFrames() }, [loadCustomFrames])

  const handleDelete = async (item: MediaItem) => {
    Modal.confirm({
      title: 'Xóa file này?',
      content: item.name,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      styles: {
        body: { background: '#1a1a1a', color: '#e5e5e5' },
        header: { background: '#1a1a1a' },
        footer: { background: '#1a1a1a' },
        mask: { backdropFilter: 'blur(4px)' },
      },
      onOk: async () => {
        setDeletingPath(item.fullPath)
        try {
          await deleteObject(ref(storage, item.fullPath))
          if (item.type === 'photo') setPhotos(ps => ps.filter(p => p.fullPath !== item.fullPath))
          else setVideos(vs => vs.filter(v => v.fullPath !== item.fullPath))
        } finally {
          setDeletingPath(null)
        }
      },
    })
  }

  const handleDeleteAll = () => {
    const list = tab === 'photos' ? photos : videos
    if (list.length === 0) return
    Modal.confirm({
      title: 'Xóa tất cả?',
      content: `Sẽ xóa ${list.length} file trong tab "${tab === 'photos' ? 'Ảnh' : 'Video'}". Hành động này không thể hoàn tác.`,
      okText: 'Xóa tất cả',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      styles: {
        body: { background: '#1a1a1a', color: '#e5e5e5' },
        header: { background: '#1a1a1a' },
        footer: { background: '#1a1a1a' },
        mask: { backdropFilter: 'blur(4px)' },
      },
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await Promise.allSettled(list.map(item => deleteObject(ref(storage, item.fullPath))))
          if (tab === 'photos') setPhotos([])
          else setVideos([])
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  const handleDeleteOlderThan7Days = () => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const allItems = [...photos, ...videos]
    const old = allItems.filter(item => new Date(item.timeCreated).getTime() < cutoff)
    if (old.length === 0) {
      Modal.info({
        title: 'Không có dữ liệu cũ',
        content: 'Tất cả file đều trong vòng 7 ngày gần nhất.',
        centered: true,
        okText: 'Đóng',
        styles: {
          body: { background: '#1a1a1a', color: '#e5e5e5' },
          header: { background: '#1a1a1a' },
          footer: { background: '#1a1a1a' },
        },
      })
      return
    }
    Modal.confirm({
      title: 'Xóa dữ liệu cũ hơn 7 ngày?',
      content: `Tìm thấy ${old.length} file (${old.filter(i => i.type === 'photo').length} ảnh, ${old.filter(i => i.type === 'video').length} video). Hành động này không thể hoàn tác.`,
      okText: `Xóa ${old.length} file`,
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      styles: {
        body: { background: '#1a1a1a', color: '#e5e5e5' },
        header: { background: '#1a1a1a' },
        footer: { background: '#1a1a1a' },
        mask: { backdropFilter: 'blur(4px)' },
      },
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await Promise.allSettled(old.map(item => deleteObject(ref(storage, item.fullPath))))
          const oldPaths = new Set(old.map(i => i.fullPath))
          setPhotos(ps => ps.filter(p => !oldPaths.has(p.fullPath)))
          setVideos(vs => vs.filter(v => !oldPaths.has(v.fullPath)))
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  // ── Frame upload / delete handlers ─────────────────────────────────────────

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes('png') && !file.name.endsWith('.png')) {
      Modal.error({ title: 'Chỉ hỗ trợ file PNG', centered: true })
      return
    }
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    const url = URL.createObjectURL(file)
    setUploadFile(file)
    setUploadPreviewUrl(url)
    setDetectingSlots(true)
    try {
      const slots = await detectFrameSlots(url)
      const count = slots.length
      setUploadSlots(count)
      setUploadFrameType(count === 6 ? 'bigrectangle' : count === 4 ? 'square' : 'grid')
    } finally {
      setDetectingSlots(false)
    }
  }

  const handleCloseUploadModal = () => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    setShowUploadModal(false)
    setUploadFile(null)
    setUploadPreviewUrl(null)
    setUploadSlots(0)
    setUploadName('')
    setUploadCategory('')
    setUploadFrameType('square')
  }

  const handleUploadFrame = async () => {
    if (!uploadFile || !uploadName.trim() || !uploadCategory.trim()) return
    setUploading(true)
    try {
      const frame = await uploadFrameService(uploadFile, {
        name: uploadName.trim(),
        categoryName: uploadCategory.trim(),
        slots: uploadSlots,
        frame: uploadFrameType,
      })
      setCustomFrames(prev => [...prev, frame].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      handleCloseUploadModal()
    } catch {
      Modal.error({ title: 'Upload thất bại', content: 'Kiểm tra kết nối và quyền Firebase.', centered: true })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFrame = (frame: FrameItem) => {
    if (!frame.firestoreId) return
    Modal.confirm({
      title: 'Xóa khung này?',
      content: frame.name,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      styles: {
        body: { background: '#1a1a1a', color: '#e5e5e5' },
        header: { background: '#1a1a1a' },
        footer: { background: '#1a1a1a' },
        mask: { backdropFilter: 'blur(4px)' },
      },
      onOk: async () => {
        setDeletingFrameId(frame.firestoreId!)
        try {
          await deleteCustomFrameService(frame.firestoreId!, frame.filename)
          setCustomFrames(prev => prev.filter(f => f.firestoreId !== frame.firestoreId))
        } finally {
          setDeletingFrameId(null)
        }
      },
    })
  }

  const items = tab === 'photos' ? photos : videos

  return (
    <div className="min-h-dvh bg-[#111] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1f1f1f] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg" style={{ letterSpacing: '-0.02em' }}>Sổ Media</h1>
          <p className="text-[#555] text-[10px] uppercase tracking-widest">Admin Panel</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#555] text-xs hidden sm:block">{user?.email}</span>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchAll} disabled={bulkDeleting}
            style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
            Tải lại
          </Button>
          <Tooltip title="Xóa dữ liệu cũ hơn 7 ngày (cả ảnh & video)">
            <Button size="small" icon={<ClockCircleOutlined />} onClick={handleDeleteOlderThan7Days}
              loading={bulkDeleting}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#e67e22' }}>
              <span className="hidden sm:inline">Cũ &gt; 7 ngày</span>
            </Button>
          </Tooltip>
          <Tooltip title="Xóa tất cả trong tab hiện tại">
            <Button size="small" icon={<DeleteFilled />} onClick={handleDeleteAll}
              loading={bulkDeleting} danger
              style={{ background: '#1e1e1e', border: '1px solid #3a1a1a' }}>
              <span className="hidden sm:inline">Xóa tất cả</span>
            </Button>
          </Tooltip>
          <Button size="small" icon={<LogoutOutlined />} onClick={logout}
            style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
            Đăng xuất
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[#1f1f1f] px-6">
        {(['photos', 'videos', 'frames'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-white text-white'
                : 'border-transparent text-[#555] hover:text-[#aaa]'
            }`}
          >
            {t === 'photos' ? `Ảnh (${photos.length})` : t === 'videos' ? `Video (${videos.length})` : `Khung (${customFrames.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'frames' ? (
        <div className="flex-1 p-6">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              icon={<UploadOutlined />}
              onClick={() => setShowUploadModal(true)}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
            >
              Tải Khung Lên
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadCustomFrames}
              loading={framesLoading}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}
            >
              Tải lại
            </Button>
            <div className="flex-1" />
            <Input.Search
              placeholder="Tìm tên khung..."
              value={frameSearch}
              onChange={e => setFrameSearch(e.target.value)}
              onSearch={() => {}}
              allowClear
              size="small"
              style={{ maxWidth: 200 }}
            />
          </div>

          {/* Slot filter pills */}
          {frameSlotOptions.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[10px] text-[#444] font-semibold uppercase tracking-[0.15em] shrink-0">Số slot:</span>
              {[null, ...frameSlotOptions].map(n => (
                <button
                  key={n ?? 'all'}
                  onClick={() => { setFrameSlotFilter(n); setFrameCategoryFilter(null) }}
                  className={`text-[11px] px-2.5 py-0.5 rounded-md border transition-all duration-150 ${
                    frameSlotFilter === n
                      ? 'bg-white text-black border-white font-semibold'
                      : 'border-[#252525] text-[#5a5a5a] hover:border-[#3a3a3a] hover:text-[#bbb]'
                  }`}
                >
                  {n === null ? 'Tất cả' : `${n} slot`}
                </button>
              ))}
            </div>
          )}

          {/* Category filter pills */}
          {frameCategoryOptions.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-[10px] text-[#444] font-semibold uppercase tracking-[0.15em] shrink-0">Danh mục:</span>
              {[null, ...frameCategoryOptions].map(cat => (
                <button
                  key={cat ?? 'all'}
                  onClick={() => setFrameCategoryFilter(cat)}
                  className={`text-[11px] px-3 py-0.5 rounded-md border transition-all duration-150 ${
                    frameCategoryFilter === cat
                      ? 'bg-white text-black border-white font-semibold'
                      : 'border-[#252525] text-[#5a5a5a] hover:border-[#3a3a3a] hover:text-[#bbb]'
                  }`}
                >
                  {cat === null ? 'Tất cả' : cat}
                </button>
              ))}
            </div>
          )}

          {framesLoading ? (
            <div className="flex justify-center items-center h-64"><Spin size="large" /></div>
          ) : filteredFrames.length === 0 ? (
            <Empty
              image={<PictureOutlined style={{ fontSize: 48, color: '#333' }} />}
              description={<span className="text-[#555]">{customFrames.length === 0 ? 'Chưa có khung nào được upload' : 'Không tìm thấy khung phù hợp'}</span>}
              className="mt-20"
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredFrames.map(frame => (
                <div
                  key={frame.firestoreId}
                  className="group relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#444] transition-colors"
                >
                  <div className="p-1 bg-[#111] flex items-center justify-center aspect-3/4">
                    <img
                      src={frameImageUrl(frame.filename, frame.storageUrl)}
                      alt={frame.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-white text-xs font-medium truncate">{frame.name}</p>
                    <p className="text-[#555] text-[10px] truncate">{frame.categoryName}</p>
                    <p className="text-[#3a3a3a] text-[10px]">{frame.slots} slot · {frame.frame}</p>
                  </div>
                  <Tooltip title="Xóa khung">
                    <button
                      onClick={() => handleDeleteFrame(frame)}
                      disabled={deletingFrameId === frame.firestoreId}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5"
                    >
                      {deletingFrameId === frame.firestoreId ? <Spin size="small" /> : <DeleteOutlined />}
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <Empty description={<span className="text-[#555]">Chưa có dữ liệu</span>} className="mt-20" />
        ) : (
          <div className={`grid gap-4 ${tab === 'photos' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
            {items.map(item => (
              <div
                key={item.fullPath}
                className="group relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#444] transition-colors"
              >
                {/* Thumbnail */}
                <div
                  className="relative cursor-pointer"
                  onClick={() => setPreviewItem(item)}
                >
                  {item.type === 'photo' ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full aspect-3/4 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-black flex items-center justify-center">
                      <video src={item.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <PlayCircleOutlined className="text-white text-4xl" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[#666] text-[10px] truncate">{formatDate(item.timeCreated)}</p>
                  <p className="text-[#444] text-[10px]">{formatBytes(item.size)}</p>
                </div>

                {/* Delete btn */}
                <Tooltip title="Xóa">
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingPath === item.fullPath}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5"
                  >
                    {deletingPath === item.fullPath
                      ? <Spin size="small" />
                      : <DeleteOutlined />}
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Frame upload modal */}
      <Modal
        open={showUploadModal}
        onCancel={handleCloseUploadModal}
        title={<span className="text-[#aaa] text-sm font-medium">Tải Khung Lên</span>}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={handleCloseUploadModal} style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
              Hủy
            </Button>
            <Button
              type="primary"
              onClick={handleUploadFrame}
              loading={uploading}
              disabled={!uploadFile || !uploadName.trim() || !uploadCategory.trim() || detectingSlots}
            >
              Tải Lên
            </Button>
          </div>
        }
        centered
        width={460}
        styles={{
          body: { background: '#1a1a1a', color: '#e5e5e5' },
          header: { background: '#1a1a1a' },
          footer: { background: '#1a1a1a' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div className="flex flex-col gap-4 py-2">
          {/* File drop zone */}
          <div
            className="border-2 border-dashed border-[#2a2a2a] rounded-xl overflow-hidden cursor-pointer hover:border-[#444] transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFileSelect(file)
            }}
          >
            {uploadPreviewUrl ? (
              <div className="relative flex items-center justify-center bg-[#111] p-2" style={{ minHeight: 160 }}>
                <img src={uploadPreviewUrl} alt="preview" className="max-h-40 object-contain rounded" />
                {detectingSlots && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Spin size="small" />
                    <span className="text-white text-xs">Đang phát hiện slot...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-[#3a3a3a]">
                <PictureOutlined style={{ fontSize: 36 }} />
                <span className="text-xs">Kéo thả hoặc click để chọn file PNG</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
          />

          {/* Detected slots info */}
          {uploadFile && !detectingSlots && (
            <div className="flex items-center gap-3">
              <span className="text-[#555] text-xs">Slot phát hiện:</span>
              <span className="text-white text-xs font-bold">{uploadSlots}</span>
              <span className="text-[#555] text-xs">·</span>
              <Select
                size="small"
                value={uploadSlots}
                onChange={v => {
                  setUploadSlots(v)
                  setUploadFrameType(v === 6 ? 'bigrectangle' : v === 4 ? 'square' : 'grid')
                }}
                options={[1,2,3,4,5,6,8,9].map(n => ({ value: n, label: `${n} slot` }))}
                style={{ width: 100 }}
              />
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs">Tên Khung *</label>
            <Input
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
              placeholder="Ví dụ: HelloKitty, Y2K..."
              style={{ background: '#111', borderColor: '#2a2a2a', color: '#e5e5e5' }}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#888] text-xs">Danh Mục *</label>
            <Input
              value={uploadCategory}
              onChange={e => setUploadCategory(e.target.value)}
              placeholder="Ví dụ: Frame Basic, Frame Cartoon..."
              list="known-categories"
              style={{ background: '#111', borderColor: '#2a2a2a', color: '#e5e5e5' }}
            />
            <datalist id="known-categories">
              <option value="Frame Basic" />
              <option value="Frame Cartoon" />
              <option value="Frame Amazing ⭐️" />
              <option value="Frame IDOL Hoạt Họa" />
            </datalist>
          </div>

          {/* Frame type */}
          <div className="flex items-center gap-3">
            <span className="text-[#888] text-xs">Loại Frame:</span>
            <Select
              value={uploadFrameType}
              onChange={setUploadFrameType}
              size="small"
              options={[
                { value: 'square', label: 'square (4 slot)' },
                { value: 'bigrectangle', label: 'bigrectangle (6 slot)' },
                { value: 'grid', label: 'grid (khác)' },
              ]}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!previewItem}
        onCancel={() => setPreviewItem(null)}
        footer={null}
        centered
        width={previewItem?.type === 'video' ? 720 : 420}
        styles={{
          body: { background: '#111', padding: 0 },
          header: { background: '#111', borderBottom: '1px solid #1f1f1f' },

        }}
        title={<span className="text-[#aaa] text-sm font-normal truncate">{previewItem?.name}</span>}
      >
        {previewItem?.type === 'photo' ? (
          <img src={previewItem.url} alt={previewItem.name} className="w-full" />
        ) : previewItem?.type === 'video' ? (
          <video src={previewItem.url} controls autoPlay className="w-full" />
        ) : null}
        <div className="p-3 flex justify-between items-center">
          <span className="text-[#555] text-xs">{previewItem ? formatDate(previewItem.timeCreated) : ''} · {previewItem ? formatBytes(previewItem.size) : ''}</span>
          <div className="flex gap-2">
            <a href={previewItem?.url} target="_blank" rel="noopener noreferrer"
              className="text-[#555] hover:text-white text-xs underline transition-colors">
              Mở link ↗
            </a>
            <button
              onClick={() => { if (previewItem) handleDelete(previewItem); setPreviewItem(null) }}
              className="text-red-500 hover:text-red-400 text-xs transition-colors"
            >
              Xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
