import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ref, deleteObject, getMetadata } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { listenToSessions, deleteSession, markSessionPrinted } from '@/lib/sessionService'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { fetchCustomFrames as fetchCustomFramesService, type FrameItem } from '@/lib/frameService'
import { Button, Modal, Tooltip } from 'antd'
import {
  ReloadOutlined,
  LogoutOutlined,
  DeleteFilled,
  ClockCircleOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import ThemeToggle from '@/components/photobooth/ThemeToggle'
import { useThemeClass } from '@/stores/themeStore'
import { printSingleImage, printMultipleImages } from '@/lib/printService'
import {
  fetchStorageOnlyMedia,
  getPathFromUrl,
  type MediaItem,
} from '@/lib/adminMediaService'

import MediaTab from '@/components/admin/tabs/MediaTab'
import FramesTab from '@/components/admin/tabs/FramesTab'
import RequestsTab from '@/components/admin/tabs/RequestsTab'
import FeedbackTab from '@/components/admin/tabs/FeedbackTab'
import AdminsTab from '@/components/admin/tabs/AdminsTab'

export default function AdminPage() {
  const { logout, permissions, user } = useAdminAuth()
  const tc = useThemeClass()

  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [printedPaths, setPrintedPaths] = useState<Set<string>>(new Set())
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [brokenPaths, setBrokenPaths] = useState<Set<string>>(new Set())

  // Real-time state
  const [sessionItems, setSessionItems] = useState<{
    photos: MediaItem[]
    videos: MediaItem[]
    printed: Set<string>
  }>({ photos: [], videos: [], printed: new Set() })

  // Storage-only items (no Firestore doc) — loaded once after sessions
  const [storageOnlyItems, setStorageOnlyItems] = useState<{
    photos: MediaItem[]
    videos: MediaItem[]
  }>({ photos: [], videos: [] })
  const storageOnlyFetchedRef = useRef(false)

  // Custom frames state (for tab counter & frames tab)
  const [customFrames, setCustomFrames] = useState<FrameItem[]>([])
  const [framesLoading, setFramesLoading] = useState(false)

  const availableTabs = useMemo(() => {
    if (!permissions) return []
    const tabs: ('photos' | 'videos' | 'frames' | 'requests' | 'feedback' | 'admins')[] = []
    if (permissions.canViewPhotos) tabs.push('photos')
    if (permissions.canViewVideos) tabs.push('videos')
    if (permissions.canManageFrames) tabs.push('frames')
    if (permissions.canManageRequests) tabs.push('requests')
    if (permissions.canManageFeedback) tabs.push('feedback')
    if (permissions.canManageAdmins) tabs.push('admins')
    return tabs
  }, [permissions])

  const [tab, setTab] = useState<'photos' | 'videos' | 'frames' | 'requests' | 'feedback' | 'admins'>('photos')

  // Redirect if current tab becomes unavailable
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(tab)) {
      setTab(availableTabs[0])
    }
  }, [availableTabs, tab])

  // 1. Real-time Session Listener
  useEffect(() => {
    setLoading(true)
    const unsubscribe = listenToSessions((sessions: any[]) => {
      const sPhotos: MediaItem[] = []
      const sVideos: MediaItem[] = []
      const sPrinted = new Set<string>()

      for (const s of sessions) {
        const pPath = getPathFromUrl(s.imageUrl) || `sessions/${s.id}/strip.jpg`
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
            name: `Session Recap ${s.id.slice(0, 8)}`,
            fullPath: getPathFromUrl(s.videoUrl) || `sessions/${s.id}/strip.${ext}`,
            url: s.videoUrl,
            timeCreated: s.createdAt,
            size: 0,
            type: 'video',
            sessionId: s.id,
          })
        }
      }
      setSessionItems({ photos: sPhotos, videos: sVideos, printed: sPrinted })
      setLoading(false)

      if (!storageOnlyFetchedRef.current) {
        storageOnlyFetchedRef.current = true
        const knownPhotoPaths = new Set(sPhotos.map((p) => p.fullPath))
        const knownVideoPaths = new Set(sVideos.map((v) => v.fullPath))
        const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string
        fetchStorageOnlyMedia(knownPhotoPaths, knownVideoPaths, bucket)
          .then(({ storagePhotos, storageVideos }) => {
            setStorageOnlyItems({ photos: storagePhotos, videos: storageVideos })
          })
          .catch(() => {
            /* ignore */
          })
      }
    })

    return () => unsubscribe()
  }, [])

  // 2. Compute final lists with date range filters
  useEffect(() => {
    let allP = [...sessionItems.photos]
    let allV = [...sessionItems.videos]

    if (permissions?.photoDateRange) {
      const start = new Date(permissions.photoDateRange.start).getTime()
      const end = new Date(permissions.photoDateRange.end).getTime()
      allP = allP.filter((p) => {
        const t = new Date(p.timeCreated).getTime()
        return t >= start && t <= end
      })
    }
    if (permissions?.videoDateRange) {
      const start = new Date(permissions.videoDateRange.start).getTime()
      const end = new Date(permissions.videoDateRange.end).getTime()
      allV = allV.filter((v) => {
        const t = new Date(v.timeCreated).getTime()
        return t >= start && t <= end
      })
    }

    allP.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())
    allV.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())

    setPhotos([...allP, ...storageOnlyItems.photos])
    setVideos([...allV, ...storageOnlyItems.videos])
    setPrintedPaths(sessionItems.printed)
  }, [sessionItems, permissions, storageOnlyItems])

  const loadCustomFrames = useCallback(async () => {
    setFramesLoading(true)
    try {
      const frames = await fetchCustomFramesService()
      setCustomFrames(frames)
    } finally {
      setFramesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomFrames()
  }, [loadCustomFrames])

  const handleDelete = async (item: MediaItem) => {
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
          await deleteObject(ref(storage, item.fullPath)).catch(() => {})
          if (item.sessionId) {
            await deleteSession(item.sessionId).catch(() => {})
          }
          if (item.type === 'photo') setPhotos((ps) => ps.filter((p) => p.fullPath !== item.fullPath))
          else setVideos((vs) => vs.filter((v) => v.fullPath !== item.fullPath))
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
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await Promise.allSettled(
            list.map(async (item) => {
              await deleteObject(ref(storage, item.fullPath)).catch(() => {})
              if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
            }),
          )
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
    const old = allItems.filter((item) => new Date(item.timeCreated).getTime() < cutoff)
    if (old.length === 0) {
      Modal.info({
        title: 'Không có dữ liệu cũ',
        content: 'Tất cả file đều trong vòng 7 ngày gần nhất.',
        centered: true,
        okText: 'Đóng',
      })
      return
    }
    Modal.confirm({
      title: 'Xóa dữ liệu cũ hơn 7 ngày?',
      content: `Tìm thấy ${old.length} file (${old.filter((i) => i.type === 'photo').length} ảnh, ${old.filter((i) => i.type === 'video').length} video). Hành động này không thể hoàn tác.`,
      okText: `Xóa ${old.length} file`,
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        setBulkDeleting(true)
        try {
          await Promise.allSettled(
            old.map(async (item) => {
              await deleteObject(ref(storage, item.fullPath)).catch(() => {})
              if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
            }),
          )
          const oldPaths = new Set(old.map((i) => i.fullPath))
          setPhotos((ps) => ps.filter((p) => !oldPaths.has(p.fullPath)))
          setVideos((vs) => vs.filter((v) => !oldPaths.has(v.fullPath)))
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  const handleDeleteSelected = () => {
    if (selectedPaths.size === 0) return
    const count = selectedPaths.size
    Modal.confirm({
      title: `Xóa ${count} file đã chọn?`,
      content: 'Hành động này không thể hoàn tác.',
      okText: `Xóa ${count} file`,
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        setBulkDeleting(true)
        try {
          const toDelete = items.filter((i) => selectedPaths.has(i.fullPath))
          await Promise.allSettled(
            toDelete.map(async (item) => {
              await deleteObject(ref(storage, item.fullPath)).catch(() => {})
              if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
            }),
          )
          const deletedPaths = new Set(toDelete.map((i) => i.fullPath))
          setPhotos((ps) => ps.filter((p) => !deletedPaths.has(p.fullPath)))
          setVideos((vs) => vs.filter((v) => !deletedPaths.has(v.fullPath)))
          setSelectedPaths(new Set())
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const selectAll = () => {
    setSelectedPaths(new Set(items.map((i) => i.fullPath)))
  }

  const deselectAll = () => {
    setSelectedPaths(new Set())
  }

  const handleCleanupSessions = () => {
    Modal.confirm({
      title: 'Dọn dẹp Database tích cực?',
      content:
        'Hệ thống sẽ quét sâu toàn bộ bản ghi và xóa sạch những session không còn file trên Storage. Bạn có muốn tiếp tục?',
      okText: 'Bắt đầu ngay',
      centered: true,
      onOk: async () => {
        setBulkDeleting(true)
        try {
          let cleaned = 0
          const allItems = [...photos, ...videos]
          const sessionsWithId = allItems.filter((i) => i.sessionId)

          for (let i = 0; i < sessionsWithId.length; i += 5) {
            const chunk = sessionsWithId.slice(i, i + 5)
            await Promise.allSettled(
              chunk.map(async (item) => {
                try {
                  await getMetadata(ref(storage, item.fullPath))
                } catch (err: any) {
                  const is404 =
                    err.code?.includes('not-found') ||
                    err.message?.includes('404') ||
                    err.status === 404 ||
                    err.serverResponse?.includes('404')

                  if (is404 && item.sessionId) {
                    await deleteSession(item.sessionId).catch(() => {})
                    cleaned++
                  }
                }
              }),
            )
            await new Promise((r) => setTimeout(r, 100))
          }

          Modal.success({
            title: 'Hoàn tất dọn dẹp',
            content: `Đã dọn dẹp xong. Hệ thống đã xóa ${cleaned} bản ghi lỗi. Dữ liệu sẽ được cập nhật tự động.`,
            centered: true,
          })
        } catch {
          Modal.error({ title: 'Dọn dẹp thất bại', centered: true })
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  const handlePrint = (item: MediaItem) => {
    printSingleImage(item.url, () => {
      setPrintedPaths((prev) => new Set(prev).add(item.fullPath))
      if (item.sessionId) {
        markSessionPrinted(item.sessionId).catch(() => {})
      } else {
        const stored = localStorage.getItem('printed_paths')
        const list: string[] = stored ? JSON.parse(stored) : []
        if (!list.includes(item.fullPath)) {
          list.push(item.fullPath)
          localStorage.setItem('printed_paths', JSON.stringify(list))
        }
      }
    })
  }

  const handlePrintMultiple = (itemsToPrint: MediaItem[]) => {
    if (itemsToPrint.length === 0) return
    printMultipleImages(
      itemsToPrint.map((i) => i.url),
      () => {
        setPrintedPaths((prev) => {
          const next = new Set(prev)
          itemsToPrint.forEach((item) => next.add(item.fullPath))
          return next
        })
        itemsToPrint.forEach((item) => {
          if (item.sessionId) {
            markSessionPrinted(item.sessionId).catch(() => {})
          } else {
            const stored = localStorage.getItem('printed_paths')
            const list: string[] = stored ? JSON.parse(stored) : []
            if (!list.includes(item.fullPath)) list.push(item.fullPath)
            localStorage.setItem('printed_paths', JSON.stringify(list))
          }
        })
      },
    )
  }

  const handlePrintSelected = () => {
    if (selectedPaths.size === 0) return
    const toPrint = photos.filter((i) => selectedPaths.has(i.fullPath))
    if (toPrint.length === 0) return

    if (toPrint.length > 5) {
      Modal.confirm({
        title: `In ${toPrint.length} ảnh?`,
        content: `Sẽ in ${toPrint.length} ảnh trong 1 lần, mỗi ảnh trên 1 trang. Tiếp tục?`,
        onOk: () => handlePrintMultiple(toPrint),
        centered: true,
      })
    } else {
      handlePrintMultiple(toPrint)
    }
  }

  const items = tab === 'photos' ? photos : videos

  return (
    <div
      className={`min-h-dvh flex flex-col transition-colors duration-200 ${tc(
        'bg-[#0a0a0a] text-[#e5e5e5]',
        'bg-[#f8fafc] text-slate-800',
      )}`}
    >
      {/* Header */}
      <header
        className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${tc(
          'bg-[#111] border-[#1f1f1f]',
          'bg-white border-slate-200 shadow-xs',
        )}`}
      >
        <div className="flex items-center gap-3">
          <div>
            <h1
              className={`font-bold text-lg leading-tight ${tc('text-white', 'text-slate-900')}`}
              style={{ letterSpacing: '-0.02em' }}
            >
              Sổ Media Photobooth
            </h1>
            <p className={`text-[10px] uppercase tracking-widest font-semibold ${tc('text-slate-500', 'text-slate-400')}`}>
              Admin Panel
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedPaths.size > 0 && (
            <div
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1 mr-2 border ${tc(
                'bg-[#0a0a0a] border-blue-900/50',
                'bg-blue-50 border-blue-200',
              )}`}
            >
              <span className={`text-[11px] font-bold px-1 uppercase tracking-wider ${tc('text-blue-400', 'text-blue-600')}`}>
                Đã chọn {selectedPaths.size}
              </span>

              {tab === 'photos' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<PictureOutlined />}
                  onClick={handlePrintSelected}
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                >
                  In {selectedPaths.size} ảnh
                </Button>
              )}

              {permissions?.canManageAdmins && (
                <Button
                  size="small"
                  type="primary"
                  danger
                  icon={<DeleteFilled />}
                  onClick={handleDeleteSelected}
                >
                  Xóa {selectedPaths.size}
                </Button>
              )}
              <Button size="small" onClick={deselectAll}>
                Bỏ chọn
              </Button>
            </div>
          )}

          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
            disabled={bulkDeleting}
          >
            Tải lại
          </Button>

          {(tab === 'photos' || tab === 'videos') && items.length > 0 && (
            <Button size="small" onClick={selectedPaths.size === items.length ? deselectAll : selectAll}>
              {selectedPaths.size === items.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
            </Button>
          )}

          {permissions?.canManageAdmins && (
            <>
              <Tooltip title="Xóa dữ liệu cũ hơn 7 ngày (cả ảnh & video)">
                <Button
                  size="small"
                  icon={<ClockCircleOutlined />}
                  onClick={handleDeleteOlderThan7Days}
                  loading={bulkDeleting}
                  className={tc('text-amber-500 border-amber-900/40', 'text-amber-600 border-amber-300')}
                >
                  <span className="hidden sm:inline">Cũ &gt; 7 ngày</span>
                </Button>
              </Tooltip>
              <Tooltip title="Quét và xóa các bản ghi không còn file ảnh/video thực tế">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleCleanupSessions}
                  loading={bulkDeleting}
                  className={tc('text-sky-400 border-sky-900/40', 'text-sky-600 border-sky-300')}
                >
                  <span className="hidden sm:inline">Dọn dẹp DB</span>
                </Button>
              </Tooltip>
              <Tooltip title="Xóa tất cả trong tab hiện tại">
                <Button
                  size="small"
                  icon={<DeleteFilled />}
                  onClick={handleDeleteAll}
                  loading={bulkDeleting}
                  danger
                >
                  <span className="hidden sm:inline">Xóa tất cả</span>
                </Button>
              </Tooltip>
            </>
          )}

          <ThemeToggle />

          <Button size="small" icon={<LogoutOutlined />} onClick={logout}>
            Đăng xuất
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div
        className={`flex px-4 sm:px-6 overflow-x-auto no-scrollbar flex-nowrap shrink-0 border-b ${tc(
          'bg-[#111] border-[#1f1f1f]',
          'bg-white border-slate-200',
        )}`}
      >
        {availableTabs.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              setSelectedPaths(new Set())
            }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
              tab === t
                ? tc('border-white text-white', 'border-blue-600 text-blue-600')
                : tc(
                    'border-transparent text-slate-500 hover:text-slate-300',
                    'border-transparent text-slate-500 hover:text-slate-800',
                  )
            }`}
          >
            {t === 'photos'
              ? `Ảnh (${photos.length})`
              : t === 'videos'
                ? `Video (${videos.length})`
                : t === 'frames'
                  ? `Khung (${customFrames.length})`
                  : t === 'requests'
                    ? 'Đề Xuất'
                    : t === 'feedback'
                      ? 'Góp ý'
                      : 'Admin'}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {tab === 'admins' ? (
        <AdminsTab currentUserEmail={user?.email} onSelfDeleted={logout} />
      ) : tab === 'frames' ? (
        <FramesTab
          customFrames={customFrames}
          framesLoading={framesLoading}
          canDelete={permissions?.canManageAdmins ?? false}
          onReload={loadCustomFrames}
          onFramesChange={setCustomFrames}
        />
      ) : tab === 'requests' ? (
        <RequestsTab onFrameApproved={loadCustomFrames} />
      ) : tab === 'feedback' ? (
        <FeedbackTab canDelete={permissions?.canManageAdmins ?? false} />
      ) : (
        <div className="flex-1 p-6">
          <MediaTab
            tab={tab}
            items={items}
            loading={loading}
            selectedPaths={selectedPaths}
            brokenPaths={brokenPaths}
            printedPaths={printedPaths}
            deletingPath={deletingPath}
            canDelete={permissions?.canManageAdmins ?? false}
            onToggleSelect={toggleSelect}
            onDelete={handleDelete}
            onPrint={handlePrint}
            onBrokenPath={(path) => setBrokenPaths((prev) => new Set(prev).add(path))}
          />
        </div>
      )}
    </div>
  )
}
