import { useCallback, useEffect, useState } from 'react'
import { ref, listAll, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { Button, Modal, Spin, Empty, Tooltip } from 'antd'
import { DeleteOutlined, ReloadOutlined, LogoutOutlined, PlayCircleOutlined, DeleteFilled, ClockCircleOutlined } from '@ant-design/icons'

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
  const [tab, setTab] = useState<'photos' | 'videos'>('photos')

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
        {(['photos', 'videos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-white text-white'
                : 'border-transparent text-[#555] hover:text-[#aaa]'
            }`}
          >
            {t === 'photos' ? `Ảnh (${photos.length})` : `Video (${videos.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
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
                      className="w-full aspect-[3/4] object-cover"
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
