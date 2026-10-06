import { memo } from 'react'
import { Button } from 'antd'
import {
  PictureOutlined,
  DownloadOutlined,
  DeleteFilled,
  CloseOutlined,
} from '@ant-design/icons'
import { useThemeClass } from '@/stores/themeStore'

export interface BulkActionBarProps {
  selectedCount: number
  itemType: 'photos' | 'videos'
  canDelete: boolean
  isDownloading?: boolean
  isDeleting?: boolean
  onPrint?: () => void
  onDownload?: () => void
  onDelete?: () => void
  onClear: () => void
}

function BulkActionBarComponent({
  selectedCount,
  itemType,
  canDelete,
  isDownloading = false,
  isDeleting = false,
  onPrint,
  onDownload,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const tc = useThemeClass()

  if (selectedCount === 0) return null

  const label = itemType === 'photos' ? 'ảnh' : 'video'

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 border shadow-sm transition-all animate-in fade-in slide-in-from-top-1 ${tc(
        'bg-[#141414] border-blue-900/60',
        'bg-blue-50/90 border-blue-200',
      )}`}
    >
      <span className={`text-xs font-bold px-1.5 uppercase tracking-wider ${tc('text-blue-400', 'text-blue-600')}`}>
        Đã chọn {selectedCount}
      </span>

      {itemType === 'photos' && onPrint && (
        <Button
          size="small"
          type="primary"
          icon={<PictureOutlined />}
          onClick={onPrint}
          style={{ background: '#10b981', borderColor: '#10b981' }}
          className="font-medium"
        >
          In {selectedCount} ảnh
        </Button>
      )}

      {onDownload && (
        <Button
          size="small"
          type="primary"
          icon={<DownloadOutlined />}
          onClick={onDownload}
          loading={isDownloading}
          style={{ background: '#2563eb', borderColor: '#2563eb' }}
          className="font-medium"
        >
          Tải {selectedCount} {label}
        </Button>
      )}

      {canDelete && onDelete && (
        <Button
          size="small"
          type="primary"
          danger
          icon={<DeleteFilled />}
          onClick={onDelete}
          loading={isDeleting}
          className="font-medium"
        >
          Xóa {selectedCount}
        </Button>
      )}

      <Button
        size="small"
        icon={<CloseOutlined />}
        onClick={onClear}
        className="text-xs"
      >
        Bỏ chọn
      </Button>
    </div>
  )
}

export const BulkActionBar = memo(BulkActionBarComponent)
