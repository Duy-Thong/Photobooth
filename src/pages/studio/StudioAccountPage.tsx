import { useState, useRef } from 'react'
import { Card, Input, Button, Modal, Spin, message, Divider } from 'antd'
import { UserOutlined, LockOutlined, CloudUploadOutlined, CheckCircleFilled, ShopOutlined } from '@ant-design/icons'
import { updatePassword, getAuth } from 'firebase/auth'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { createOrUpdateAdmin, uploadStudioLogo } from '@/lib/adminService'

export default function StudioAccountPage() {
  const { user, studioName, logoUrl, role } = useAdminAuth()
  const [name, setName] = useState(studioName || '')
  const [savingName, setSavingName] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpdateName = async () => {
    if (!user || !name.trim()) return
    if (name.trim() === studioName) return

    setSavingName(true)
    try {
      await createOrUpdateAdmin(user.uid, { studioName: name.trim() })
      message.success('Cập nhật tên studio thành công')
      // reload location to refresh sidebar (or use a context if available)
      setTimeout(() => window.location.reload(), 800)
    } catch {
      message.error('Cập nhật thất bại')
    } finally {
      setSavingName(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn file ảnh')
      return
    }

    setUploadingLogo(true)
    try {
      await uploadStudioLogo(user.uid, file)
      message.success('Cập nhật logo thành công')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      message.error('Tải logo thất bại')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      message.error('Mật khẩu phải từ 6 ký tự trở lên')
      return
    }
    if (newPassword !== confirmPassword) {
      message.error('Mật khẩu xác nhận không khớp')
      return
    }

    setChangingPassword(true)
    try {
      const auth = getAuth()
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword)
        message.success('Đổi mật khẩu thành công')
        setShowPasswordModal(false)
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/requires-recent-login') {
        message.error('Vui lòng đăng nhập lại để thực hiện thay đổi này')
      } else {
        message.error('Lỗi khi đổi mật khẩu: ' + err.message)
      }
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Cài đặt Studio</h1>
          <p className="text-blue-400 text-sm font-medium uppercase tracking-[0.2em]">Quản lý thông tin & Bảo mật</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-[#0a0a0a] border-white/5 shadow-2xl overflow-hidden rounded-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>
            <div className="flex flex-col items-center pt-8 pb-6 px-4">
              <div 
                className="w-32 h-32 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative group overflow-hidden cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <ShopOutlined className="text-5xl text-white/20" />
                )}
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 backdrop-blur-[2px]">
                  <CloudUploadOutlined className="text-2xl text-white" />
                  <span className="text-[10px] font-bold text-white uppercase">Thay đổi</span>
                </div>
                
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                    <Spin size="small" />
                  </div>
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleLogoUpload} 
                accept="image/*" 
                className="hidden" 
              />

              <h3 className="text-xl font-bold text-white mb-1 text-center">{studioName || 'Tên Studio'}</h3>
              <p className="text-[#666] text-sm mb-4">{user?.email}</p>
              
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-full border border-blue-500/20">
                  {role === 'studio' ? 'Hội viên Studio' : 'Super Admin'}
                </span>
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase rounded-full border border-green-500/20">
                  Hoạt động
                </span>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 text-[11px] text-[#555] italic">
              <CheckCircleFilled className="text-green-500 mr-2" />
              Sử dụng logo chất lượng cao để hiển thị tốt nhất trên hóa đơn & khung ảnh.
            </div>
          </Card>
        </div>

        {/* Right Column: Settings */}
        <div className="md:col-span-2 space-y-6">
          {/* General Info Card */}
          <Card 
            title={<span className="text-white font-bold flex items-center gap-2"><UserOutlined className="text-blue-400" /> Thông tin cơ bản</span>} 
            className="bg-[#0a0a0a] border-white/5 shadow-xl rounded-2xl"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#555]">Tên Studio hiển thị</label>
                <div className="flex gap-3">
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Nhập tên studio của bạn..."
                    className="bg-white/5 border-white/10 text-white h-11 rounded-xl focus:bg-white/10 transition-all font-medium"
                  />
                  <Button 
                    type="primary" 
                    onClick={handleUpdateName} 
                    loading={savingName}
                    disabled={name.trim() === studioName}
                    className="h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                  >
                    Lưu
                  </Button>
                </div>
                <p className="text-[11px] text-[#444]">Tên này sẽ hiển thị trên ứng dụng Photobooth và các bảng quản trị.</p>
              </div>

              <Divider className="border-white/5 my-0" />

              <div className="grid grid-cols-1 gap-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#555]">Email tài khoản</label>
                <Input 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-white/5 border-white/5 text-[#555] h-11 rounded-xl cursor-not-allowed font-medium"
                />
                <p className="text-[11px] text-[#444]">Liên hệ Super Admin nếu bạn muốn thay đổi email đăng nhập.</p>
              </div>
            </div>
          </Card>

          {/* Security Card */}
          <Card 
            title={<span className="text-white font-bold flex items-center gap-2"><LockOutlined className="text-purple-400" /> Bảo mật</span>} 
            className="bg-[#0a0a0a] border-white/5 shadow-xl rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium mb-1">Mật khẩu đăng nhập</h4>
                <p className="text-[#555] text-xs">Thay đổi mật khẩu thường xuyên để bảo mật tài khoản tốt hơn.</p>
              </div>
              <Button 
                onClick={() => setShowPasswordModal(true)}
                className="bg-white/5 border-white/10 text-white hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl transition-all"
              >
                Đổi mật khẩu
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        title={<span className="text-white font-bold">Cập nhật mật khẩu</span>}
        open={showPasswordModal}
        onCancel={() => setShowPasswordModal(false)}
        onOk={handleChangePassword}
        okText="Thay đổi"
        cancelText="Hủy"
        confirmLoading={changingPassword}
        centered
        className="dark-modal"
        styles={{
          mask: { backdropFilter: 'blur(10px)' },
          body: { background: '#0a0a0a' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }
        }}
      >
        <div className="py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#555]">Mật khẩu mới</label>
            <Input.Password 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#555]">Xác nhận mật khẩu</label>
            <Input.Password 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
            />
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
            <p className="text-[11px] text-yellow-200/70 leading-relaxed">
              <strong>Lưu ý:</strong> Firebase có thể yêu cầu bạn đăng nhập lại (re-authenticate) nếu phiên làm việc hiện tại đã quá lâu.
            </p>
          </div>
        </div>
      </Modal>

      <style>{`
        .animate-in {
          animation-fill-mode: forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInFromBottom {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        .slide-in-from-bottom-4 { animation: slideInFromBottom 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  )
}
