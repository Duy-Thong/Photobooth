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
        },
        components: {
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
        },
      }}
    >
      <RouterProvider router={router} />
      <Analytics />
    </ConfigProvider>
  )
}

export default App
