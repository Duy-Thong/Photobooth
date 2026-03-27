import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { firebaseConfig } from '@/lib/firebase'
import { ref, listAll, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { fetchSessions, deleteSession } from '@/lib/sessionService'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import {
  fetchCustomFrames as fetchCustomFramesService,
  uploadFrame as uploadFrameService,
  deleteCustomFrame as deleteCustomFrameService,
  updateFrame as updateFrameService,
  fetchFrameRequests as fetchFrameRequestsService,
  approveFrameRequest as approveFrameRequestService,
  rejectFrameRequest as rejectFrameRequestService,
  frameImageUrl,
  type FrameItem,
  type FrameRequest,
} from '@/lib/frameService'
import { fetchFeedbacks, deleteFeedback } from '@/lib/feedbackService'
import type { Feedback } from '@/types/feedback'
import { detectFrameSlots } from '@/lib/imageProcessing'
import FrameSlotEditor from '@/components/admin/FrameSlotEditor'
import { type SlotRect } from '@/types/photobooth'
import { Button, Input, Modal, Select, Spin, Empty, Tooltip, Table, Tag, Checkbox, Form, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { DeleteOutlined, ReloadOutlined, LogoutOutlined, PlayCircleOutlined, DeleteFilled, ClockCircleOutlined, UploadOutlined, PictureOutlined, EditOutlined, CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons'
import type { AdminUser } from '@/types/admin'
import { fetchAllAdmins, createOrUpdateAdmin, DEFAULT_PERMISSIONS } from '@/lib/adminService'

interface MediaItem {
  name: string
  fullPath: string
  url: string
  timeCreated: string
  size: number
  type: 'photo' | 'video'
  sessionId?: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

const getPathFromUrl = (url: string) => {
  if (!url) return null
  try {
    if (url.includes('/o/')) {
      const parts = url.split('/o/')[1].split('?')[0]
      return decodeURIComponent(parts)
    }
    return null
  } catch { return null }
}

export default function AdminPage() {
  const { logout, permissions, user } = useAdminAuth()
  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  
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

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [brokenPaths, setBrokenPaths] = useState<Set<string>>(new Set())

  // ── Admin Management state ──────────────────────────────────────────────────
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [adminSaving, setAdminSaving] = useState(false)
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [addAdminLoading, setAddAdminLoading] = useState(false)

  // ── Feedback tab state ──────────────────────────────────────────────────────
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [feedbacksLoading, setFeedbacksLoading] = useState(false)

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
  const [uploadSlotsData, setUploadSlotsData] = useState<SlotRect[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadFrameType, setUploadFrameType] = useState<FrameItem['frame']>('square')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Edit frame state ─────────────────────────────────────────────────────────
  const [editingFrame, setEditingFrame] = useState<FrameItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSlotsData, setEditSlotsData] = useState<SlotRect[]>([])
  const [editFrameType, setEditFrameType] = useState<FrameItem['frame']>('square')
  const [editSaving, setEditSaving] = useState(false)

  const openEditFrame = (frame: FrameItem) => {
    setEditingFrame(frame)
    setEditName(frame.name)
    setEditCategory(frame.categoryName)
    setEditSlotsData(frame.slots_data || [])
    setEditFrameType(frame.frame)
  }

  const handleSaveEdit = async () => {
    if (!editingFrame?.firestoreId) return
    setEditSaving(true)
    try {
      await updateFrameService(editingFrame.firestoreId, {
        name: editName.trim(),
        categoryName: editCategory.trim(),
        slots: editSlotsData.length,
        slots_data: editSlotsData,
        frame: editFrameType,
      })
      setCustomFrames(prev => prev.map(f =>
        f.firestoreId === editingFrame.firestoreId
          ? { ...f, name: editName.trim(), categoryName: editCategory.trim(), slots: editSlotsData.length, slots_data: editSlotsData, frame: editFrameType }
          : f
      ))
      setEditingFrame(null)
    } catch {
      Modal.error({ title: 'Lưu thất bại', centered: true })
    } finally {
      setEditSaving(false)
    }
  }

  // ── Requests tab state ───────────────────────────────────────────────────────
  const [requests, setRequests] = useState<FrameRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestStatusFilter, setRequestStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [previewRequest, setPreviewRequest] = useState<FrameRequest | null>(null)

  const loadRequests = useCallback(async (status: typeof requestStatusFilter = requestStatusFilter) => {
    setRequestsLoading(true)
    try {
      const data = await fetchFrameRequestsService(status)
      setRequests(data)
    } finally {
      setRequestsLoading(false)
    }
  }, [requestStatusFilter])

  useEffect(() => { if (tab === 'requests') loadRequests() }, [tab, loadRequests])

  const handleApproveRequest = async (req: FrameRequest) => {
    setProcessingId(req.firestoreId)
    try {
      await approveFrameRequestService(req)
      setRequests(prev => prev.filter(r => r.firestoreId !== req.firestoreId))
      // Also refresh frames list to show the newly approved frame
      loadCustomFrames()
    } catch {
      Modal.error({ title: 'Duyệt thất bại', centered: true })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectRequest = (req: FrameRequest) => {
    Modal.confirm({
      title: 'Từ chối đề xuất này?',
      content: `"${req.suggestedName}" từ ${req.submitterContact}`,
      okText: 'Từ chối',
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
        setProcessingId(req.firestoreId)
        try {
          await rejectFrameRequestService(req.firestoreId)
          setRequests(prev => prev.filter(r => r.firestoreId !== req.firestoreId))
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  const loadFeedbacks = useCallback(async () => {
    setFeedbacksLoading(true)
    try {
      const data = await fetchFeedbacks()
      setFeedbacks(data)
    } finally {
      setFeedbacksLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'feedback') loadFeedbacks() }, [tab, loadFeedbacks])

  const handleDeleteFeedback = (fb: Feedback) => {
    Modal.confirm({
      title: 'Xóa góp ý này?',
      content: `Góp ý từ ${fb.name || 'Ẩn danh'}`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        try {
          await deleteFeedback(fb.id)
          setFeedbacks(prev => prev.filter(f => f.id !== fb.id))
        } catch {
          Modal.error({ title: 'Xóa thất bại', centered: true })
        }
      },
    })
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const sessions = await fetchSessions()
      let sessionPhotos: MediaItem[] = []
      let sessionVideos: MediaItem[] = []
      
      for (const s of sessions) {
        // ... (collect all first, filter later or separately)
        sessionPhotos.push({
          name: `Session ${s.id.slice(0, 8)}`,
          fullPath: getPathFromUrl(s.imageUrl) || `sessions/${s.id}/strip.jpg`,
          url: s.imageUrl,
          timeCreated: s.createdAt,
          size: 0,
          type: 'photo',
          sessionId: s.id,
        })

        if (s.videoUrl) {
          const ext = s.videoUrl.includes('.mp4') ? 'mp4' : 'webm'
          sessionVideos.push({
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

      // 2. Fetch legacy from Storage (slow)
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
      }

      const [legacyP, legacyV] = await Promise.all([
        toItems(photoList.items, 'photo'),
        toItems(videoList.items, 'video')
      ])

      let allPhotos = [...sessionPhotos, ...legacyP]
      let allVideos = [...sessionVideos, ...legacyV]

      // APPLY FILTERS UNIFORMALLY
      if (permissions?.photoDateRange) {
        const start = new Date(permissions.photoDateRange.start).getTime()
        const end = new Date(permissions.photoDateRange.end).getTime()
        allPhotos = allPhotos.filter(p => {
          const t = new Date(p.timeCreated).getTime()
          return t >= start && t <= end
        })
      }
      if (permissions?.videoDateRange) {
        const start = new Date(permissions.videoDateRange.start).getTime()
        const end = new Date(permissions.videoDateRange.end).getTime()
        allVideos = allVideos.filter(v => {
          const t = new Date(v.timeCreated).getTime()
          return t >= start && t <= end
        })
      }

      allPhotos.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())
      allVideos.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())

      setPhotos(allPhotos)
      setVideos(allVideos)
    } finally {
      setLoading(false)
    }
  }, [permissions])

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
          await deleteObject(ref(storage, item.fullPath)).catch(() => {}) // Ignore if already deleted
          if (item.sessionId) {
            await deleteSession(item.sessionId).catch(() => {})
          }
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
          await Promise.allSettled(list.map(async item => {
            await deleteObject(ref(storage, item.fullPath)).catch(() => {})
            if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
          }))
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
          await Promise.allSettled(old.map(async item => {
            await deleteObject(ref(storage, item.fullPath)).catch(() => {})
            if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
          }))
          const oldPaths = new Set(old.map(i => i.fullPath))
          setPhotos(ps => ps.filter(p => !oldPaths.has(p.fullPath)))
          setVideos(vs => vs.filter(v => !oldPaths.has(v.fullPath)))
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
      styles: {
        body: { background: '#1a1a1a', color: '#e5e5e5' },
        header: { background: '#1a1a1a' },
        footer: { background: '#1a1a1a' },
        mask: { backdropFilter: 'blur(4px)' },
      },
      onOk: async () => {
        setBulkDeleting(true)
        try {
          const toDelete = items.filter(i => selectedPaths.has(i.fullPath))
          await Promise.allSettled(toDelete.map(async item => {
            await deleteObject(ref(storage, item.fullPath)).catch(() => {})
            if (item.sessionId) await deleteSession(item.sessionId).catch(() => {})
          }))
          const deletedPaths = new Set(toDelete.map(i => i.fullPath))
          setPhotos(ps => ps.filter(p => !deletedPaths.has(p.fullPath)))
          setVideos(vs => vs.filter(v => !deletedPaths.has(v.fullPath)))
          setSelectedPaths(new Set())
        } finally {
          setBulkDeleting(false)
        }
      },
    })
  }

  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const selectAll = () => {
    setSelectedPaths(new Set(items.map(i => i.fullPath)))
  }

  const deselectAll = () => {
    setSelectedPaths(new Set())
  }

  const handleCleanupSessions = () => {
    Modal.confirm({
      title: 'Dọn dẹp Database tích cực?',
      content: 'Hệ thống sẽ quét sâu toàn bộ 133+ bản ghi và xóa sạch những session không còn file trên Storage (bao gồm các bản cũ ở thư mục photobooth/recap). Bạn có muốn tiếp tục?',
      okText: 'Bắt đầu ngay',
      centered: true,
      onOk: async () => {
        setBulkDeleting(true)
        try {
          let cleaned = 0
          // Refresh list first to ensure we have latest IDs
          await fetchAll()
          
          const allItems = [...photos, ...videos]
          const sessionsWithId = allItems.filter(i => i.sessionId)
          
          console.log(`[Cleanup] Bắt đầu quét ${sessionsWithId.length} sessions...`)

          // Process in chunks with small delay
          for (let i = 0; i < sessionsWithId.length; i += 5) {
            const chunk = sessionsWithId.slice(i, i + 5)
            await Promise.allSettled(chunk.map(async item => {
              try {
                // Force check metadata
                await getMetadata(ref(storage, item.fullPath))
              } catch (err: any) {
                // If ANY error occurs during metadata fetch (especially 404), candidate for cleanup
                console.log(`[Cleanup] Lỗi khi check ${item.fullPath}:`, err.code || err.message)
                
                // We are very aggressive here: any 404 variation = delete
                const is404 = err.code?.includes('not-found') || 
                             err.message?.includes('404') || 
                             err.status === 404 ||
                             err.serverResponse?.includes('404')

                if (is404) {
                  console.log(`[Cleanup] ĐANG XÓA SESSION LỖI: ${item.sessionId}`)
                  await deleteSession(item.sessionId!).catch(e => console.error('Lỗi xóa Firestore:', e))
                  cleaned++
                }
              }
            }))
            // Small pause to keep Firestore happy
            await new Promise(r => setTimeout(r, 100))
          }
          
          Modal.success({ 
            title: 'Hoàn tất dọn dẹp', 
            content: `Đã dọn dẹp xong. Hệ thống đã xóa ${cleaned} bản ghi lỗi. Danh sách sẽ được tải lại ngay bây giờ.`, 
            centered: true 
          })
          fetchAll()
        } catch (e) {
          console.error('[Cleanup] Fatal Error:', e)
          Modal.error({ title: 'Dọn dẹp thất bại', centered: true })
        } finally {
          setBulkDeleting(false)
        }
      }
    })
  }

  const handlePrint = (item: MediaItem) => {
    const win = window.open('', '_blank')
    if (!win) {
      Modal.error({ title: 'Không thể mở cửa sổ in', content: 'Vui lòng tắt trình chặn popup và thử lại.', centered: true })
      return
    }
    win.document.write(`
      <html>
        <head>
          <title>In ảnh - ${item.name}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: start; background: white; }
            img { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img id="print-image" src="${item.url}" />
          <script>
            const img = document.getElementById('print-image');
            const doPrint = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
            if (img.complete) {
              doPrint();
            } else {
              img.onload = doPrint;
              img.onerror = () => {
                alert('Không thể tải ảnh để in.');
                window.close();
              };
            }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const handlePrintSelected = () => {
    if (selectedPaths.size === 0) return
    const toPrint = photos.filter(i => selectedPaths.has(i.fullPath))
    if (toPrint.length === 0) return

    if (toPrint.length > 5) {
      Modal.confirm({
        title: `In ${toPrint.length} ảnh?`,
        content: 'Bạn đang yêu cầu in số lượng lớn ảnh cùng lúc. Điều này sẽ mở nhiều hộp thoại in. Tiếp tục?',
        onOk: () => toPrint.forEach(item => handlePrint(item)),
        centered: true
      })
    } else {
      toPrint.forEach(item => handlePrint(item))
    }
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
      setUploadSlotsData(slots)
      setUploadFrameType(slots.length === 6 ? 'bigrectangle' : slots.length === 4 ? 'square' : 'grid')
    } finally {
      setDetectingSlots(false)
    }
  }

  const handleCloseUploadModal = () => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    setShowUploadModal(false)
    setUploadFile(null)
    setUploadPreviewUrl(null)
    setUploadSlotsData([])
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
        slots: uploadSlotsData.length,
        slots_data: uploadSlotsData,
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

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const data = await fetchAllAdmins()
      setAdmins(data)
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'admins') loadAdmins() }, [tab, loadAdmins])

  const handleSaveAdmin = async (values: any) => {
    if (!editingAdmin) return
    setAdminSaving(true)
    try {

      const updated: AdminUser = {
        ...editingAdmin,
        permissions: {
          ...editingAdmin.permissions,
          ...values,
          photoDateRange: values.photoDateRange ? {
            start: values.photoDateRange[0].startOf('day').toISOString(),
            end: values.photoDateRange[1].endOf('day').toISOString()
          } : null,
          videoDateRange: values.videoDateRange ? {
            start: values.videoDateRange[0].startOf('day').toISOString(),
            end: values.videoDateRange[1].endOf('day').toISOString()
          } : null,
        }
      }
      delete (updated.permissions as any).photoDateRange_Raw
      delete (updated.permissions as any).videoDateRange_Raw

      await createOrUpdateAdmin(editingAdmin.uid, updated)
      setAdmins(prev => prev.map(a => a.uid === editingAdmin.uid ? updated : a))
      setEditingAdmin(null)
      Modal.success({ title: 'Đã lưu thay đổi', centered: true })
    } catch {
      Modal.error({ title: 'Lưu thất bại', centered: true })
    } finally {
      setAdminSaving(false)
    }
  }

  const handleCreateAdmin = async (values: any) => {
    setAddAdminLoading(true)
    try {
      // Create a secondary app to avoid signing out current user
      const secondaryApp = getApps().find(a => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary')
      const secondaryAuth = getAuth(secondaryApp)
      
      const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, values.email, values.password)
      
      const newAdmin: AdminUser = {
        uid: newUser.uid,
        email: values.email,
        permissions: {
          ...DEFAULT_PERMISSIONS,
          ...values,
          photoDateRange: values.photoDateRange ? {
            start: values.photoDateRange[0].startOf('day').toISOString(),
            end: values.photoDateRange[1].endOf('day').toISOString()
          } : null,
          videoDateRange: values.videoDateRange ? {
            start: values.videoDateRange[0].startOf('day').toISOString(),
            end: values.videoDateRange[1].endOf('day').toISOString()
          } : null,
        },
        createdAt: new Date().toISOString()
      }
      
      await createOrUpdateAdmin(newUser.uid, newAdmin)
      setAdmins(prev => [...prev, newAdmin])
      setShowAddAdminModal(false)
      Modal.success({ title: 'Đã tạo Admin mới', centered: true })
    } catch (err: any) {
      console.error(err)
      Modal.error({ title: 'Lỗi tạo Admin', content: err.message, centered: true })
    } finally {
      setAddAdminLoading(false)
    }
  }

  const items = tab === 'photos' ? photos : videos

  return (
    <div className="min-h-dvh bg-[#111] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1f1f1f] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-white font-bold text-lg" style={{ letterSpacing: '-0.02em' }}>Sổ Media</h1>
          <p className="text-[#555] text-[10px] uppercase tracking-widest">Admin Panel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedPaths.size > 0 && (
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-blue-900/50 rounded-lg px-2 py-1 mr-2">
              <span className="text-blue-400 text-[10px] font-bold px-1 uppercase tracking-wider">Đã chọn {selectedPaths.size}</span>
              
              {tab === 'photos' && (
                <Button size="small" type="primary" icon={<PictureOutlined />} onClick={handlePrintSelected} style={{ background: '#27ae60', borderColor: '#27ae60' }}>
                  In {selectedPaths.size} ảnh
                </Button>
              )}

              <Button size="small" type="primary" danger icon={<DeleteFilled />} onClick={handleDeleteSelected}>
                Xóa {selectedPaths.size}
              </Button>
              <Button size="small" ghost onClick={deselectAll} style={{ color: '#888', borderColor: '#333' }}>
                Bỏ chọn
              </Button>
            </div>
          )}

          <Button size="small" icon={<ReloadOutlined />} onClick={fetchAll} disabled={bulkDeleting}
            style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
            Tải lại
          </Button>

          {(tab === 'photos' || tab === 'videos') && items.length > 0 && (
            <Button size="small" onClick={selectedPaths.size === items.length ? deselectAll : selectAll}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
              {selectedPaths.size === items.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
            </Button>
          )}

          <Tooltip title="Xóa dữ liệu cũ hơn 7 ngày (cả ảnh & video)">
            <Button size="small" icon={<ClockCircleOutlined />} onClick={handleDeleteOlderThan7Days}
              loading={bulkDeleting}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#e67e22' }}>
              <span className="hidden sm:inline">Cũ &gt; 7 ngày</span>
            </Button>
          </Tooltip>
          <Tooltip title="Quét và xóa các bản ghi không còn file ảnh/video thực tế">
            <Button size="small" icon={<ReloadOutlined />} onClick={handleCleanupSessions}
              loading={bulkDeleting}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#3498db' }}>
              <span className="hidden sm:inline">Dọn dẹp DB</span>
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
        {availableTabs.map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedPaths(new Set()); }}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-white text-white'
                : 'border-transparent text-[#555] hover:text-[#aaa]'
            }`}
          >
            {t === 'photos' ? `Ảnh (${photos.length})`
              : t === 'videos' ? `Video (${videos.length})`
              : t === 'frames' ? `Khung (${customFrames.length})`
              : t === 'requests' ? `Đề Xuất${requests.length > 0 && requestStatusFilter === 'pending' ? ` (${requests.length})` : ''}`
              : t === 'feedback' ? `Góp ý (${feedbacks.length})`
              : 'Admin'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'admins' ? (
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-xl">Quản lý Admin</h2>
            <div className="flex gap-2">
              <Button type="primary" icon={<UserOutlined />} onClick={() => setShowAddAdminModal(true)}>Thêm Admin Mới</Button>
              <Button icon={<ReloadOutlined />} onClick={loadAdmins} loading={adminsLoading}>Làm mới</Button>
            </div>
          </div>
          
          <Table
            dataSource={admins}
            loading={adminsLoading}
            rowKey="uid"
            pagination={false}
            columns={[
              { title: 'Email', dataIndex: 'email', key: 'email', render: (t) => <span className="text-white font-medium">{t}</span> },
              { 
                title: 'Quyền hạn', 
                key: 'permissions',
                render: (_, record) => (
                  <div className="flex flex-wrap gap-1">
                    {record.permissions.canViewPhotos && <Tag color="blue">Ảnh</Tag>}
                    {record.permissions.canViewVideos && <Tag color="cyan">Video</Tag>}
                    {record.permissions.canManageFrames && <Tag color="purple">Khung</Tag>}
                    {record.permissions.canManageRequests && <Tag color="orange">Đề xuất</Tag>}
                    {record.permissions.canManageFeedback && <Tag color="green">Góp ý</Tag>}
                    {record.permissions.canManageAdmins && <Tag color="red">Super Admin</Tag>}
                  </div>
                )
              },
              {
                title: 'Giới hạn thời gian',
                key: 'ranges',
                render: (_, record) => (
                  <div className="text-[10px] text-[#888]">
                    {record.permissions.photoDateRange && <div>Ảnh: {formatDate(record.permissions.photoDateRange.start)} - {formatDate(record.permissions.photoDateRange.end)}</div>}
                    {record.permissions.videoDateRange && <div>Video: {formatDate(record.permissions.videoDateRange.start)} - {formatDate(record.permissions.videoDateRange.end)}</div>}
                    {!record.permissions.photoDateRange && !record.permissions.videoDateRange && "Không giới hạn"}
                  </div>
                )
              },
              {
                title: 'Hành động',
                key: 'action',
                render: (_, record) => (
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={() => setEditingAdmin(record)}
                    disabled={record.email === import.meta.env.VITE_ADMIN_EMAIL && user?.email !== record.email}
                  >Sửa</Button>
                )
              }
            ]}
          />
        </div>
      ) : tab === 'frames' ? (
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
              <span className="text-[10px] text-white font-semibold uppercase tracking-[0.15em] shrink-0">Số slot:</span>
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
              <span className="text-[10px] text-white font-semibold uppercase tracking-[0.15em] shrink-0">Danh mục:</span>
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
                  <Tooltip title="Chỉnh sửa">
                    <button
                      onClick={() => openEditFrame(frame)}
                      className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-blue-600 text-white rounded-lg p-1.5"
                    >
                      <EditOutlined />
                    </button>
                  </Tooltip>
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
      ) : tab === 'requests' ? (
        <div className="flex-1 p-6">
          {/* Status filter */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setRequestStatusFilter(s); loadRequests(s) }}
                className={`text-[11px] px-3 py-1 rounded-md border transition-all duration-150 ${
                  requestStatusFilter === s
                    ? 'bg-white text-black border-white font-semibold'
                    : 'border-[#252525] text-[#5a5a5a] hover:border-[#3a3a3a] hover:text-[#bbb]'
                }`}
              >
                {s === 'pending' ? 'Chờ duyệt' : s === 'approved' ? 'Đã duyệt' : s === 'rejected' ? 'Từ chối' : 'Tất cả'}
              </button>
            ))}
            <Button size="small" icon={<ReloadOutlined />} onClick={() => loadRequests()} loading={requestsLoading}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888', marginLeft: 4 }}>
              Tải lại
            </Button>
          </div>

          {requestsLoading ? (
            <div className="flex justify-center items-center h-64"><Spin size="large" /></div>
          ) : requests.length === 0 ? (
            <Empty description={<span className="text-[#555]">Không có đề xuất nào</span>} className="mt-20" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {requests.map(req => (
                <div key={req.firestoreId} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#363636] transition-colors">
                  {/* Preview */}
                  <div
                    className="bg-[#111] flex items-center justify-center aspect-3/4 cursor-pointer"
                    onClick={() => setPreviewRequest(req)}
                  >
                    <img src={req.storageUrl} alt={req.suggestedName} className="w-full h-full object-contain" loading="lazy" />
                  </div>
                  {/* Info */}
                  <div className="p-2 flex flex-col gap-0.5">
                    <p className="text-white text-xs font-medium truncate">{req.suggestedName}</p>
                    <p className="text-[#555] text-[10px] truncate">{req.suggestedCategory}</p>
                    <p className="text-[#3a3a3a] text-[10px]">{req.slots} slot · {req.suggestedFrame}</p>
                    <p className="text-[#3a3a3a] text-[10px] truncate mt-0.5">{req.submitterContact}</p>
                    <p className="text-[#2a2a2a] text-[10px]">{new Date(req.submittedAt).toLocaleDateString('vi-VN')}</p>
                  </div>
                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex border-t border-[#1f1f1f]">
                      <button
                        onClick={() => handleApproveRequest(req)}
                        disabled={processingId === req.firestoreId}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] text-green-400 hover:bg-green-900/30 transition-colors"
                      >
                        {processingId === req.firestoreId ? <Spin size="small" /> : <><CheckOutlined /> Duyệt</>}
                      </button>
                      <div className="w-px bg-[#1f1f1f]" />
                      <button
                        onClick={() => handleRejectRequest(req)}
                        disabled={processingId === req.firestoreId}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] text-red-400 hover:bg-red-900/30 transition-colors"
                      >
                        <CloseOutlined /> Từ chối
                      </button>
                    </div>
                  )}
                  {req.status !== 'pending' && (
                    <div className={`text-center py-1.5 text-[10px] ${req.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                      {req.status === 'approved' ? '✓ Đã duyệt' : '✗ Từ chối'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'feedback' ? (
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white text-base font-semibold">Phản hồi từ người dùng</h2>
            <Button size="small" icon={<ReloadOutlined />} onClick={loadFeedbacks} loading={feedbacksLoading}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
              Tải lại
            </Button>
          </div>

          <Table
            dataSource={feedbacks}
            loading={feedbacksLoading}
            rowKey="id"
            pagination={{ pageSize: 10, size: 'small' }}
            scroll={{ x: 800 }}
            className="feedback-table"
            columns={[
              {
                title: 'Thời gian',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 160,
                render: (date) => <span className="text-[#888] text-xs">{formatDate(date)}</span>,
                sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
                defaultSortOrder: 'descend',
              },
              {
                title: 'Loại',
                dataIndex: 'type',
                key: 'type',
                width: 100,
                render: (type: string) => {
                  const colors: Record<string, string> = { bug: 'red', feature: 'blue', other: 'default' }
                  const labels: Record<string, string> = { bug: 'Lỗi', feature: 'Tính năng', other: 'Khác' }
                  return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>
                },
                filters: [
                  { text: 'Lỗi', value: 'bug' },
                  { text: 'Tính năng', value: 'feature' },
                  { text: 'Khác', value: 'other' },
                ],
                onFilter: (value, record) => record.type === value,
              },
              {
                title: 'Người gửi',
                dataIndex: 'name',
                key: 'name',
                width: 150,
                render: (name) => <span className="text-white font-medium">{name || 'Ẩn danh'}</span>,
              },
              {
                title: 'Nội dung',
                dataIndex: 'message',
                key: 'message',
                render: (msg) => <div className="text-[#aaa] max-w-md whitespace-pre-wrap">{msg}</div>,
              },
              {
                title: 'Thao tác',
                key: 'action',
                width: 80,
                fixed: 'right',
                render: (_, record) => (
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => handleDeleteFeedback(record)}
                  />
                ),
              },
            ]}
          />
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
                className={`group relative bg-[#1a1a1a] border rounded-xl overflow-hidden transition-all duration-200 ${
                  selectedPaths.has(item.fullPath) 
                    ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                    : 'border-[#2a2a2a] hover:border-[#444]'
                }`}
              >
                {/* Thumbnail */}
                <div
                  className="relative cursor-pointer"
                  onClick={() => {
                    if (selectedPaths.size > 0) toggleSelect(item.fullPath)
                    else if (!brokenPaths.has(item.fullPath)) setPreviewItem(item)
                  }}
                >
                  {item.type === 'photo' ? (
                    brokenPaths.has(item.fullPath) ? (
                      <div className="w-full aspect-3/4 bg-[#111] flex flex-col items-center justify-center text-[#333] gap-2">
                        <CloseOutlined style={{ fontSize: 24 }} />
                        <span className="text-[10px] uppercase">File missing</span>
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full aspect-3/4 object-cover"
                        loading="lazy"
                        onError={() => setBrokenPaths(prev => new Set(prev).add(item.fullPath))}
                      />
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
                          <video 
                            src={item.url} 
                            className="w-full h-full object-cover" 
                            onError={() => setBrokenPaths(prev => new Set(prev).add(item.fullPath))}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <PlayCircleOutlined className="text-white text-4xl" />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Checkbox indicator */}
                  <div 
                    className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedPaths.has(item.fullPath)
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-black/40 border-white/40 opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item.fullPath); }}
                  >
                    {selectedPaths.has(item.fullPath) && <CheckOutlined className="text-white text-[10px]" />}
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[#666] text-[10px] truncate">{formatDate(item.timeCreated)}</p>
                  <p className="text-white text-[10px]">{formatBytes(item.size)}</p>
                </div>

                {/* Actions btn */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  {item.type === 'photo' && (
                    <Tooltip title="In ảnh">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePrint(item); }}
                        className="bg-black/70 hover:bg-green-600 text-white rounded-lg p-1.5"
                      >
                        <PictureOutlined />
                      </button>
                    </Tooltip>
                  )}
                  
                  <Tooltip title="Xóa">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                      disabled={deletingPath === item.fullPath}
                      className="bg-black/70 hover:bg-red-600 text-white rounded-lg p-1.5"
                    >
                      {deletingPath === item.fullPath
                        ? <Spin size="small" />
                        : <DeleteOutlined />}
                    </button>
                  </Tooltip>
                </div>
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
        width={940}
        styles={{
          body: { background: '#1a1a1a', color: '#e5e5e5' },
          header: { background: '#1a1a1a' },
          footer: { background: '#1a1a1a' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div className="flex flex-col md:flex-row gap-6 py-2">
          {/* Left - Slot Editor */}
          <div className="flex-1 min-w-0">
            {uploadPreviewUrl ? (
              <FrameSlotEditor 
                imageUrl={uploadPreviewUrl} 
                slots={uploadSlotsData} 
                onChange={setUploadSlotsData} 
              />
            ) : (
              <div
                className="border-2 border-dashed border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center gap-2 py-20 text-[#3a3a3a] cursor-pointer hover:border-[#444] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <PictureOutlined style={{ fontSize: 36 }} />
                <span className="text-xs">Chọn file PNG để bắt đầu</span>
              </div>
            )}
          </div>

          {/* Right - Form */}
          <div className="w-80 flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,image/png"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
            />

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Tên Khung *</label>
              <Input
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                placeholder="Ví dụ: HelloKitty, Y2K..."
                style={{ background: '#111', borderColor: '#222', color: '#e5e5e5' }}
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Danh Mục *</label>
              <Input
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
                placeholder="Ví dụ: Frame Basic, Frame Cartoon..."
                list="known-categories"
                style={{ background: '#111', borderColor: '#222', color: '#e5e5e5' }}
              />
              <datalist id="known-categories">
                <option value="Frame Basic" />
                <option value="Frame Cartoon" />
                <option value="Frame Amazing ⭐️" />
                <option value="Frame IDOL Hoạt Họa" />
              </datalist>
            </div>

            {/* Slot count info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Số Slot</label>
                <div className="bg-[#111] border border-[#222] rounded px-3 py-1.5 text-white font-bold h-8 flex items-center">
                  {uploadSlotsData.length}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Loại</label>
                <Select
                  value={uploadFrameType}
                  onChange={setUploadFrameType}
                  options={[
                    { value: 'square', label: 'square' },
                    { value: 'bigrectangle', label: 'tall' },
                    { value: 'grid', label: 'grid' },
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!previewItem}
        onCancel={() => setPreviewItem(null)}
        footer={null}
        centered
        width={previewItem ? (previewItem.type === 'video' ? 720 : 420) : 420}
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
          <div className="flex gap-2 items-center">
            {previewItem?.sessionId && (
              <a href={`/session/${previewItem.sessionId}`} target="_blank" rel="noopener noreferrer"
                className="text-[#4da6ff] hover:text-white text-xs underline transition-colors"
              >
                Trang Session ↗
              </a>
            )}
            <a href={previewItem?.url} target="_blank" rel="noopener noreferrer"
              className="text-[#555] hover:text-white text-xs underline transition-colors border-l border-[#333] pl-2 ml-1"
            >
              File gốc ↗
            </a>
            <button
              onClick={() => { if (previewItem) handleDelete(previewItem); setPreviewItem(null) }}
              className="text-red-500 hover:text-red-400 text-xs transition-colors border-l border-[#333] pl-2 ml-1"
            >
              Xóa
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit frame modal */}
      <Modal
        open={!!editingFrame}
        onCancel={() => setEditingFrame(null)}
        title={<span className="text-[#aaa] text-sm font-medium">Chỉnh Sửa Khung</span>}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditingFrame(null)} style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}>
              Hủy
            </Button>
            <Button
              type="primary"
              onClick={handleSaveEdit}
              loading={editSaving}
              disabled={!editName.trim() || !editCategory.trim()}
            >
              Lưu
            </Button>
          </div>
        }
        centered
        width={940}
        styles={{
          body: { background: '#1a1a1a', color: '#e5e5e5' },
          header: { background: '#1a1a1a' },
          footer: { background: '#1a1a1a' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div className="flex flex-col md:flex-row gap-6 py-2">
          {/* Left - Slot Editor */}
          <div className="flex-1 min-w-0">
            {editingFrame && (
              <FrameSlotEditor 
                imageUrl={frameImageUrl(editingFrame.filename, editingFrame.storageUrl)} 
                slots={editSlotsData} 
                onChange={setEditSlotsData} 
              />
            )}
          </div>

          {/* Right - Form */}
          <div className="w-80 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Tên Khung</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ background: '#111', borderColor: '#222', color: '#e5e5e5' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Danh Mục</label>
              <Input value={editCategory} onChange={e => setEditCategory(e.target.value)}
                list="edit-categories"
                style={{ background: '#111', borderColor: '#222', color: '#e5e5e5' }} />
              <datalist id="edit-categories">
                <option value="Frame Basic" />
                <option value="Frame Cartoon" />
                <option value="Frame Amazing ⭐️" />
                <option value="Frame IDOL Hoạt Họa" />
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Số Slot</label>
                <div className="bg-[#111] border border-[#222] rounded px-3 py-1.5 text-white font-bold h-8 flex items-center">
                  {editSlotsData.length}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[#888] text-xs font-semibold uppercase tracking-wider">Loại</label>
                <Select value={editFrameType} onChange={setEditFrameType}
                  options={[
                    { value: 'square', label: 'square' },
                    { value: 'bigrectangle', label: 'bigrectangle' },
                    { value: 'grid', label: 'grid' },
                  ]} />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Request preview modal */}
      <Modal
        open={!!previewRequest}
        onCancel={() => setPreviewRequest(null)}
        title={<span className="text-[#aaa] text-sm font-normal">{previewRequest?.suggestedName}</span>}
        footer={
          previewRequest?.status === 'pending' ? (
            <div className="flex justify-end gap-2">
              <Button danger onClick={() => { handleRejectRequest(previewRequest!); setPreviewRequest(null) }}
                icon={<CloseOutlined />}>Từ chối</Button>
              <Button type="primary" onClick={() => { handleApproveRequest(previewRequest!); setPreviewRequest(null) }}
                icon={<CheckOutlined />}>Duyệt</Button>
            </div>
          ) : null
        }
        centered
        width={360}
        styles={{
          body: { background: '#111', padding: 0 },
          header: { background: '#111', borderBottom: '1px solid #1f1f1f' },
          footer: { background: '#111' },
        }}
      >
        {previewRequest && (
          <>
            <img src={previewRequest.storageUrl} alt={previewRequest.suggestedName} className="w-full" />
            <div className="p-3 flex flex-col gap-1">
              <p className="text-[#888] text-xs">Danh mục: <span className="text-white">{previewRequest.suggestedCategory}</span></p>
              <p className="text-[#888] text-xs">Slot: <span className="text-white">{previewRequest.slots}</span> · {previewRequest.suggestedFrame}</p>
              <p className="text-[#888] text-xs">Từ: <span className="text-white">{previewRequest.submitterName || 'Ẩn danh'}</span> · {previewRequest.submitterContact}</p>
              {previewRequest.note && <p className="text-[#888] text-xs">Ghi chú: <span className="text-[#aaa]">{previewRequest.note}</span></p>}
              <p className="text-white text-[10px]">{previewRequest.submittedAt ? new Date(previewRequest.submittedAt).toLocaleString('vi-VN') : ''}</p>
            </div>
          </>
        )}
      </Modal>

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <Modal
          title={<span><UserOutlined /> Quyền cho {editingAdmin.email}</span>}
          open={!!editingAdmin}
          onCancel={() => setEditingAdmin(null)}
          footer={null}
          centered
          width={600}
        >
          <Form
            layout="vertical"
            initialValues={{
              ...editingAdmin.permissions,
              photoDateRange: editingAdmin.permissions.photoDateRange ? [dayjs(editingAdmin.permissions.photoDateRange.start), dayjs(editingAdmin.permissions.photoDateRange.end)] : null,
              videoDateRange: editingAdmin.permissions.videoDateRange ? [dayjs(editingAdmin.permissions.videoDateRange.start), dayjs(editingAdmin.permissions.videoDateRange.end)] : null,
            }}
            onFinish={handleSaveAdmin}
          >
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="canViewPhotos" valuePropName="checked">
                <Checkbox>Xem ảnh</Checkbox>
              </Form.Item>
              <Form.Item name="canViewVideos" valuePropName="checked">
                <Checkbox>Xem video</Checkbox>
              </Form.Item>
              <Form.Item name="canManageFrames" valuePropName="checked">
                <Checkbox>Quản lý khung</Checkbox>
              </Form.Item>
              <Form.Item name="canManageRequests" valuePropName="checked">
                <Checkbox>Duyệt đề xuất</Checkbox>
              </Form.Item>
              <Form.Item name="canManageFeedback" valuePropName="checked">
                <Checkbox>Góp ý</Checkbox>
              </Form.Item>
              <Form.Item name="canManageAdmins" valuePropName="checked">
                <Checkbox>Quản lý Admin</Checkbox>
              </Form.Item>
            </div>

            <div className="mt-4 border-t border-[#333] pt-4">
              <p className="text-[#888] text-xs font-semibold mb-4 uppercase tracking-wider">Giới hạn thời gian truy cập</p>
              <Form.Item name="photoDateRange" label="Khoảng thời gian được xem Ảnh">
                <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
              </Form.Item>
              <Form.Item name="videoDateRange" label="Khoảng thời gian được xem Video">
                <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
              </Form.Item>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setEditingAdmin(null)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={adminSaving}>Lưu thiết lập</Button>
            </div>
          </Form>
        </Modal>
      )}

      {/* Add Admin Modal */}
      <Modal
        title={<span><UserOutlined /> Tạo tài khoản Admin mới</span>}
        open={showAddAdminModal}
        onCancel={() => setShowAddAdminModal(false)}
        footer={null}
        centered
        width={500}
      >
        <Form
          layout="vertical"
          onFinish={handleCreateAdmin}
          initialValues={DEFAULT_PERMISSIONS}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 p-4 bg-[#111] rounded border border-[#222]">
            <Form.Item name="canViewPhotos" valuePropName="checked" className="mb-0">
              <Checkbox>Xem ảnh</Checkbox>
            </Form.Item>
            <Form.Item name="canViewVideos" valuePropName="checked" className="mb-0">
              <Checkbox>Xem video</Checkbox>
            </Form.Item>
            <Form.Item name="canManageFrames" valuePropName="checked" className="mb-0">
              <Checkbox>Quản lý khung</Checkbox>
            </Form.Item>
            <Form.Item name="canManageRequests" valuePropName="checked" className="mb-0">
              <Checkbox>Duyệt đề xuất</Checkbox>
            </Form.Item>
            <Form.Item name="canManageFeedback" valuePropName="checked" className="mb-0">
              <Checkbox>Góp ý</Checkbox>
            </Form.Item>
            <Form.Item name="canManageAdmins" valuePropName="checked" className="mb-0">
              <Checkbox>Quản lý Admin</Checkbox>
            </Form.Item>
          </div>

          <div className="mt-4 border-t border-[#333] pt-4">
            <p className="text-[#888] text-xs font-semibold mb-3 uppercase tracking-wider">Giới hạn thời gian truy cập</p>
            <Form.Item name="photoDateRange" label="Khoảng thời gian được xem Ảnh">
              <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
            </Form.Item>
            <Form.Item name="videoDateRange" label="Khoảng thời gian được xem Video">
              <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
            </Form.Item>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setShowAddAdminModal(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={addAdminLoading}>Tạo tài khoản</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
