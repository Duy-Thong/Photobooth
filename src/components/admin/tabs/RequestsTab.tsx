import { useState, useEffect, useCallback } from 'react'
import { Button, Input, Modal, Select, Spin, Empty, Tag } from 'antd'
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import {
  fetchFrameRequests as fetchFrameRequestsService,
  approveFrameRequest as approveFrameRequestService,
  rejectFrameRequest as rejectFrameRequestService,
  type FrameRequest,
} from '@/lib/frameService'
import { detectFrameSlots, getLayoutFromSlots } from '@/lib/imageProcessing'
import FrameSlotEditor from '@/components/admin/FrameSlotEditor'
import type { SlotRect } from '@/types/photobooth'
import { useThemeClass } from '@/stores/themeStore'
import {
  LAYOUT_OPTIONS,
  FRAME_TYPE_OPTIONS,
  inferFrameType,
} from './FramesTab'

interface RequestsTabProps {
  onFrameApproved: () => void
}

export default function RequestsTab({ onFrameApproved }: RequestsTabProps) {
  const tc = useThemeClass()
  const [requests, setRequests] = useState<FrameRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestStatusFilter, setRequestStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [previewRequest, setPreviewRequest] = useState<FrameRequest | null>(null)

  // Request edit/review modal state
  const [reqSlotsData, setReqSlotsData] = useState<SlotRect[]>([])
  const [reqName, setReqName] = useState('')
  const [reqCategory, setReqCategory] = useState('')
  const [reqLayout, setReqLayout] = useState('1x4')
  const [reqFrameType, setReqFrameType] = useState('vertical')
  const [approvingReq, setApprovingReq] = useState(false)

  const loadRequests = useCallback(
    async (status: typeof requestStatusFilter = requestStatusFilter) => {
      setRequestsLoading(true)
      try {
        const data = await fetchFrameRequestsService(status)
        setRequests(data)
      } finally {
        setRequestsLoading(false)
      }
    },
    [requestStatusFilter],
  )

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleApproveRequest = async (req: FrameRequest) => {
    setProcessingId(req.firestoreId)
    try {
      await approveFrameRequestService(req)
      setRequests((prev) => prev.filter((r) => r.firestoreId !== req.firestoreId))
      onFrameApproved()
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
      onOk: async () => {
        setProcessingId(req.firestoreId)
        try {
          await rejectFrameRequestService(req.firestoreId)
          setRequests((prev) => prev.filter((r) => r.firestoreId !== req.firestoreId))
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  const openPreviewRequest = async (req: FrameRequest) => {
    setPreviewRequest(req)
    setReqName(req.suggestedName || '')
    setReqCategory(req.suggestedCategory || 'Frame Amazing ⭐️')
    let slots = req.slots_data || []
    if (slots.length === 0 && req.storageUrl) {
      try {
        slots = await detectFrameSlots(req.storageUrl)
      } catch {
        slots = []
      }
    }
    setReqSlotsData(slots)
    const ly = req.layout || getLayoutFromSlots(slots)
    setReqLayout(ly)
    setReqFrameType(req.suggestedFrame || inferFrameType(ly, slots))
  }

  const handleReqSlotsChange = (slots: SlotRect[]) => {
    setReqSlotsData(slots)
    const layoutStr = getLayoutFromSlots(slots)
    if (layoutStr && layoutStr !== '0x0') {
      setReqLayout(layoutStr)
      setReqFrameType(inferFrameType(layoutStr, slots))
    }
  }

  const handleApproveCustomRequest = async () => {
    if (!previewRequest) return
    setApprovingReq(true)
    try {
      const layoutToSave = reqLayout || getLayoutFromSlots(reqSlotsData)
      const updatedReq: FrameRequest = {
        ...previewRequest,
        suggestedName: reqName.trim() || previewRequest.suggestedName,
        suggestedCategory: reqCategory.trim() || previewRequest.suggestedCategory,
        slots: reqSlotsData.length,
        slots_data: reqSlotsData,
        layout: layoutToSave,
        suggestedFrame: reqFrameType || inferFrameType(layoutToSave, reqSlotsData),
      }
      await approveFrameRequestService(updatedReq)
      setRequests((prev) => prev.filter((r) => r.firestoreId !== previewRequest.firestoreId))
      onFrameApproved()
      setPreviewRequest(null)
    } catch {
      Modal.error({ title: 'Duyệt thất bại', centered: true })
    } finally {
      setApprovingReq(false)
    }
  }

  return (
    <div className="flex-1 p-6">
      {/* Status filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setRequestStatusFilter(s)
              loadRequests(s)
            }}
            className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
              requestStatusFilter === s
                ? tc('bg-white text-black border-white font-semibold shadow-xs', 'bg-blue-600 text-white border-blue-600 shadow-xs')
                : tc(
                    'border-[#252525] bg-[#111] text-slate-400 hover:border-[#444] hover:text-slate-200',
                    'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                  )
            }`}
          >
            {s === 'pending'
              ? 'Chờ duyệt'
              : s === 'approved'
                ? 'Đã duyệt'
                : s === 'rejected'
                  ? 'Từ chối'
                  : 'Tất cả'}
          </button>
        ))}
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => loadRequests()}
          loading={requestsLoading}
          style={{ marginLeft: 4 }}
        >
          Tải lại
        </Button>
      </div>

      {requestsLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : requests.length === 0 ? (
        <Empty
          description={<span className={tc('text-slate-500', 'text-slate-400')}>Không có đề xuất nào</span>}
          className="mt-20"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {requests.map((req) => (
            <div
              key={req.firestoreId}
              className={`border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all ${tc(
                'bg-[#141414] border-[#262626] hover:border-[#444]',
                'bg-white border-slate-200 hover:border-slate-300',
              )}`}
            >
              <div
                className={`flex items-center justify-center aspect-3/4 cursor-pointer p-2 ${tc(
                  'bg-[#0a0a0a]',
                  'bg-slate-50',
                )}`}
                onClick={() => openPreviewRequest(req)}
              >
                <img
                  src={req.storageUrl}
                  alt={req.suggestedName}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-3 flex flex-col gap-0.5">
                <p className={`font-semibold text-xs truncate ${tc('text-white', 'text-slate-900')}`}>
                  {req.suggestedName}
                </p>
                <p className={`text-[11px] truncate ${tc('text-slate-400', 'text-slate-500')}`}>
                  {req.suggestedCategory}
                </p>
                <p className={`text-[10px] ${tc('text-slate-500', 'text-slate-400')}`}>
                  {req.slots} slot · {req.suggestedFrame}
                </p>
                <p className={`text-[10px] truncate mt-0.5 ${tc('text-slate-500', 'text-slate-400')}`}>
                  {req.submitterContact}
                </p>
                <p className={`text-[10px] ${tc('text-slate-600', 'text-slate-400')}`}>
                  {new Date(req.submittedAt).toLocaleDateString('vi-VN')}
                </p>
              </div>

              {req.status === 'pending' && (
                <div className={`flex border-t ${tc('border-[#222]', 'border-slate-100')}`}>
                  <button
                    onClick={() => handleApproveRequest(req)}
                    disabled={processingId === req.firestoreId}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                  >
                    {processingId === req.firestoreId ? (
                      <Spin size="small" />
                    ) : (
                      <>
                        <CheckOutlined /> Duyệt
                      </>
                    )}
                  </button>
                  <div className={`w-px ${tc('bg-[#222]', 'bg-slate-100')}`} />
                  <button
                    onClick={() => handleRejectRequest(req)}
                    disabled={processingId === req.firestoreId}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <CloseOutlined /> Từ chối
                  </button>
                </div>
              )}
              {req.status !== 'pending' && (
                <div
                  className={`text-center py-2 text-xs font-medium ${
                    req.status === 'approved' ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {req.status === 'approved' ? '✓ Đã duyệt' : '✗ Từ chối'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request preview / review modal */}
      <Modal
        open={!!previewRequest}
        onCancel={() => setPreviewRequest(null)}
        title={
          <div className="flex items-center gap-2">
            <span>Duyệt Đề Xuất Khung: {previewRequest?.suggestedName}</span>
            {previewRequest?.status === 'approved' && <Tag color="success">Đã duyệt</Tag>}
            {previewRequest?.status === 'rejected' && <Tag color="error">Đã từ chối</Tag>}
            {previewRequest?.status === 'pending' && <Tag color="processing">Chờ duyệt</Tag>}
          </div>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setPreviewRequest(null)}>Đóng</Button>
            {previewRequest?.status === 'pending' && (
              <>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => {
                    handleRejectRequest(previewRequest!)
                    setPreviewRequest(null)
                  }}
                >
                  Từ chối
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={approvingReq}
                  disabled={!reqName.trim() || !reqCategory.trim()}
                  onClick={handleApproveCustomRequest}
                >
                  Duyệt & Xuất Bản
                </Button>
              </>
            )}
          </div>
        }
        centered
        width="min(1240px, 96vw)"
        styles={{
          body: { maxHeight: 'calc(90vh - 100px)', overflow: 'hidden', padding: '16px 20px' },
        }}
      >
        {previewRequest && (
          <div className="flex flex-col md:flex-row gap-6 h-[70vh] max-h-[640px] overflow-hidden py-1">
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
              <FrameSlotEditor
                imageUrl={previewRequest.storageUrl}
                slots={reqSlotsData}
                onChange={handleReqSlotsChange}
              />
            </div>

            <div className="w-80 shrink-0 flex flex-col gap-3.5 h-full overflow-y-auto pr-1">
              <div
                className={`p-3 rounded-xl border flex flex-col gap-1.5 ${tc(
                  'bg-[#101010] border-[#222]',
                  'bg-slate-50 border-slate-200',
                )}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${tc('text-slate-400', 'text-slate-500')}`}>
                    Người đóng góp
                  </span>
                  <span className={`text-[10px] ${tc('text-slate-500', 'text-slate-400')}`}>
                    {new Date(previewRequest.submittedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-semibold ${tc('text-white', 'text-slate-900')}`}>
                    {previewRequest.submitterName || 'Ẩn danh'}
                  </span>
                  <span className={`text-xs font-mono truncate ${tc('text-blue-400', 'text-blue-600')}`}>
                    {previewRequest.submitterContact}
                  </span>
                </div>
                {previewRequest.note && (
                  <div className={`mt-1 pt-1.5 border-t text-[11px] ${tc('border-[#222] text-slate-300', 'border-slate-200 text-slate-600')}`}>
                    <span className="font-semibold">Ghi chú:</span> {previewRequest.note}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                  Tên Khung *
                </label>
                <Input
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  placeholder="Ví dụ: 1x4, 2x2..."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                  Danh Mục *
                </label>
                <Input
                  value={reqCategory}
                  onChange={(e) => setReqCategory(e.target.value)}
                  list="req-categories"
                  placeholder="Ví dụ: Frame Basic, Frame Cartoon..."
                />
                <datalist id="req-categories">
                  <option value="Frame Basic" />
                  <option value="Frame Cartoon" />
                  <option value="Frame Amazing ⭐️" />
                  <option value="Frame IDOL Hoạt Họa" />
                </datalist>
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                  Layout (Bố cục)
                </label>
                <Select
                  value={reqLayout}
                  onChange={(v) => {
                    setReqLayout(v)
                    setReqFrameType(inferFrameType(v, reqSlotsData))
                  }}
                  placeholder="Chọn bố cục..."
                  options={LAYOUT_OPTIONS}
                  showSearch
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                  Loại khung
                </label>
                <Select
                  value={reqFrameType}
                  onChange={(v) => setReqFrameType(v)}
                  options={FRAME_TYPE_OPTIONS}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                  Số Slot
                </label>
                <div
                  className={`border rounded-lg px-3 py-1.5 font-bold h-8 flex items-center ${tc(
                    'bg-[#050505] border-[#222] text-white',
                    'bg-slate-50 border-slate-200 text-slate-900',
                  )}`}
                >
                  {reqSlotsData.length} slot
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
