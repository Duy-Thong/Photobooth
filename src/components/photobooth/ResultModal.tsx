import { useEffect, useState } from 'react'
import { Modal, QRCode, Spin, Button } from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { uploadPhotoToFirebase } from '@/lib/uploadService'
import { stampQrOnImage, downloadImage } from '@/lib/imageProcessing'

type Phase = 'uploading' | 'stamping' | 'done' | 'error'

interface ResultModalProps {
  open: boolean
  /** blob URL of the final composited strip (without QR) */
  imageBlobUrl: string | null
  onClose: () => void
  onRetake: () => void
}

export default function ResultModal({ open, imageBlobUrl, onClose, onRetake }: ResultModalProps) {
  const [phase, setPhase] = useState<Phase>('uploading')
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null)
  const [finalWithQr, setFinalWithQr] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !imageBlobUrl) return
    // Reset on each open
    setPhase('uploading')
    setFirebaseUrl(null)
    setFinalWithQr(null)
    setErrorMsg(null)

    let cancelled = false

    async function run() {
      try {
        // Step 1: Upload to Firebase
        const url = await uploadPhotoToFirebase(imageBlobUrl!)
        if (cancelled) return
        setFirebaseUrl(url)

        // Step 2: Stamp QR onto the image
        setPhase('stamping')
        const withQr = await stampQrOnImage(imageBlobUrl!, url)
        if (cancelled) return
        setFinalWithQr(withQr)
        setPhase('done')
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Upload thất bại')
          setPhase('error')
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [open, imageBlobUrl])

  const handleDownload = () => {
    if (finalWithQr) downloadImage(finalWithQr, `some-media-${Date.now()}.jpg`)
    else if (imageBlobUrl) downloadImage(imageBlobUrl, `some-media-${Date.now()}.jpg`)
  }

  const handleRetake = () => {
    onClose()
    onRetake()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span className="text-white font-semibold tracking-tight">
          {phase === 'uploading' && 'Đang tải lên...'}
          {phase === 'stamping' && 'Đang tạo QR...'}
          {phase === 'done' && 'Ảnh của bạn đã sẵn sàng'}
          {phase === 'error' && 'Có lỗi xảy ra'}
        </span>
      }
      footer={
        phase === 'done' ? (
          <div className="flex justify-between items-center">
            <Button
              onClick={handleRetake}
              style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}
            >
              <ReloadOutlined /> Chụp lại
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}
            >
              Tải về
            </Button>
          </div>
        ) : phase === 'error' ? (
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}>
              Đóng
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              style={{ background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #333' }}
            >
              Tải về (không có QR)
            </Button>
          </div>
        ) : null
      }
      width={480}
      centered
      styles={{
        body: { background: '#141414', padding: '16px' },
        header: { background: '#141414', borderBottom: '1px solid #2a2a2a' },
        footer: { background: '#141414', borderTop: '1px solid #2a2a2a' },
      }}
    >
      {/* Loading phases */}
      {(phase === 'uploading' || phase === 'stamping') && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Spin size="large" />
          <p className="text-[#888] text-sm">
            {phase === 'uploading' ? 'Đang upload ảnh lên Firebase...' : 'Đang ghép QR vào ảnh...'}
          </p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <p className="text-[#555] text-xs">Bạn vẫn có thể tải ảnh về (không có QR)</p>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && finalWithQr && firebaseUrl && (
        <div className="flex flex-col items-center gap-5">
          {/* Preview */}
          <img
            src={finalWithQr}
            alt="Final photo"
            className="max-w-full max-h-[360px] object-contain rounded-lg border border-[#2a2a2a]"
          />

          {/* QR standalone for easy scanning */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[#888] text-xs uppercase tracking-widest">Quét để xem & chia sẻ</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCode
                value={firebaseUrl}
                size={140}
                bordered={false}
              />
            </div>
            <p className="text-[#444] text-[10px] max-w-[280px] text-center break-all">{firebaseUrl}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
