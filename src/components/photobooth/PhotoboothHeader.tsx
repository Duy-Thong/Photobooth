import { useThemeClass } from '@/stores/themeStore'
import ThemeToggle from '@/components/photobooth/ThemeToggle'

export default function PhotoboothHeader() {
  const tc = useThemeClass()

  return (
    <header
      className={`py-1.5 md:py-2 px-3 sm:px-8 border-b shrink-0 relative flex items-center justify-between ${tc(
        'border-[#141414]',
        'border-[#e0e0e0]'
      )}`}
    >
      <div className="w-8 hidden sm:block" />

      {/* Title - Absolutely Centered */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <a href="/" className="pointer-events-auto">
          <h1
            className={`text-xl sm:text-2xl font-bold tracking-tight ${tc('text-white', 'text-black')}`}
            style={{ letterSpacing: '-0.03em' }}
          >
            Sổ Media
          </h1>
          <p
            className={`text-[8px] sm:text-[9px] tracking-[0.35em] uppercase font-medium ${tc(
              'text-[#888]',
              'text-[#666]'
            )}`}
          >
            Photobooth
          </p>
        </a>
      </div>

      {/* Theme Toggle Right */}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  )
}
