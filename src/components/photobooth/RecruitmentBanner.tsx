import { UserAddOutlined, ArrowRightOutlined, TeamOutlined } from '@ant-design/icons'
import { useThemeClass } from '@/stores/themeStore'

interface RecruitmentBannerProps {
  variant?: 'card' | 'compact'
  className?: string
}

export const RECRUITMENT_URL = 'https://www.somediaclub.com'

export default function RecruitmentBanner({
  variant = 'card',
  className = '',
}: RecruitmentBannerProps) {
  const tc = useThemeClass()

  if (variant === 'compact') {
    return (
      <a
        href={RECRUITMENT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`group w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs transition-all border ${tc(
          'bg-[#111] border-[#222] text-[#ccc] hover:border-[#333] hover:text-white',
          'bg-white border-[#e0e0e0] text-[#444] hover:border-[#ccc] hover:text-black'
        )} ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${tc('bg-[#1a1a1a] border-[#333] text-white', 'bg-[#f0f0f0] border-[#d0d0d0] text-black')}`}>
            Gen 10
          </span>
          <span className="truncate font-medium text-[11px]">
            Sổ Media đang tuyển thành viên Gen 10
          </span>
        </div>
        <span className="shrink-0 text-[11px] font-semibold flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          Ứng tuyển <ArrowRightOutlined className="text-[9px]" />
        </span>
      </a>
    )
  }

  return (
    <div
      className={`w-full rounded-2xl border p-5 flex flex-col items-center gap-3.5 shadow-xl transition-all ${tc(
        'bg-[#111] border-[#222]',
        'bg-white border-[#e0e0e0]'
      )} ${className}`}
    >
      {/* Badge + Header */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border ${tc(
          'bg-[#1a1a1a] border-[#2e2e2e] text-[#aaa]',
          'bg-[#f5f5f5] border-[#d9d9d9] text-[#666]'
        )}`}>
          Đợt Tuyển Thành Viên
        </span>
        <h3 className={`text-sm font-bold tracking-tight uppercase ${tc('text-white', 'text-black')}`}>
          CLB Sổ Media · Gen 10
        </h3>
        <p className={`text-[11px] leading-relaxed max-w-[260px] ${tc('text-[#888]', 'text-[#666]')}`}>
          Trở thành một phần của Sổ Media — nơi lưu giữ khoảnh khắc và sáng tạo nội dung truyền thông.
        </p>
      </div>

      {/* Mảng tuyển dụng pills */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
        {['Chụp ảnh', 'Quay phim', 'Thiết kế', 'Truyền thông'].map(dept => (
          <span
            key={dept}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono tracking-tight border ${tc(
              'bg-[#141414] border-[#222] text-[#888]',
              'bg-[#f9f9f9] border-[#e8e8e8] text-[#777]'
            )}`}
          >
            {dept}
          </span>
        ))}
      </div>

      {/* Primary Action Button */}
      <a
        href={RECRUITMENT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-[0.98] ${tc(
          'bg-white text-black hover:bg-[#eaeaea]',
          'bg-black text-white hover:bg-[#222]'
        )}`}
      >
        <UserAddOutlined /> Ứng tuyển Gen 10 ngay
      </a>

      {/* Secondary link */}
      <a
        href={RECRUITMENT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[10px] font-medium transition-colors flex items-center gap-1 hover:underline ${tc('text-[#666] hover:text-[#aaa]', 'text-[#888] hover:text-[#444]')}`}
      >
        <TeamOutlined /> Chi tiết tuyển dụng tại somediaclub.com
      </a>
    </div>
  )
}
