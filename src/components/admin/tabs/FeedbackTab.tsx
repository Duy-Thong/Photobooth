import { useState, useEffect, useCallback } from 'react'
import { Button, Modal, Table, Tag } from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchFeedbacks, deleteFeedback } from '@/lib/feedbackService'
import type { Feedback } from '@/types/feedback'
import { formatDate } from '@/lib/adminUtils'
import { useThemeClass } from '@/stores/themeStore'

interface FeedbackTabProps {
  canDelete: boolean
}

export default function FeedbackTab({ canDelete }: FeedbackTabProps) {
  const tc = useThemeClass()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [feedbacksLoading, setFeedbacksLoading] = useState(false)

  const loadFeedbacks = useCallback(async () => {
    setFeedbacksLoading(true)
    try {
      const data = await fetchFeedbacks()
      setFeedbacks(data)
    } finally {
      setFeedbacksLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeedbacks()
  }, [loadFeedbacks])

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
          setFeedbacks((prev) => prev.filter((f) => f.id !== fb.id))
        } catch {
          Modal.error({ title: 'Xóa thất bại', centered: true })
        }
      },
    })
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h2 className={`font-bold text-lg ${tc('text-white', 'text-slate-900')}`}>Phản hồi từ người dùng</h2>
          <p className={`text-xs ${tc('text-slate-400', 'text-slate-500')}`}>
            Tổng hợp đánh giá, báo lỗi và ý kiến đóng góp
          </p>
        </div>
        <div className="flex-1" />
        <Button size="small" icon={<ReloadOutlined />} onClick={loadFeedbacks} loading={feedbacksLoading}>
          Tải lại
        </Button>
      </div>

      <div className={`rounded-xl border overflow-hidden shadow-xs ${tc('bg-[#141414] border-[#222]', 'bg-white border-slate-200')}`}>
        <Table
          dataSource={feedbacks}
          loading={feedbacksLoading}
          rowKey="id"
          pagination={{ pageSize: 10, size: 'small' }}
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 160,
              render: (date) => (
                <span className={`text-xs ${tc('text-slate-400', 'text-slate-500')}`}>{formatDate(date)}</span>
              ),
              sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
              defaultSortOrder: 'descend',
            },
            {
              title: 'Loại',
              dataIndex: 'type',
              key: 'type',
              width: 110,
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
              render: (name) => (
                <span className={`font-semibold ${tc('text-white', 'text-slate-900')}`}>{name || 'Ẩn danh'}</span>
              ),
            },
            {
              title: 'Nội dung',
              dataIndex: 'message',
              key: 'message',
              render: (msg) => (
                <div className={`text-xs whitespace-pre-wrap max-w-md ${tc('text-slate-300', 'text-slate-700')}`}>
                  {msg}
                </div>
              ),
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 80,
              fixed: 'right',
              render: (_, record) =>
                canDelete ? (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteFeedback(record)}
                  />
                ) : null,
            },
          ]}
        />
      </div>
    </div>
  )
}
