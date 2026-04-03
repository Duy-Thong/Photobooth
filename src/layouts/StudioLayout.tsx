import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Modal, Spin, ConfigProvider, theme } from 'antd'
import {
  AppstoreOutlined,
  PictureOutlined,
  PoweroffOutlined,
  CameraOutlined,
  MenuOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function StudioLayout() {
  const { role, studioName, logout, isAdminLoading } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(window.innerWidth < 1024)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 1024) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#050505]">
        <Spin size="large" />
      </div>
    )
  }

  if (role !== 'studio') {
    return <Navigate to="/admin" replace />
  }

  const handleLogout = () => {
    Modal.confirm({
      title: 'Đăng xuất hệ thống?',
      content: 'Phiên làm việc hiện tại của studio sẽ kết thúc.',
      okText: 'Đăng xuất',
      cancelText: 'Hủy',
      okButtonProps: { danger: true, type: 'primary' },
      onOk: logout,
      centered: true,
      className: 'dark-modal'
    })
  }

  const navItems = [
    { path: '/studio/dashboard', icon: <AppstoreOutlined />, label: 'Tổng Quan' },
    { path: '/studio/gallery', icon: <PictureOutlined />, label: 'Thư Viện Ảnh' },
    { path: '/studio/frames', icon: <PictureOutlined />, label: 'Quản Lý Khung' },
  ]

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgBase: '#000' } }}>
      <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-blue-500/30">
        
        {/* Mobile Header overlay */}
        {isMobile && (
          <div className="absolute top-0 left-0 right-0 h-16 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 z-40 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <span className="font-bold text-white text-xs">P</span>
              </div>
              <span className="font-bold text-sm tracking-wide">{studioName || 'Photobooth'}</span>
            </div>
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {collapsed ? <MenuOutlined /> : <CloseOutlined />}
            </button>
          </div>
        )}

        {/* Sidebar */}
        <aside 
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            flex flex-col bg-[#0a0a0a] border-r border-white/5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${collapsed ? (isMobile ? '-translate-x-full' : 'w-[80px]') : 'w-[280px] translate-x-0'}
            ${isMobile && !collapsed ? 'shadow-2xl shadow-black/80' : ''}
          `}
        >
          {/* Logo Area */}
          <div className="h-20 flex items-center justify-center px-6 border-b border-white/5">
            <div className={`flex items-center gap-3 transition-all duration-300 ${collapsed && !isMobile ? 'scale-110' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="font-black text-white text-sm tracking-tighter">P</span>
              </div>
              {(!collapsed || isMobile) && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden">
                  <span className="font-bold text-base tracking-wide text-white leading-tight truncate max-w-[160px]">{studioName || 'Photobooth'}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold">System</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Action */}
          <div className="p-4">
            <button
              onClick={() => navigate('/')}
              className={`
                group relative w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all overflow-hidden
                ${collapsed && !isMobile ? 'h-12 w-12 mx-auto rounded-full' : 'h-12 px-4'}
              `}
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <CameraOutlined className={collapsed && !isMobile ? 'text-xl' : 'text-lg'} />
              {(!collapsed || isMobile) && <span>Mở Photobooth</span>}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <div className="mb-4 px-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider text-[#555] transition-all duration-300 ${collapsed && !isMobile ? 'opacity-0' : 'opacity-100'}`}>Menu Quản Lý</span>
            </div>
            {navItems.map(item => {
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path)
                    if (isMobile) setCollapsed(true)
                  }}
                  title={collapsed && !isMobile ? item.label : undefined}
                  className={`
                    w-full flex items-center gap-4 px-3 h-12 rounded-xl transition-all duration-300 group relative
                    ${isActive ? 'bg-blue-500/10 text-blue-400' : 'text-[#888] hover:bg-white/5 hover:text-white'}
                    ${collapsed && !isMobile ? 'justify-center' : 'justify-start'}
                  `}
                >
                  {isActive && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-md"></div>}
                  <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  {(!collapsed || isMobile) && (
                    <span className="font-medium whitespace-nowrap">{item.label}</span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center gap-3 h-12 rounded-xl text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-all group
                ${collapsed && !isMobile ? 'justify-center' : 'justify-start px-4'}
              `}
              title={collapsed && !isMobile ? 'Đăng xuất' : undefined}
            >
              <PoweroffOutlined className="text-lg group-hover:scale-110 transition-transform" />
              {(!collapsed || isMobile) && <span className="font-medium">Đăng xuất</span>}
            </button>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {isMobile && !collapsed && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setCollapsed(true)}
          ></div>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col h-full relative ${isMobile ? 'pt-16' : ''}`}>
          {/* Content Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <Outlet />
          </div>
        </main>
      </div>
    </ConfigProvider>
  )
}
