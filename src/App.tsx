import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import { Analytics } from '@vercel/analytics/react'
import { router } from './router'

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#ffffff',
          colorBgBase: '#0a0a0a',
          colorBgContainer: '#141414',
          colorBgElevated: '#1a1a1a',
          colorBorder: '#2a2a2a',
          colorBorderSecondary: '#1e1e1e',
          colorText: '#e5e5e5',
          colorTextSecondary: '#888888',
          colorTextTertiary: '#555555',
          colorTextPlaceholder: '#444444',
          colorSplit: '#1e1e1e',
          borderRadius: 8,
          borderRadiusLG: 10,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
        components: {
          Modal: {
            contentBg: '#141414',
            headerBg: '#141414',
            footerBg: '#141414',
            titleColor: '#e5e5e5',
          },
          Input: {
            colorBgContainer: '#191919',
            colorBorder: '#2a2a2a',
            colorText: '#e5e5e5',
            colorTextPlaceholder: '#444',
            activeBorderColor: '#555',
            hoverBorderColor: '#444',
            activeShadow: 'none',
          },
          Select: {
            colorBgContainer: '#191919',
            colorBorder: '#2a2a2a',
            colorText: '#e5e5e5',
            optionSelectedBg: '#2a2a2a',
            optionActiveBg: '#222',
            colorBgElevated: '#191919',
          },
          Button: {
            colorBgContainer: '#1e1e1e',
            colorBorder: '#2a2a2a',
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
            contentBg: '#1e1e1e',
            colorText: '#e5e5e5',
          },
        },
      }}
    >
      <RouterProvider router={router} />
      <Analytics />
    </ConfigProvider>
  )
}

export default App
