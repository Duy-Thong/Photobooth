import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listenToSessions } from '@/lib/sessionService'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { fetchCustomFrames as fetchCustomFramesService, type FrameItem } from '@/lib/frameService'
import { Button } from 'antd'
import { ReloadOutlined, LogoutOutlined } from '@ant-design/icons'
import ThemeToggle from '@/components/photobooth/ThemeToggle'
import { useThemeClass } from '@/stores/themeStore'
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
  const [printedPaths, setPrintedPaths] = useState<Set<string>>(new Set())

  // Real-time session state
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

  // 2. Compute final lists with permissions date range filters
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

  const handleItemDeleted = useCallback((item: MediaItem) => {
    if (item.type === 'photo') {
      setPhotos((prev) => prev.filter((p) => p.fullPath !== item.fullPath))
    } else {
      setVideos((prev) => prev.filter((v) => v.fullPath !== item.fullPath))
    }
  }, [])

  const handleItemsDeleted = useCallback((deletedList: MediaItem[]) => {
    const deletedPaths = new Set(deletedList.map((i) => i.fullPath))
    setPhotos((prev) => prev.filter((p) => !deletedPaths.has(p.fullPath)))
    setVideos((prev) => prev.filter((v) => !deletedPaths.has(v.fullPath)))
  }, [])

  const currentMediaList = tab === 'photos' ? photos : videos

  return (
    <div
      className={`h-dvh flex flex-col overflow-hidden transition-colors duration-200 ${tc(
        'bg-[#0a0a0a] text-[#e5e5e5]',
        'bg-[#f8fafc] text-slate-800',
      )}`}
    >
      {/* Sticky Top Navbar + Tabs */}
      <div className="shrink-0 z-30 shadow-xs">
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
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
            >
              Tải lại
            </Button>

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
              onClick={() => setTab(t)}
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
      </div>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
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
          <div className="p-4 sm:p-6">
            <MediaTab
              tab={tab}
              items={currentMediaList}
              loading={loading}
              canDelete={permissions?.canManageAdmins ?? false}
              initialPrintedPaths={printedPaths}
              onItemDeleted={handleItemDeleted}
              onItemsDeleted={handleItemsDeleted}
            />
          </div>
        )}
      </main>
    </div>
  )
}
