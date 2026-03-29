import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import { Analytics } from '@vercel/analytics/react'
import { router } from './router'
import { useThemeStore } from './stores/themeStore'

const darkTokens = {
  colorPrimary: '#ffffff',
  colorBgBase: '#000000',
  colorBgContainer: '#050505',
  colorBgElevated: '#0a0a0a',
  colorBorder: '#222222',
  colorBorderSecondary: '#111111',
  colorText: '#e5e5e5',
  colorTextSecondary: '#888888',
  colorTextTertiary: '#555555',
  colorTextPlaceholder: '#444444',
  colorSplit: '#111111',
  borderRadius: 8,
  borderRadiusLG: 10,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
}

const darkComponents = {
  Modal: {
    contentBg: '#050505',
    headerBg: '#050505',
    footerBg: '#050505',
    titleColor: '#e5e5e5',
  },
  Input: {
    colorBgContainer: '#0a0a0a',
    colorBorder: '#222222',
    colorText: '#e5e5e5',
    colorTextPlaceholder: '#444',
    activeBorderColor: '#555',
    hoverBorderColor: '#444',
    activeShadow: 'none',
  },
  Select: {
    colorBgContainer: '#0a0a0a',
    colorBorder: '#222222',
    colorText: '#e5e5e5',
    optionSelectedBg: '#050505',
    optionActiveBg: '#111',
    colorBgElevated: '#0a0a0a',
  },
  Button: {
    colorBgContainer: '#111',
    colorBorder: '#222',
    colorText: '#e5e5e5',
    primaryColor: '#000',
    colorPrimaryHover: '#e0e0e0',
  },
  Switch: {
    colorPrimary: '#ffffff',
    colorPrimaryHover: '#e0e0e0',
    handleBg: '#000000',
  },
  Message: {
    contentBg: '#111',
    colorText: '#e5e5e5',
  },
}

const lightTokens = {
  colorPrimary: '#1677ff',
  colorBgBase: '#ffffff',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: '#d9d9d9',
  colorBorderSecondary: '#f0f0f0',
  colorText: '#1a1a1a',
  colorTextSecondary: '#666666',
  colorTextTertiary: '#999999',
  colorTextPlaceholder: '#bbbbbb',
  colorSplit: '#f0f0f0',
  borderRadius: 8,
  borderRadiusLG: 10,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
}

const lightComponents = {
  Modal: {
    contentBg: '#ffffff',
    headerBg: '#ffffff',
    footerBg: '#ffffff',
    titleColor: '#1a1a1a',
  },
  Input: {
    colorBgContainer: '#ffffff',
    colorBorder: '#d9d9d9',
    colorText: '#1a1a1a',
    colorTextPlaceholder: '#bbb',
    activeBorderColor: '#1677ff',
    hoverBorderColor: '#999',
    activeShadow: 'none',
  },
  Select: {
    colorBgContainer: '#ffffff',
    colorBorder: '#d9d9d9',
    colorText: '#1a1a1a',
    optionSelectedBg: '#e6f4ff',
    optionActiveBg: '#f5f5f5',
    colorBgElevated: '#ffffff',
  },
  Button: {
    colorBgContainer: '#ffffff',
    colorBorder: '#d9d9d9',
    colorText: '#1a1a1a',
    primaryColor: '#fff',
    colorPrimaryHover: '#4096ff',
  },
  Switch: {
    colorPrimary: '#1677ff',
    colorPrimaryHover: '#4096ff',
    handleBg: '#ffffff',
  },
  Message: {
    contentBg: '#ffffff',
    colorText: '#1a1a1a',
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
