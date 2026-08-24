import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import { Analytics } from '@vercel/analytics/react'
import { router } from './router'
import { useThemeStore } from './stores/themeStore'

const darkTokens = {
  colorPrimary: '#3b82f6',
  colorBgBase: '#000000',
  colorBgContainer: '#0a0a0a',
  colorBgElevated: '#141414',
  colorBorder: '#222222',
  colorBorderSecondary: '#1a1a1a',
  colorText: '#e5e5e5',
  colorTextSecondary: '#888888',
  colorTextTertiary: '#555555',
  colorTextPlaceholder: '#444444',
  colorSplit: '#1f1f1f',
  borderRadius: 8,
  borderRadiusLG: 12,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
}

const darkComponents = {
  Modal: {
    contentBg: '#141414',
    headerBg: '#141414',
    footerBg: '#141414',
    titleColor: '#ffffff',
  },
  Table: {
    colorBgContainer: '#141414',
    headerBg: '#1a1a1a',
    headerColor: '#e5e5e5',
    rowHoverBg: '#1f1f1f',
    borderColor: '#262626',
  },
  Input: {
    colorBgContainer: '#0a0a0a',
    colorBorder: '#262626',
    colorText: '#e5e5e5',
    colorTextPlaceholder: '#555555',
    activeBorderColor: '#3b82f6',
    hoverBorderColor: '#444444',
    activeShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
  },
  Select: {
    colorBgContainer: '#0a0a0a',
    colorBorder: '#262626',
    colorText: '#e5e5e5',
    optionSelectedBg: '#1f2937',
    optionActiveBg: '#1a1a1a',
    colorBgElevated: '#141414',
  },
  DatePicker: {
    colorBgContainer: '#0a0a0a',
    colorBorder: '#262626',
    colorText: '#e5e5e5',
    colorTextPlaceholder: '#555555',
    colorBgElevated: '#141414',
  },
  Checkbox: {
    colorText: '#e5e5e5',
    colorPrimary: '#3b82f6',
  },
  Button: {
    colorBgContainer: '#1a1a1a',
    colorBorder: '#2a2a2a',
    colorText: '#e5e5e5',
    primaryColor: '#ffffff',
    colorPrimaryHover: '#2563eb',
  },
  Switch: {
    colorPrimary: '#3b82f6',
    colorPrimaryHover: '#60a5fa',
    handleBg: '#ffffff',
  },
  Message: {
    contentBg: '#1a1a1a',
    colorText: '#e5e5e5',
  },
}

const lightTokens = {
  colorPrimary: '#2563eb',
  colorBgBase: '#ffffff',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: '#e2e8f0',
  colorBorderSecondary: '#f1f5f9',
  colorText: '#0f172a',
  colorTextSecondary: '#475569',
  colorTextTertiary: '#94a3b8',
  colorTextPlaceholder: '#94a3b8',
  colorSplit: '#e2e8f0',
  borderRadius: 8,
  borderRadiusLG: 12,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
}

const lightComponents = {
  Modal: {
    contentBg: '#ffffff',
    headerBg: '#ffffff',
    footerBg: '#ffffff',
    titleColor: '#0f172a',
  },
  Table: {
    colorBgContainer: '#ffffff',
    headerBg: '#f8fafc',
    headerColor: '#334155',
    rowHoverBg: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  Input: {
    colorBgContainer: '#ffffff',
    colorBorder: '#cbd5e1',
    colorText: '#0f172a',
    colorTextPlaceholder: '#94a3b8',
    activeBorderColor: '#2563eb',
    hoverBorderColor: '#64748b',
    activeShadow: '0 0 0 2px rgba(37, 99, 235, 0.15)',
  },
  Select: {
    colorBgContainer: '#ffffff',
    colorBorder: '#cbd5e1',
    colorText: '#0f172a',
    optionSelectedBg: '#eff6ff',
    optionActiveBg: '#f8fafc',
    colorBgElevated: '#ffffff',
  },
  DatePicker: {
    colorBgContainer: '#ffffff',
    colorBorder: '#cbd5e1',
    colorText: '#0f172a',
    colorTextPlaceholder: '#94a3b8',
    colorBgElevated: '#ffffff',
  },
  Checkbox: {
    colorText: '#0f172a',
    colorPrimary: '#2563eb',
  },
  Button: {
    colorBgContainer: '#ffffff',
    colorBorder: '#cbd5e1',
    colorText: '#0f172a',
    primaryColor: '#ffffff',
    colorPrimaryHover: '#1d4ed8',
  },
  Switch: {
    colorPrimary: '#2563eb',
    colorPrimaryHover: '#1d4ed8',
    handleBg: '#ffffff',
  },
  Message: {
    contentBg: '#ffffff',
    colorText: '#0f172a',
  },
}

function App() {
  const currentTheme = useThemeStore(s => s.theme)
  const isDark = currentTheme === 'dark'

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDark ? darkTokens : lightTokens,
        components: isDark ? darkComponents : lightComponents,
      }}
    >
      <RouterProvider router={router} />
      <Analytics />
    </ConfigProvider>
  )
}

export default App
