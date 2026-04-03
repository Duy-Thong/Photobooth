import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { ref, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { listenToSessions, deleteSession, markSessionPrinted } from '@/lib/sessionService'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { Button, Modal, Spin, Empty, Tooltip, Dropdown, Space, Alert } from 'antd'
import {
  DeleteOutlined, ReloadOutlined, PlayCircleOutlined,
  DeleteFilled, PictureOutlined, CheckOutlined, CloseOutlined, DownOutlined
} from '@ant-design/icons'

interface MediaItem {
  name: string
  fullPath: string
  url: string
  timeCreated: string
  size: number
  type: 'photo' | 'video'
  sessionId?: string
}

function getPathFromUrl(url: string): string | null {
  if (!url) return null
  try {
    if (url.includes('/o/')) return decodeURIComponent(url.split('/o/')[1].split('?')[0])
    return null
  } catch { return null }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function StudioGalleryPage() {
  const { permissions, role, studioId, isAdminLoading } = useAdminAuth()
  const navigate = useNavigate()

  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'photos' | 'videos'>('photos')
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [printedPaths, setPrintedPaths] = useState<Set<string>>(new Set())
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [brokenPaths, setBrokenPaths] = useState<Set<string>>(new Set())
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!studioId) return
    setLoading(true)
    setError(null)
    const unsub = listenToSessions((sessions) => {
      const sPhotos: MediaItem[] = []
      const sVideos: MediaItem[] = []
      const sPrinted = new Set<string>()
      for (const s of sessions) {
        // ... build items ...
        const pPath = getPathFromUrl(s.imageUrl) || `sessions/${s.studioId}/${s.id}/strip.jpg`
        sPhotos.push({
          name: `Session ${s.id.slice(0, 8)}`,
          fullPath: pPath,
          url: s.imageUrl,
          timeCreated: s.createdAt,
          size: 0,
          type: 'photo',
          sessionId: s.id,
        })
        if (s.printedAt) sPrinted.add(pPath)
        if (s.videoUrl) {
          const ext = s.videoUrl.includes('.mp4') ? 'mp4' : 'webm'
          sVideos.push({
            name: `Recap ${s.id.slice(0, 8)}`,
            fullPath: getPathFromUrl(s.videoUrl) || `sessions/${s.studioId}/${s.id}/strip.${ext}`,
            url: s.videoUrl,
            timeCreated: s.createdAt,
            size: 0,
            type: 'video',
            sessionId: s.id,
          })
        }
      }

      // Apply date range filter from permissions
      let allP = sPhotos
      let allV = sVideos
      if (permissions?.photoDateRange) {
        const start = new Date(permissions.photoDateRange.start).getTime()
        const end = new Date(permissions.photoDateRange.end).getTime()
        allP = allP.filter(p => { const t = new Date(p.timeCreated).getTime(); return t >= start && t <= end })
      }
      if (permissions?.videoDateRange) {
        const start = new Date(permissions.videoDateRange.start).getTime()
        const end = new Date(permissions.videoDateRange.end).getTime()
        allV = allV.filter(v => { const t = new Date(v.timeCreated).getTime(); return t >= start && t <= end })
      }

      setPhotos(allP)
      setVideos(allV)
      setPrintedPaths(sPrinted)
      setLoading(false)
      setError(null)
    }, studioId, (err) => {
      setError(err)
      setLoading(false)
    })
    return () => unsub()
  // permissions is stable; studioId won't change after login
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId])

  // Superadmin không dùng trang này — redirect sau khi hooks đã chạy
  if (!isAdminLoading && role === 'superadmin') return <Navigate to="/admin" replace />

  const items = tab === 'photos' ? photos : videos

  const handleDelete = (item: MediaItem) => {
    Modal.confirm({
      title: 'Xóa file này?',
      content: item.name,
      okText: 'Xóa', okButtonProps: { danger: true },
      cancelText: 'Hủy', centered: true,
      styles: { body: { background: '#000', color: '#e5e5e5' }, header: { background: '#000' }, footer: { background: '#000' }, mask: { backdropFilter: 'blur(4px)' } },
      onOk: async () => {
        setDeletingPath(item.fullPath)
        try {
          await deleteObject(ref(storage, item.fullPath)).catch(() => {})
          if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
          if (item.type === 'photo') setPhotos(ps => ps.filter(p => p.fullPath !== item.fullPath))
          else setVideos(vs => vs.filter(v => v.fullPath !== item.fullPath))
        } finally {
          setDeletingPath(null)
        }
      },
    })
  }

  const handleDeleteSelected = () => {
    const toDelete = items.filter(i => selectedPaths.has(i.fullPath))
    if (!toDelete.length) return
    Modal.confirm({
      title: `Xóa ${toDelete.length} file đã chọn?`,
      content: 'Hành động này không thể hoàn tác.',
      okText: `Xóa ${toDelete.length} file`, okButtonProps: { danger: true },
      cancelText: 'Hủy', centered: true,
      styles: { body: { background: '#000', color: '#e5e5e5' }, header: { background: '#000' }, footer: { background: '#000' }, mask: { backdropFilter: 'blur(4px)' } },
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await Promise.allSettled(toDelete.map(async item => {
            await deleteObject(ref(storage, item.fullPath)).catch(() => {})
            if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
          }))
          const deleted = new Set(toDelete.map(i => i.fullPath))
          setPhotos(ps => ps.filter(p => !deleted.has(p.fullPath)))
          setVideos(vs => vs.filter(v => !deleted.has(v.fullPath)))
          setSelectedPaths(new Set())
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  const toggleSelect = (path: string) => setSelectedPaths(prev => {
    const next = new Set(prev)
    next.has(path) ? next.delete(path) : next.add(path)
    return next
  })

  const printRef = useRef<HTMLStyleElement | null>(null)

  const handlePrint = (item: MediaItem) => {
    const style = document.createElement('style')
    style.innerHTML = `@page{size:4in 6in portrait;margin:3mm}@media print{body>*:not(#__pf){display:none!important}#__pf{display:flex!important;position:fixed;inset:0;justify-content:center;align-items:center;background:white}#__pf img{max-width:100%;max-height:100%;object-fit:contain}}`
    const frame = document.createElement('div')
    frame.id = '__pf'
    frame.style.display = 'none'
    const img = document.createElement('img')
    img.src = item.url
    frame.appendChild(img)
    document.head.appendChild(style)
    document.body.appendChild(frame)
    const cleanup = () => { style.remove(); frame.remove(); window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    const doPrint = () => {
      window.print()
      setPrintedPaths(p => new Set(p).add(item.fullPath))
      if (item.sessionId) markSessionPrinted(item.sessionId).catch(() => {})
    }
    img.complete && img.naturalWidth > 0 ? doPrint() : (img.onload = doPrint)
    printRef.current = style
  }



  return (
    <div className="h-full bg-[#0a0a0a] flex flex-col">
      {/* Top Actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          {selectedPaths.size > 0 && (
            <div className="flex items-center gap-2 bg-[#111] border border-blue-900/50 rounded-lg px-2 py-1">
              <span className="text-blue-400 text-[10px] font-bold px-1 uppercase tracking-wider">Đã chọn {selectedPaths.size}</span>
              {tab === 'photos' && (
                <Button size="small" type="primary" icon={<PictureOutlined />}
                  onClick={() => { const sel = photos.filter(i => selectedPaths.has(i.fullPath)); sel.forEach(handlePrint) }}
                  style={{ background: '#27ae60', borderColor: '#27ae60' }}>
                  In {selectedPaths.size} ảnh
                </Button>
              )}
              <Button size="small" type="primary" danger icon={<DeleteFilled />} onClick={handleDeleteSelected} loading={bulkDeleting}>
                Xóa {selectedPaths.size}
              </Button>
              <Button size="small" ghost onClick={() => setSelectedPaths(new Set())} style={{ color: '#888', borderColor: '#333' }}>
                Bỏ chọn
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" icon={<ReloadOutlined />} onClick={() => window.location.reload()}
            style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
            Tải lại
          </Button>

          {items.length > 0 && (
            <Button size="small"
              onClick={() => setSelectedPaths(selectedPaths.size === items.length ? new Set() : new Set(items.map(i => i.fullPath)))}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
              {selectedPaths.size === items.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
        {error && (
          <div className="mb-6">
            <Alert
              message="Lỗi kết nối hoặc thiếu cấu hình dữ liệu"
              description={
                <div className="mt-2 text-xs">
                  <p>Hệ thống không thể tải ảnh lên. Nguyên nhân có thể do Firestore đang thiếu Index hoặc kết nối mạng không ổn định.</p>
                  <p className="mt-1 opacity-70">Lỗi chi tiết: {error.message}</p>
                  <div className="mt-3">
                    <Button size="small" type="primary" 
                      onClick={() => window.location.reload()}
                      icon={<ReloadOutlined />}>
                      Tải lại trang
                    </Button>
                  </div>
                </div>
              }
              type="error"
              showIcon
              style={{ background: '#1a1111', border: '1px solid #3d1a1a' }}
            />
          </div>
        )}

        <div className="flex border-b border-[#141414] mb-8">
        {(['photos', 'videos'] as const).map(t => (
          <button key={t}
            onClick={() => { setTab(t); setSelectedPaths(new Set()) }}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-white text-white' : 'border-transparent text-[#555] hover:text-[#aaa]'
            }`}
          >
            {t === 'photos' ? `Ảnh (${photos.length})` : `Video (${videos.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Spin size="large" /></div>
        ) : items.length === 0 ? (
          <Empty description={<span className="text-[#555]">Chưa có dữ liệu</span>} className="mt-20" />
        ) : (
          <div className={`grid gap-4 ${tab === 'photos' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
            {items.map(item => (
              <div key={item.fullPath}
                className={`group relative bg-[#0a0a0a] border rounded-xl overflow-hidden transition-all duration-200 ${
                  selectedPaths.has(item.fullPath) ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-[#2a2a2a] hover:border-[#444]'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative cursor-pointer"
                  onClick={() => { if (selectedPaths.size > 0) toggleSelect(item.fullPath); else if (!brokenPaths.has(item.fullPath)) setPreviewItem(item) }}
                >
                  {item.type === 'photo' ? (
                    brokenPaths.has(item.fullPath) ? (
                      <div className="w-full aspect-3/4 bg-[#111] flex flex-col items-center justify-center text-[#333] gap-2">
                        <CloseOutlined style={{ fontSize: 24 }} />
                        <span className="text-[10px] uppercase">File missing</span>
                      </div>
                    ) : (
                      <img src={item.url} alt={item.name} className="w-full aspect-3/4 object-cover" loading="lazy"
                        onError={() => setBrokenPaths(p => new Set(p).add(item.fullPath))} />
                    )
                  ) : (
                    <div className="w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
                      {brokenPaths.has(item.fullPath) ? (
                        <div className="flex flex-col items-center justify-center text-[#333] gap-2">
                          <CloseOutlined style={{ fontSize: 24 }} />
                          <span className="text-[10px] uppercase">Video missing</span>
                        </div>
                      ) : (
                        <>
                          <video src={item.url} className="w-full h-full object-cover" onError={() => setBrokenPaths(p => new Set(p).add(item.fullPath))} />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <PlayCircleOutlined className="text-white text-4xl" />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Checkbox */}
                  <div
                    className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedPaths.has(item.fullPath) ? 'bg-blue-500 border-blue-500' : 'bg-black/40 border-white/40 opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={e => { e.stopPropagation(); toggleSelect(item.fullPath) }}
                  >
                    {selectedPaths.has(item.fullPath) && <CheckOutlined className="text-white text-[10px]" />}
                  </div>

                  {/* Printed badge */}
                  {printedPaths.has(item.fullPath) && (
                    <div className="absolute bottom-2 left-2 bg-green-600/90 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                      Đã in
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[#666] text-[10px] truncate">{formatDate(item.timeCreated)}</p>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {item.type === 'photo' && (
                    <Tooltip title="In ảnh">
                      <button onClick={e => { e.stopPropagation(); handlePrint(item) }}
                        className="bg-black/70 hover:bg-green-600 text-white rounded-lg p-1.5">
                        <PictureOutlined />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip title="Xóa">
                    <button onClick={e => { e.stopPropagation(); handleDelete(item) }}
                      disabled={deletingPath === item.fullPath}
                      className="bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5">
                      {deletingPath === item.fullPath ? <Spin size="small" /> : <DeleteOutlined />}
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <Modal
        open={!!previewItem} onCancel={() => setPreviewItem(null)} footer={null}
        centered width="min(90vw, 700px)"
        styles={{ body: { background: '#0a0a0a', padding: 0 }, header: { background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', padding: '12px 24px' } }}
        title={<span className="text-[#aaa] text-sm font-normal truncate">{previewItem?.name}</span>}
      >
        {previewItem?.type === 'photo' ? (
          <img src={previewItem.url} alt={previewItem.name} className="w-full" style={{ maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
        ) : (
          <video src={previewItem?.url} controls autoPlay className="w-full" style={{ maxHeight: '80vh' }} />
        )}
        <div className="p-3 flex justify-between items-center flex-wrap gap-2">
          <span className="text-[#555] text-xs">{previewItem ? formatDate(previewItem.timeCreated) : ''}</span>
          <div className="flex gap-2">
            {previewItem?.sessionId && (
              <a href={`/session/${previewItem.sessionId}`} target="_blank" rel="noopener noreferrer">
                <Button style={{ background: '#1a2a3a', borderColor: '#1e4a7a', color: '#4da6ff' }}>Trang Session ↗</Button>
              </a>
            )}
            <Button style={{ background: '#1e1e1e', borderColor: '#2a2a2a', color: '#aaa' }}
              onClick={async () => {
                if (!previewItem) return
                const blob = await fetch(previewItem.url).then(r => r.blob())
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = previewItem.name || 'photo'
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >Tải về ↓</Button>
            {previewItem?.type === 'photo' && (
              <Button style={{ background: '#1a3a1a', borderColor: '#27ae60', color: '#27ae60' }}
                onClick={() => { if (previewItem) handlePrint(previewItem) }} icon={<PictureOutlined />}>
                In ảnh
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
