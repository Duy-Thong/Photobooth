import { Modal } from 'antd'
import { SafetyCertificateOutlined, LockOutlined, CloudServerOutlined, ControlOutlined } from '@ant-design/icons'
import { useThemeClass } from '@/stores/themeStore'

interface PrivacyNoticeModalProps {
  open: boolean
  onClose: () => void
}

export default function PrivacyNoticeModal({ open, onClose }: PrivacyNoticeModalProps) {
  const tc = useThemeClass()

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <SafetyCertificateOutlined className="text-emerald-400 text-lg sm:text-xl" />
          <span className={`font-bold text-base sm:text-lg tracking-tight ${tc('text-white', 'text-black')}`}>
            Cam Kết Quyền Riêng Tư &amp; Bảo Bật
          </span>
        </div>
      }
      footer={
        <div className="flex justify-center items-center w-full">
          <button
            onClick={onClose}
            className={`px-8 h-11 sm:h-12 rounded-2xl font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl cursor-pointer ${tc(
              'bg-white text-black hover:bg-[#ececec]',
              'bg-black text-white hover:bg-[#222]'
            )}`}
          >
            Tôi đã hiểu &amp; Bắt đầu chụp ảnh 📸
          </button>
        </div>
      }
      width={520}
      centered
      styles={{
        body: {
          background: tc('#111111', '#ffffff') === '#111111' ? '#111111' : '#ffffff',
          padding: '16px 20px 20px',
        },
        header: {
          background: tc('#111111', '#ffffff') === '#111111' ? '#111111' : '#ffffff',
          borderBottom: `1px solid ${tc('#1f1f1f', '#f0f0f0') === '#1f1f1f' ? '#1f1f1f' : '#f0f0f0'}`,
          paddingBottom: '14px',
        },
        footer: {
          background: tc('#111111', '#ffffff') === '#111111' ? '#111111' : '#ffffff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderTop: 'none',
          paddingTop: '8px',
        },
      }}
    >
      <div className="flex flex-col gap-4 py-2">
        <p className={`text-xs sm:text-sm leading-relaxed ${tc('text-[#ccc]', 'text-[#444]')}`}>
          Chào mừng bạn đến với <strong className={tc('text-white', 'text-black')}>Sổ Media Photobooth</strong>! Trước khi bắt đầu tạo những bộ ảnh xinh xắn, chúng tôi muốn bạn hoàn toàn an tâm về quyền riêng tư của mình:
        </p>

        {/* Reassurance Points */}
        <div className="flex flex-col gap-3">
          {/* Point 1 */}
          <div className={`p-3 rounded-2xl border flex items-start gap-3 ${tc('bg-[#161616] border-[#262626]', 'bg-[#f7f7f7] border-[#e0e0e0]')}`}>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <LockOutlined className="text-base" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-xs sm:text-sm font-bold ${tc('text-white', 'text-black')}`}>
                1. Xử lý 100% trực tiếp trên thiết bị của bạn
              </span>
              <span className={`text-[11px] sm:text-xs leading-relaxed ${tc('text-[#999]', 'text-[#666]')}`}>
                Hình ảnh từ camera và bộ lọc màu được kết xuất trực tiếp bằng trình duyệt của bạn.
              </span>
            </div>
          </div>

          {/* Point 2 */}
          <div className={`p-3 rounded-2xl border flex items-start gap-3 ${tc('bg-[#161616] border-[#262626]', 'bg-[#f7f7f7] border-[#e0e0e0]')}`}>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
              <CloudServerOutlined className="text-base" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-xs sm:text-sm font-bold ${tc('text-white', 'text-black')}`}>
                2. KHÔNG tự động lưu ảnh lên máy chủ
              </span>
              <span className={`text-[11px] sm:text-xs leading-relaxed ${tc('text-[#999]', 'text-[#666]')}`}>
                Hệ thống mặc định không tự động tải, lưu trữ hay thu thập bất kỳ ảnh cá nhân nào của bạn khi chụp.
              </span>
            </div>
          </div>

          {/* Point 3 */}
          <div className={`p-3 rounded-2xl border flex items-start gap-3 ${tc('bg-[#161616] border-[#262626]', 'bg-[#f7f7f7] border-[#e0e0e0]')}`}>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
              <ControlOutlined className="text-base" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-xs sm:text-sm font-bold ${tc('text-white', 'text-black')}`}>
                3. Toàn quyền kiểm soát trong tay bạn
              </span>
              <span className={`text-[11px] sm:text-xs leading-relaxed ${tc('text-[#999]', 'text-[#666]')}`}>
                Bạn lưu ảnh về máy hoàn toàn miễn phí. Mã QR chia sẻ chỉ được khởi tạo khi bạn chủ động bấm nút "Tạo mã QR" và lưu trữ dưới dạng <strong>riêng tư</strong>.
              </span>
            </div>
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border text-center ${tc('bg-emerald-500/10 border-emerald-500/20 text-emerald-300', 'bg-emerald-50 border-emerald-200 text-emerald-800')}`}>
          <span className="text-[11px] font-semibold">
            🛡️ Bạn đã sẵn sàng chụp những bức ảnh xinh xắn nhất chưa?
          </span>
        </div>
      </div>
    </Modal>
  )
}
