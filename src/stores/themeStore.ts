import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

// Read initial theme from localStorage or default to 'dark'
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('pb-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* noop */ }
  return 'dark'
}

// Apply theme class to <html> element
function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
  try { localStorage.setItem('pb-theme', theme) } catch { /* noop */ }
}

// Apply on load
applyTheme(getInitialTheme())

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
}))

/**
 * Helper: returns the first class if dark, second if light.
 * Usage: tc('bg-[#0a0a0a]', 'bg-white')
 */
export function useThemeClass() {
  const theme = useThemeStore(s => s.theme)
  return (dark: string, light: string) => theme === 'dark' ? dark : light
}
