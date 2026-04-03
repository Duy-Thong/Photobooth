import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Modal, Button, Spin, Empty, Tooltip, Input, Select } from 'antd'
import { PictureOutlined, DeleteOutlined, ReloadOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import { FrameItem, fetchCustomFrames, uploadFrame, deleteCustomFrame, frameImageUrl } from '@/lib/frameService'
import FrameSlotEditor from '@/components/admin/FrameSlotEditor'
import FrameEditModal from '@/components/admin/FrameEditModal'
import { detectFrameSlots, getLayoutFromSlots } from '@/lib/imageProcessing'
import type { SlotRect } from '@/types/photobooth'
import { useAdminAuth } from '@/hooks/useAdminAuth'

const { Option } = Select

export default function FrameManager() {
  const { role, studioId, permissions } = useAdminAuth()
  const isSuperAdmin = role === 'superadmin'

  const [frames, setFrames] = useState<FrameItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'shared' | 'mine'>('all')

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [isOtherCategory, setIsOtherCategory] = useState(false)
  const [uploadLayout, setUploadLayout] = useState('')
  const [uploadFrameType, setUploadFrameType] = useState('vertical')
  const [uploadSlotsData, setUploadSlotsData] = useState<SlotRect[]>([])
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [detectingSlots, setDetectingSlots] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingFrame, setEditingFrame] = useState<FrameItem | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFrames = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCustomFrames(studioId || undefined, isSuperAdmin)
      setFrames(data)
    } finally {
      setLoading(false)
    }
  }, [studioId, isSuperAdmin])

  useEffect(() => {
    loadFrames()
  }, [loadFrames])

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
      setUploadLayout(getLayoutFromSlots(slots))
    } catch {
      Modal.error({ title: 'Lỗi detect slots', centered: true })
    } finally {
      setDetectingSlots(false)
    }
  }

  const handleCloseModal = () => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    setShowUploadModal(false)
    setUploadFile(null)
    setUploadPreviewUrl(null)
    setUploadSlotsData([])
    setUploadName('')
    setUploadCategory('')
    setIsOtherCategory(false)
    setUploadLayout('')
    setUploadFrameType('vertical')
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !uploadCategory.trim()) return
    setUploading(true)
    try {
      const frame = await uploadFrame(uploadFile, {
        name: uploadName.trim(),
        categoryName: uploadCategory.trim(),
        slots: uploadSlotsData.length,
        slots_data: uploadSlotsData,
        layout: uploadLayout || getLayoutFromSlots(uploadSlotsData),
        frame: uploadFrameType,
        studioId: isSuperAdmin ? 'shared' : studioId || 'shared'
      })
      setFrames(prev => [...prev, frame].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      handleCloseModal()
      Modal.success({ title: 'Upload thành công', centered: true })
    } catch {
      Modal.error({ title: 'Upload thất bại', content: 'Kiểm tra quyền kết nối Firebase.', centered: true })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (frame: FrameItem) => {
    Modal.confirm({
      title: 'Xóa khung này?',
      content: frame.name,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        setDeletingId(frame.firestoreId!)
        try {
          await deleteCustomFrame(frame.firestoreId!, frame.filename)
          setFrames(prev => prev.filter(f => f.firestoreId !== frame.firestoreId))
        } catch {
          Modal.error({ title: 'Không thể xóa', centered: true })
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  const openEdit = (frame: FrameItem) => setEditingFrame(frame)

  const handleFrameSaved = (updated: FrameItem) => {
    setFrames(prev => prev.map(f => f.firestoreId === updated.firestoreId ? updated : f))
  }

  // Lọc frame
  const displayedFrames = frames.filter(f => {
    if (filterMode === 'shared') return f.studioId === 'shared' || !f.studioId
    if (filterMode === 'mine') return f.studioId === studioId
    return true
  })

  // Unique categories for the dropdown
  const availableCategories = useMemo(() => Array.from(new Set(frames.map(f => f.categoryName))).sort(), [frames])

  // Group by category for display
  const displayCategories = Array.from(new Set(displayedFrames.map(f => f.categoryName)))

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
           <h2 className="text-white text-lg font-bold">Quản Lý Khung (Frames)</h2>
           <div className="flex bg-[#111] p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-[#888] hover:text-white'}`}
              >Tất cả</button>
              <button 
                onClick={() => setFilterMode('shared')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${filterMode === 'shared' ? 'bg-blue-600 text-white' : 'text-[#888] hover:text-white'}`}
              >Khung chung</button>
              {role === 'studio' && (
                <button 
                  onClick={() => setFilterMode('mine')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${filterMode === 'mine' ? 'bg-blue-600 text-white' : 'text-[#888] hover:text-white'}`}
                >Của tiệm tôi</button>
              )}
           </div>
        </div>
        
        <div className="flex items-center gap-2">
           <Button icon={<ReloadOutlined />} onClick={loadFrames} loading={loading} style={{ background: '#111', borderColor: '#333', color: 'white' }}>Làm mới</Button>
           {(!permissions || permissions.canManageFrames || role === 'studio') && (
             <Button type="primary" onClick={() => setShowUploadModal(true)} style={{ background: '#2563eb', border: 'none' }}>Tải lên Khung mới</Button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {loading ? (
           <div className="flex items-center justify-center h-40"><Spin size="large" /></div>
        ) : displayCategories.length === 0 ? (
           <Empty description={<span className="text-[#666]">Chưa có khung nào được tải lên</span>} className="mt-20" />
        ) : (
          displayCategories.map(cat => {
            const catFrames = displayedFrames.filter(f => f.categoryName === cat)
            return (
              <div key={cat}>
                <h3 className="text-white text-base font-bold mb-4 flex items-center gap-2">
                  {cat || 'Chưa phân loại'}
                  <span className="text-[#444] text-xs font-normal">({catFrames.length})</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {catFrames.map(frame => {
                    const isMine = frame.studioId === studioId
                    const canEdit = isSuperAdmin || isMine

                    return (
                      <div key={frame.firestoreId} className="group relative bg-[#111] border border-white/5 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300">

                        <div className="aspect-[3/4] bg-black flex items-center justify-center p-2 relative">
                          <img src={frameImageUrl(frame.filename, frame.storageUrl)} alt={frame.name} className="w-full h-full object-contain filter group-hover:brightness-110 transition-all" loading="lazy" />
                        </div>
                        <div className="p-3">
                          <p className="text-white text-xs font-bold truncate mb-1">{frame.name}</p>
                          <p className="text-[#888] text-[10px]">{frame.slots} slots • {frame.frame || 'vertical'}</p>
                        </div>
                        
                        {canEdit && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                            <Tooltip title="Chỉnh sửa">
                              <button onClick={() => openEdit(frame)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/80 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors backdrop-blur-md">
                                <EditOutlined />
                              </button>
                            </Tooltip>
                            <Tooltip title="Xóa">
                              <button onClick={() => handleDelete(frame)} disabled={deletingId === frame.firestoreId} className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/80 text-red-400 hover:bg-red-500 hover:text-white transition-colors backdrop-blur-md">
                                {deletingId === frame.firestoreId ? <Spin size="small" /> : <DeleteOutlined />}
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      <Modal
        open={showUploadModal}
        onCancel={handleCloseModal}
        title={<span className="text-white text-lg font-bold tracking-tight">Tải Lên Khung {isSuperAdmin ? 'Dùng Chung' : 'Của Bạn'}</span>}
        footer={null}
        width={940}
        destroyOnClose
        className="dark-modal"
        styles={{
          body: { background: '#0a0a0a', padding: 24 },
          header: { background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '16px 24px' }
        }}
        closeIcon={<CloseOutlined className="text-white" />}
      >
        <div className="flex flex-col md:flex-row gap-8">
           <div className="flex-1">
             {uploadPreviewUrl ? (
               <div className="bg-[#111] rounded-2xl p-4 border border-white/5">
                 <FrameSlotEditor imageUrl={uploadPreviewUrl} slots={uploadSlotsData} onChange={setUploadSlotsData} />
               </div>
             ) : (
               <div onClick={() => fileInputRef.current?.click()} className="aspect-square w-full max-w-sm mx-auto border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
                  <PictureOutlined className="text-4xl text-[#444]" />
                  <span className="text-white/60 font-medium">Bấm để chọn file ảnh PNG</span>
               </div>
             )}
             <input ref={fileInputRef} type="file" accept=".png,image/png" className="hidden" onChange={e => handleFileSelect(e.target.files![0])} />
           </div>

           <div className="w-80 flex flex-col gap-5 shrink-0">
             <div>
                <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Tên Khung *</label>
                <Input value={uploadName} onChange={e => setUploadName(e.target.value)} className="bg-[#111] border-white/10 text-white h-10 rounded-xl" placeholder="Ví dụ: Birthday Y2K" />
             </div>
              <div>
                 <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Danh mục *</label>
                 <Select 
                   value={isOtherCategory ? 'other' : uploadCategory} 
                   onChange={v => {
                     if (v === 'other') {
                       setIsOtherCategory(true)
                       setUploadCategory('')
                     } else {
                       setIsOtherCategory(false)
                       setUploadCategory(v)
                     }
                   }} 
                   className="w-full bg-[#111] border-white/10 text-white h-10 rounded-xl" 
                   popupClassName="dark-modal"
                   placeholder="Chọn danh mục..."
                 >
                   {availableCategories.map(c => <Option key={c} value={c}>{c}</Option>)}
                   <Option value="other" className="text-blue-400 font-bold italic">+ Khác (Tự nhập)</Option>
                 </Select>
                 {isOtherCategory && (
                    <Input 
                      autoFocus
                      className="mt-2 bg-[#111] border-white/10 text-white h-10 rounded-xl" 
                      placeholder="Nhập tên danh mục mới..." 
                      value={uploadCategory}
                      onChange={e => setUploadCategory(e.target.value)}
                    />
                 )}
              </div>
             <div>
                <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Loại bố cục (Option)</label>
                <Input value={uploadLayout} onChange={e => setUploadLayout(e.target.value)} className="bg-[#111] border-white/10 text-white h-10 rounded-xl" placeholder="Ví dụ: 1x4, 2x2" />
             </div>
             <div>
                <label className="block text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Loại Cắt Khung</label>
                <Select value={uploadFrameType} onChange={setUploadFrameType} className="w-full text-white" popupClassName="dark-modal" style={{ height: 40 }}>
                  <Option value="vertical">Khung 1x4 dọc in (Strip)</Option>
                  <Option value="square">Khung Vuông (Square)</Option>
                  <Option value="grid">Khung Lưới (Grid)</Option>
                  <Option value="bigrectangle">Khung Chữ Nhật To</Option>
                </Select>
             </div>

             <Button 
               type="primary" 
               size="large" 
               onClick={handleUpload} 
               loading={uploading} 
               disabled={!uploadFile || !uploadName || !uploadCategory || detectingSlots}
               className="mt-4 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 border-none font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)]"
             >
               Lưu Khung (Khởi tạo)
             </Button>
           </div>
        </div>
      </Modal>

      <FrameEditModal
        frame={editingFrame}
        categories={availableCategories}
        onClose={() => setEditingFrame(null)}
        onSaved={handleFrameSaved}
      />
    </div>
  )
}
